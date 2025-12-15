import { useCallback, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import type { PaidInvoice } from '../types/invoice'

const env = import.meta.env
const LOG_WINDOW_BLOCKS = BigInt(Number(env.VITE_LOG_WINDOW_BLOCKS ?? 10))
const LOG_MAX_WINDOWS = Number(env.VITE_LOG_MAX_WINDOWS ?? 200) // total windows to scan

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

// Cache to prevent repeated fetches
const cache = new Map<string, { data: PaidInvoice[]; timestamp: number }>()
const CACHE_TTL = 120000 // 2 minutes

export function usePaidInvoices(contractAddress?: Address) {
  const publicClient = usePublicClient()
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const fetchingRef = useRef(false)

  const fetchPaidInvoices = useCallback(async (forceRefresh = false) => {
    if (!publicClient || !contractAddress) return
    if (fetchingRef.current) return // Prevent concurrent fetches

    // Check cache first
    const cacheKey = contractAddress.toLowerCase()
    const cached = cache.get(cacheKey)
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPaidInvoices(cached.data)
      setHasFetched(true)
      return
    }

    fetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const latestBlock = await publicClient.getBlockNumber()

      type LogEntry = {
        args?: {
          _id?: bigint
          _customer?: Address
          _token?: Address
          _amount?: bigint
          _expiration?: bigint
          _receiptTokenId?: bigint
        }
        transactionHash: string
        blockNumber: bigint
      }

      // Walk backwards in small windows (configurable) to respect provider limits.
      const windowSize = LOG_WINDOW_BLOCKS > 0n ? LOG_WINDOW_BLOCKS : 10n
      const maxWindows = LOG_MAX_WINDOWS > 0 ? LOG_MAX_WINDOWS : 200
      let toBlock = latestBlock
      const logs: LogEntry[] = []

      for (let i = 0; i < maxWindows && toBlock >= 0; i++) {
        const fromBlock = toBlock > (windowSize - 1n) ? toBlock - (windowSize - 1n) : 0n
        try {
          const winLogs = await publicClient.getLogs({
            address: contractAddress,
            event: INVOICE_PAID_EVENT,
            fromBlock,
            toBlock
          })
          logs.push(...winLogs)
        } catch (err) {
          // If even a tiny window fails, break to avoid hammering the RPC
          console.warn(`getLogs failed for window ${fromBlock.toString()}-${toBlock.toString()}`, err)
          break
        }
        if (fromBlock === 0n) break
        toBlock = fromBlock - 1n
      }

      // Process logs
      const invoices: PaidInvoice[] = logs.map((log) => ({
        id: log.args?._id ?? 0n,
        customer: (log.args?._customer ?? '0x0') as Address,
        token: (log.args?._token ?? '0x0') as Address,
        amountRaw: log.args?._amount ?? 0n,
        expiration: log.args?._expiration ?? 0n,
        paidAt: Date.now(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        receiptTokenId: log.args?._receiptTokenId
      }))

      // Sort by block number (most recent first)
      const sorted = invoices.sort((a, b) => Number(b.blockNumber - a.blockNumber))
      
      // Update cache
      cache.set(cacheKey, { data: sorted, timestamp: Date.now() })
      
      setPaidInvoices(sorted)
      setHasFetched(true)
    } catch (err) {
      console.error('Failed to fetch paid invoices:', err)
      setError('Failed to load. Try switching to a public RPC in your .env file.')
      setHasFetched(true) // Mark as fetched to stop retries
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [contractAddress, publicClient])

  return {
    paidInvoices,
    isLoading,
    error,
    hasFetched,
    fetch: fetchPaidInvoices,
    refetch: () => fetchPaidInvoices(true),
    totalPaid: paidInvoices.length
  }
}
