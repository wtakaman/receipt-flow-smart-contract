import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { decodeEventLog, erc20Abi, formatUnits, parseUnits, zeroAddress } from 'viem'
import { addTokenMeta, getTokenMeta, invoiceFlowAbi } from '../config/contracts'
import type { WithdrawRow } from '../types/invoice'

type BalanceEntry = {
  raw: bigint
  formatted: string
  symbol: string
}

const registeredEvent = {
  type: 'event',
  name: 'WithdrawRequestRegistered',
  inputs: [
    { name: '_id', type: 'uint256', indexed: false },
    { name: '_amount', type: 'uint256', indexed: false },
    { name: '_token', type: 'address', indexed: false },
    { name: '_executed', type: 'bool', indexed: false }
  ]
} as const
const approvedEvent = {
  type: 'event',
  name: 'WithdrawRequestApproved',
  inputs: [
    { name: '_id', type: 'uint256', indexed: false },
    { name: '_approver', type: 'address', indexed: false },
    { name: '_amount', type: 'uint256', indexed: false },
    { name: '_token', type: 'address', indexed: false }
  ]
} as const
const executedEvent = {
  type: 'event',
  name: 'WithdrawRequestExecuted',
  inputs: [
    { name: '_id', type: 'uint256', indexed: false },
    { name: '_amount', type: 'uint256', indexed: false },
    { name: '_token', type: 'address', indexed: false },
    { name: '_executed', type: 'bool', indexed: false }
  ]
} as const

export function useWithdrawals(contractAddress?: Address, supportedTokens?: Address[]) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [rows, setRows] = useState<Record<string, WithdrawRow>>({})
  const [balances, setBalances] = useState<Record<string, BalanceEntry>>({})

  // Fetch and cache token metadata from chain
  const fetchTokenMeta = useCallback(async (token: Address) => {
    if (!publicClient || token === zeroAddress) return
    const existingMeta = getTokenMeta(token)
    if (existingMeta.symbol !== '???') return // Already have metadata
    
    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'symbol'
        }) as Promise<string>,
        publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'decimals'
        }) as Promise<number>
      ])
      addTokenMeta(token, { symbol, decimals, name: symbol })
    } catch (err) {
      console.warn('Unable to fetch token metadata for', token, err)
    }
  }, [publicClient])

  const fetchBalances = useCallback(async () => {
    if (!publicClient || !contractAddress) return
    if (!supportedTokens || supportedTokens.length === 0) {
      setBalances({})
      return
    }
    try {
      // First fetch any missing token metadata
      await Promise.all(supportedTokens.map(fetchTokenMeta))
      
      const entries = await Promise.all(
        supportedTokens.map(async (token) => {
          const meta = getTokenMeta(token)
          let raw = 0n
          if (token === zeroAddress) {
            raw = await publicClient.getBalance({ address: contractAddress })
          } else {
            raw = (await publicClient.readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [contractAddress]
            })) as bigint
          }
          return {
            token,
            meta,
            raw,
            formatted: formatUnits(raw, meta.decimals)
          }
        })
      )
      const map: Record<string, BalanceEntry> = {}
      entries.forEach((entry) => {
        map[entry.token.toLowerCase()] = {
          raw: entry.raw,
          formatted: entry.formatted,
          symbol: entry.meta.symbol
        }
      })
      setBalances(map)
    } catch (err) {
      console.warn('Unable to fetch balances for withdraw view', err)
    }
  }, [publicClient, contractAddress, supportedTokens, fetchTokenMeta])

  useEffect(() => {
    if (!publicClient || !contractAddress) return
    let ignore = false
    ;(async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        // Use a reasonable block range that most RPCs accept (around 2000 blocks)
        const fromBlock = latest > 2000n ? latest - 2000n : 0n
        
        console.log('[Withdrawals] Fetching logs from block', fromBlock.toString(), 'to', latest.toString())

        const [registered, approved, executed] = await Promise.all([
          publicClient.getLogs({
            address: contractAddress,
            event: registeredEvent,
            fromBlock,
            toBlock: latest
          }),
          publicClient.getLogs({
            address: contractAddress,
            event: approvedEvent,
            fromBlock,
            toBlock: latest
          }),
          publicClient.getLogs({
            address: contractAddress,
            event: executedEvent,
            fromBlock,
            toBlock: latest
          })
        ])
        
        console.log('[Withdrawals] Found', registered.length, 'registered,', approved.length, 'approved,', executed.length, 'executed')

        if (ignore) return
        const map: Record<string, WithdrawRow> = {}
        const tokensToFetch = new Set<Address>()
        
        registered.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [registeredEvent],
              data: log.data,
              topics: log.topics
            })
            const args = decoded.args as Record<string, unknown>
            const id = (args._id as bigint) ?? 0n
            const amountRaw = (args._amount as bigint) ?? 0n
            const token = (args._token as Address) ?? zeroAddress
            const isExecuted = Boolean(args._executed)
            tokensToFetch.add(token)
            map[id.toString()] = {
              id,
              token,
              amountRaw,
              confirmations: [],
              executed: isExecuted
            }
          } catch {
            // skip non-matching logs
          }
        })
        
        // Fetch metadata for any unknown tokens
        await Promise.all(Array.from(tokensToFetch).map(fetchTokenMeta))
        
        approved.forEach((log) => {
          try {
          const decoded = decodeEventLog({
              abi: [approvedEvent],
              data: log.data,
              topics: log.topics
            })
          const args = decoded.args as { _id?: bigint; _approver?: Address }
          const id = (args._id ?? 0n).toString()
          const approver = args._approver ?? zeroAddress
            if (!map[id]) return
            if (!map[id].confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) {
              map[id].confirmations = [...map[id].confirmations, approver]
            }
          } catch {
            // skip
          }
        })
        executed.forEach((log) => {
          try {
          const decoded = decodeEventLog({
              abi: [executedEvent],
              data: log.data,
              topics: log.topics
            })
          const args = decoded.args as { _id?: bigint; _executed?: boolean }
          const id = (args._id ?? 0n).toString()
          const isExecuted = Boolean(args._executed ?? true)
            if (map[id]) map[id].executed = isExecuted
          } catch {
            // skip
          }
        })
        console.log('[Withdrawals] Final map:', map)
        setRows(map)
      } catch (err) {
        console.error('[Withdrawals] Error fetching logs:', err)
      }
    })()

    return () => {
      ignore = true
    }
  }, [publicClient, contractAddress, fetchTokenMeta])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  useWatchContractEvent({
    address: contractAddress,
    abi: [registeredEvent],
    eventName: 'WithdrawRequestRegistered',
    enabled: Boolean(contractAddress),
    poll: true,
    pollingInterval: 120000,
    onLogs(logs) {
      // Fetch metadata for any new tokens
      logs.forEach((log) => {
        try {
          const decoded = decodeEventLog({
            abi: [registeredEvent],
            data: log.data,
            topics: log.topics
          })
          const args = decoded.args as { _token?: Address }
          const token = args?._token
          if (token) fetchTokenMeta(token)
        } catch {
          // ignore non-matching logs
        }
      })
      
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [registeredEvent],
              data: log.data,
              topics: log.topics
            })
            const args = decoded.args as { _id?: bigint; _amount?: bigint; _token?: Address; _executed?: boolean }
            const id = args._id ?? 0n
            const amountRaw = args._amount ?? 0n
            const token = args._token ?? zeroAddress
            const isExecuted = Boolean(args._executed)
            
            next[id.toString()] = {
              id,
              token,
              amountRaw,
              confirmations: [],
              executed: isExecuted
            }
          } catch {
            // skip
          }
        })
        return next
      })
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: [approvedEvent],
    eventName: 'WithdrawRequestApproved',
    enabled: Boolean(contractAddress),
    poll: true,
    pollingInterval: 120000,
    onLogs(logs) {
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [approvedEvent],
              data: log.data,
              topics: log.topics
            })
            const args = decoded.args as Record<string, unknown>
            const id = (args._id as bigint)?.toString() ?? '0'
            const approver = (args._approver as Address) ?? zeroAddress
            if (!next[id]) return
            if (!next[id].confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) {
              next[id].confirmations = [...next[id].confirmations, approver]
            }
          } catch {
            // skip
          }
        })
        return next
      })
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: [executedEvent],
    eventName: 'WithdrawRequestExecuted',
    enabled: Boolean(contractAddress),
    poll: true,
    pollingInterval: 120000,
    onLogs(logs) {
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [executedEvent],
              data: log.data,
              topics: log.topics
            })
            const args = decoded.args as Record<string, unknown>
            const id = (args._id as bigint)?.toString() ?? '0'
            const isExecuted = Boolean(args._executed ?? true)
            if (next[id]) next[id].executed = isExecuted
          } catch {
            // skip
          }
        })
        return next
      })
      fetchBalances()
    }
  })

  async function registerWithdrawRequest({
    amount,
    decimals,
    token
  }: {
    amount: string
    decimals: number
    token: Address
  }) {
    if (!contractAddress) throw new Error('Contract not configured')
    const amountRaw = parseUnits(amount || '0', decimals)
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'registerWithdrawRequest',
      args: [amountRaw, token]
    })
    await fetchBalances()
  }

  async function approveWithdrawRequest(id: bigint) {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'approveWithdrawRequest',
      args: [id]
    })
    await fetchBalances()
  }

  async function executeWithdrawRequest(id: bigint) {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'executeWithdrawRequest',
      args: [id]
    })
    await fetchBalances()
  }

  const withdrawRows = useMemo(() => Object.values(rows).sort((a, b) => Number(b.id - a.id)), [rows])

  return {
    withdrawRows,
    registerWithdrawRequest,
    approveWithdrawRequest,
    executeWithdrawRequest,
    balances,
    tokenFormatter: (token: Address, amountRaw: bigint) => {
      const meta = getTokenMeta(token)
      return { ...meta, formatted: formatUnits(amountRaw, meta.decimals) }
    }
  }
}

