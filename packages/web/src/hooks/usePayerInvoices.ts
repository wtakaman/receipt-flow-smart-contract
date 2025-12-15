import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { usePublicClient, useWriteContract } from 'wagmi'
import { getTokenMeta, invoiceFactoryAbi, invoiceFlowAbi, normalizeAddressInput } from '../config/contracts'
import type { ChainInvoice } from '../types/invoice'

export type PayerInvoice = ChainInvoice & {
  contractAddress: Address
  tokenName?: string
  tokenSymbol?: string
  tokenDecimals?: number
  isPaid?: boolean
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

      const resolveMeta = async (token: Address | string | undefined) => {
        const key = (token ?? '').toLowerCase()
        if (!key) return { name: 'Token', symbol: 'TOKEN', decimals: 18 }
        if (metaCache[key]) return metaCache[key]
        let base = getTokenMeta(token)
        if (!base.symbol || base.symbol.trim() === '') base = { ...base, symbol: 'TOKEN' }
        const needsOnchain =
          (!base.name || base.name.trim() === '') ||
          (!base.symbol || base.symbol === 'TOKEN' || base.symbol.trim() === '')
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
        metaCache[key] = base
        return base
      }

      const found: PayerInvoice[] = []
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
            const customerVal = r.customer ?? r[0]
            const amountRaw = r.amountRaw ?? r.amount ?? r[2] ?? 0n
            const tokenVal = r.token ?? r[3]
            const expirationVal = r.expiration ?? r[4] ?? 0n

            const meta = await resolveMeta(tokenVal)

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
              found.push({
                ...invoice,
                contractAddress,
                tokenName: meta.name,
                tokenSymbol: meta.symbol,
                tokenDecimals: meta.decimals,
                isPaid: invoice.expiration === 0n
              })
            }
          } catch (err) {
            console.warn('[payer] invoices() failed', contractAddress, id.toString(), err)
          }
        }
      }

      // Show most recent first
      setInvoices(found.sort((a, b) => Number(b.id - a.id)))
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


