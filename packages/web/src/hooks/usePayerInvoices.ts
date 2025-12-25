import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { usePublicClient, useWriteContract } from 'wagmi'
import { addTokenMeta, getTokenMeta, invoiceFactoryAbi, invoiceFlowAbi, normalizeAddressInput, getReceiptNftAddress } from '../config/contracts'
import type { ChainInvoice } from '../types/invoice'

export type PayerInvoice = ChainInvoice & {
  contractAddress: Address
  tokenName?: string
  tokenSymbol?: string
  tokenDecimals?: number
  isPaid?: boolean
  receiptTokenId?: bigint
  receiptNftAddress?: Address
  txHash?: string
}

export function usePayerInvoices(factoryAddress?: Address, customer?: Address, contractList?: Address[]) {
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [invoices, setInvoices] = useState<PayerInvoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!publicClient || !customer) {
      setInvoices([])
      return
    }
    setIsLoading(true)
    try {
      let deployed: Address[] = contractList ?? []
      if (!deployed.length && factoryAddress) {
        deployed =
          ((await publicClient.readContract({
            address: factoryAddress,
            abi: invoiceFactoryAbi,
            functionName: 'getDeployedInvoiceFlowContracts'
          })) ?? []) as Address[]
      }
      deployed = deployed
        .map((addr) => normalizeAddressInput(addr))
        .filter((addr): addr is Address => Boolean(addr))

      // Ensure we don't accidentally include the factory itself
      deployed = deployed.filter((addr) => !factoryAddress || addr.toLowerCase() !== factoryAddress.toLowerCase())

      console.log('[payer] refresh', { customer, factoryAddress, deployed })

      if (!deployed.length) {
        setInvoices([])
        return
      }

      const metaCache: Record<
        string,
        { name?: string; symbol: string; decimals: number; isNative?: boolean }
      > = {}

      const shortToken = (token: Address | string, size = 4) => {
        if (!token) return 'Unknown'
        return `${token.slice(0, size + 2)}…${token.slice(-size)}`
      }

      const resolveMeta = async (token: Address | string | undefined) => {
        const key = (token ?? '').toLowerCase()
        if (!key) return { name: 'Token', symbol: 'TOKEN', decimals: 18 }
        if (metaCache[key]) return metaCache[key]
        let base = getTokenMeta(token)
        if (!base.symbol || base.symbol.trim() === '') base = { ...base, symbol: 'TOKEN' }
        const needsOnchain =
          (!base.name || base.name.trim() === '') ||
          (!base.symbol || base.symbol === 'TOKEN' || base.symbol === '???' || base.symbol.trim() === '')
        if (needsOnchain && token && token !== '0x0000000000000000000000000000000000000000') {
          try {
            const [onName, onSymbol, onDecimals] = await Promise.all([
              publicClient.readContract({ address: token as Address, abi: erc20Abi, functionName: 'name' }).catch(() => undefined),
              publicClient.readContract({ address: token as Address, abi: erc20Abi, functionName: 'symbol' }).catch(() => undefined),
              publicClient.readContract({ address: token as Address, abi: erc20Abi, functionName: 'decimals' }).catch(() => undefined)
            ])
            base = {
              name: (onName as string | undefined) ?? base.name,
              symbol: (onSymbol as string | undefined) ?? base.symbol ?? 'TOKEN',
              decimals: Number(onDecimals ?? base.decimals ?? 18),
              isNative: base.isNative
            }
          } catch {
            // ignore fetch failures
          }
        }
        // Persist good metadata so later getTokenMeta calls (e.g. in UI) stay consistent
        if (token && base.symbol && base.symbol !== '???' && base.symbol.trim() !== '') {
          addTokenMeta(token as Address, base)
        }
        metaCache[key] = base
        return base
      }

      const withFallbackSymbol = (token: Address, meta: { name?: string; symbol: string; decimals: number; isNative?: boolean }) => {
        const symbolOk = meta.symbol && meta.symbol !== '???' && meta.symbol.trim() !== ''
        const nameOk = meta.name && meta.name.trim() !== '' && meta.name !== 'Unknown Token'
        return {
          ...meta,
          symbol: symbolOk ? meta.symbol : shortToken(token),
          name: nameOk ? meta.name : symbolOk ? meta.symbol : shortToken(token)
        }
      }

      const INVOICE_PAID_EVENT = {
        type: 'event' as const,
        name: 'InvoicePaid',
        inputs: [
          { type: 'uint256', name: '_id', indexed: false },
          { type: 'address', name: '_customer', indexed: true },
          { type: 'uint256', name: '_amount', indexed: false },
          { type: 'address', name: '_token', indexed: true },
          { type: 'uint256', name: '_expiration', indexed: false },
          { type: 'address', name: '_invoiceContract', indexed: false },
          { type: 'uint256', name: '_receiptTokenId', indexed: false }
        ]
      }

      const receiptNftAddress = getReceiptNftAddress(publicClient.chain?.id)

      // 1) Fetch paid invoices from events (these are removed from contract storage)
      const paidInvoices: PayerInvoice[] = []
      const paidKeys = new Set<string>()
      for (const contractAddress of deployed) {
        try {
          const latestBlock = await publicClient.getBlockNumber()
          const windowSize = 50000n
          const toBlock = latestBlock
          const fromBlock = toBlock > windowSize ? toBlock - windowSize : 0n

          const logs = (await publicClient.getLogs({
            address: contractAddress,
            event: INVOICE_PAID_EVENT,
            args: { _customer: customer },
            fromBlock,
            toBlock
          })) as Array<{
            args?: {
              _id?: bigint
              _customer?: Address
              _amount?: bigint
              _token?: Address
              _expiration?: bigint
              _invoiceContract?: Address
              _receiptTokenId?: bigint
            }
            transactionHash: string
          }>

          for (const log of logs) {
            const args = log.args ?? {}
            if (args._id === undefined) continue
            const key = `${contractAddress.toLowerCase()}-${args._id.toString()}`
            paidKeys.add(key)
            const tokenVal = (args._token ?? '0x0000000000000000000000000000000000000000') as Address
            const meta = withFallbackSymbol(tokenVal, await resolveMeta(tokenVal))
            paidInvoices.push({
              id: args._id,
              customer,
              token: tokenVal,
              amountRaw: args._amount ?? 0n,
              expiration: args._expiration ?? 0n,
              contractAddress: (args._invoiceContract ?? contractAddress) as Address,
              tokenName: meta.name,
              tokenSymbol: meta.symbol,
              tokenDecimals: meta.decimals,
              isPaid: true,
              receiptTokenId: args._receiptTokenId,
              receiptNftAddress,
              txHash: log.transactionHash
            })
          }
        } catch (err) {
          console.warn('[payer] failed to fetch paid InvoicePaid events', contractAddress, err)
        }
      }

      // 2) Fetch unpaid invoices from contract storage
      const unpaid: PayerInvoice[] = []
      for (const contractAddress of deployed) {
        let ids: bigint[] = []
        try {
          ids =
            ((await publicClient.readContract({
              address: contractAddress,
              abi: invoiceFlowAbi,
              functionName: 'getInvoiceIds'
            })) ?? []) as bigint[]
        } catch (err) {
          console.warn('[payer] getInvoiceIds failed', contractAddress, err)
          continue
        }
        console.log('[payer] ids', contractAddress, ids.map((x) => x.toString()))
        if (!ids.length) continue
        for (const id of ids) {
          try {
            const result = (await publicClient.readContract({
              address: contractAddress,
              abi: invoiceFlowAbi,
              functionName: 'invoices',
              args: [id]
            })) as ChainInvoice

            type RawInvoice = { id?: bigint; customer?: Address; amountRaw?: bigint; amount?: bigint; token?: Address; expiration?: bigint; 0?: Address; 1?: bigint; 2?: bigint; 3?: Address; 4?: bigint }
            const r = result as RawInvoice
            const invoiceId = r.id ?? id
            const customerVal = (r.customer ?? r[0] ?? '0x0000000000000000000000000000000000000000') as Address
            const amountRaw = r.amountRaw ?? r.amount ?? r[2] ?? 0n
            const tokenVal = (r.token ?? r[3] ?? '0x0000000000000000000000000000000000000000') as Address
            const expirationVal = r.expiration ?? r[4] ?? 0n

            const meta = withFallbackSymbol(tokenVal, await resolveMeta(tokenVal))

            const invoice: ChainInvoice = {
              id: invoiceId,
              customer: customerVal,
              token: tokenVal,
              amountRaw,
              expiration: expirationVal
            }
            console.log('[payer] invoice', contractAddress, invoiceId?.toString(), {
              customer: invoice.customer,
              token: invoice.token,
              amount: invoice.amountRaw?.toString?.() ?? '0',
              expiration: invoice.expiration?.toString?.() ?? '0',
              tokenMeta: meta
            })
            // If expiration is zero, treat as paid/removed; keep as Paid if needed for history, but not payable
            if (invoice.customer && customer && invoice.customer.toLowerCase() === customer.toLowerCase()) {
              const key = `${contractAddress.toLowerCase()}-${invoiceId.toString()}`
              if (paidKeys.has(key)) {
                continue
              }

              unpaid.push({
                ...invoice,
                contractAddress,
                tokenName: meta.name,
                tokenSymbol: meta.symbol,
                tokenDecimals: meta.decimals,
                isPaid: false
              })
            }
          } catch (err) {
            console.warn('[payer] invoices() failed', contractAddress, id.toString(), err)
          }
        }
      }

      // 3) Combine and sort (expiration desc, then id desc)
      const all = [...paidInvoices, ...unpaid].sort((a, b) => {
        const expDiff = Number(b.expiration - a.expiration)
        if (expDiff !== 0) return expDiff
        return Number(b.id - a.id)
      })
      setInvoices(all)
    } catch (err) {
      console.warn('[payer] refresh failed', err)
    } finally {
      setIsLoading(false)
    }
  }, [customer, factoryAddress, publicClient, contractList])

  const payInvoice = useCallback(
    async (invoice: PayerInvoice) => {
      if (!publicClient) throw new Error('No provider')
      const tokenMeta = getTokenMeta(invoice.token)
      try {
        if (!tokenMeta.isNative && customer) {
          const allowance = (await publicClient.readContract({
            address: invoice.token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [customer, invoice.contractAddress]
          })) as bigint

          if (allowance < invoice.amountRaw) {
            await writeContractAsync({
              address: invoice.token,
              abi: erc20Abi,
              functionName: 'approve',
              args: [invoice.contractAddress, invoice.amountRaw]
            })
          }
        }

        await writeContractAsync({
          address: invoice.contractAddress,
          abi: invoiceFlowAbi,
          functionName: 'handleTransfer',
          args: [invoice.id],
          value: tokenMeta.isNative ? invoice.amountRaw : undefined,
          gas: 3_000_000n
        })
        setPaymentMessage(`Invoice #${invoice.id.toString()} payment submitted.`)
        // Mark as paid locally so UI immediately reflects status
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.contractAddress === invoice.contractAddress && inv.id === invoice.id ? { ...inv, isPaid: true } : inv
          )
        )
        await refresh()
      } catch (err) {
        setPaymentMessage((err as Error).message)
      }
    },
    [customer, publicClient, refresh, writeContractAsync]
  )

  return {
    invoices,
    isLoading,
    paymentMessage,
    setPaymentMessage,
    payInvoice,
    refresh
  }
}


