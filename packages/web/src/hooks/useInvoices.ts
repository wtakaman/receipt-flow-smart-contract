import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
  useWriteContract
} from 'wagmi'
import type { Address } from 'viem'
import { parseUnits } from 'viem'
import { getTokenMeta, invoiceFlowAbi } from '../config/contracts'
import type { ChainInvoice, EventEntry } from '../types/invoice'

export type RegisterInvoiceParams = {
  id: bigint
  customer: Address
  token: Address
  amount: string
  decimals: number
  expiresInDays: number
}

export function useInvoices(contractAddress?: Address) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [eventFeed, setEventFeed] = useState<EventEntry[]>([])
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)

  const {
    data: invoiceIdsData,
    refetch: refetchInvoiceIds
  } = useReadContract({
    address: contractAddress,
    abi: invoiceFlowAbi,
    functionName: 'getInvoiceIds',
    query: { enabled: Boolean(contractAddress) }
  })

  const invoiceIds = (invoiceIdsData as bigint[] | undefined) ?? []

  const {
    data: invoiceContractsData,
    refetch: refetchInvoices,
    isFetching: isFetchingInvoices
  } = useReadContracts({
    contracts: invoiceIds.map((id) => ({
      address: contractAddress!,
      abi: invoiceFlowAbi,
      functionName: 'invoices',
      args: [id]
    })),
    query: { enabled: Boolean(contractAddress) && invoiceIds.length > 0 }
  })

  const invoices: ChainInvoice[] = useMemo(() => {
    if (!invoiceContractsData) return []
    return invoiceContractsData
      .map((entry) => {
        const result = entry.result as ChainInvoice | undefined
        if (!result || result.id === 0n) return null
        const amountRaw =
          (result as { amountRaw?: bigint }).amountRaw ?? (result as { amount?: bigint }).amount ?? 0n
        return {
          id: result.id,
          customer: result.customer,
          token: result.token,
          amountRaw,
          expiration: result.expiration
        }
      })
      .filter((value): value is ChainInvoice => Boolean(value))
  }, [invoiceContractsData])

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'InvoiceRegistered',
    enabled: Boolean(contractAddress),
    onLogs() {
      refetchInvoiceIds()
      refetchInvoices()
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'InvoiceRemoved',
    enabled: Boolean(contractAddress),
    onLogs() {
      refetchInvoiceIds()
      refetchInvoices()
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'InvoicePaid',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      refetchInvoiceIds()
      refetchInvoices()
      setEventFeed((prev) => {
        const next = logs
          .map((log) => ({
            title: `Invoice paid #${(log.args?._id ?? 0n).toString()}`,
            subtitle: `Customer ${shortAddress(log.args?._customer as Address)}`,
            timestamp: Date.now()
          }))
          .concat(prev)
        return next.slice(0, 12)
      })
    }
  })

  const registerInvoice = useCallback(
    async (params: RegisterInvoiceParams) => {
      if (!contractAddress) throw new Error('Contract not configured')
      const expiresIn = BigInt(params.expiresInDays) * 60n * 60n * 24n
      const amountRaw = parseUnits(params.amount || '0', params.decimals)
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'registerInvoice',
        args: [params.id, params.customer, amountRaw, params.token, expiresIn]
      })
      refetchInvoiceIds()
      refetchInvoices()
    },
    [contractAddress, refetchInvoiceIds, refetchInvoices, writeContractAsync]
  )

  const removeInvoice = useCallback(
    async (id: bigint) => {
      if (!contractAddress) throw new Error('Contract not configured')
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'removeInvoice',
        args: [id]
      })
      refetchInvoiceIds()
      refetchInvoices()
    },
    [contractAddress, refetchInvoiceIds, refetchInvoices, writeContractAsync]
  )

  const payInvoice = useCallback(
    async (invoice: ChainInvoice) => {
      if (!contractAddress) throw new Error('Contract not configured')
      const tokenMeta = getTokenMeta(invoice.token)
      try {
        await writeContractAsync({
          address: contractAddress,
          abi: invoiceFlowAbi,
          functionName: 'handleTransfer',
          args: [invoice.id],
          value: tokenMeta.isNative ? invoice.amountRaw : undefined
        })
        setPaymentMessage(`Invoice #${invoice.id.toString()} payment submitted.`)
      } catch (err) {
        setPaymentMessage((err as Error).message)
      }
    },
    [contractAddress, writeContractAsync]
  )

  const fetchEventHistory = useCallback(async () => {
    if (!publicClient || !contractAddress) return
    const logs = await publicClient.getLogs({
      address: contractAddress,
      abi: invoiceFlowAbi,
      eventName: 'InvoicePaid',
      fromBlock: 0n
    })
    setEventFeed(
      logs
        .map((log) => ({
          title: `Invoice paid #${(log.args?._id ?? 0n).toString()}`,
          subtitle: `Customer ${shortAddress(log.args?._customer as Address)}`,
          timestamp: Number(log.blockTimestamp ?? Date.now())
        }))
        .slice(-12)
        .reverse()
    )
  }, [contractAddress, publicClient])

  useEffect(() => {
    fetchEventHistory()
  }, [fetchEventHistory])

  const metrics = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000))
    const openCount = invoices.length
    const expiredCount = invoices.filter((inv) => inv.expiration !== 0n && inv.expiration < now).length
    const paidCount = eventFeed.filter((event) => event.title.startsWith('Invoice paid')).length
    return { openCount, expiredCount, paidCount }
  }, [invoices, eventFeed])

  return {
    invoices,
    metrics,
    isFetchingInvoices,
    eventFeed,
    paymentMessage,
    setPaymentMessage,
    registerInvoice,
    removeInvoice,
    payInvoice,
    fetchEventHistory
  }
}

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

