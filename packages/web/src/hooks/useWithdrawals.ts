import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { erc20Abi, formatUnits, parseUnits, zeroAddress } from 'viem'
import { getTokenMeta, invoiceFlowAbi } from '../config/contracts'
import type { WithdrawRow } from '../types/invoice'

type BalanceEntry = {
  raw: bigint
  formatted: string
  symbol: string
}

export function useWithdrawals(contractAddress?: Address, supportedTokens?: Address[]) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [rows, setRows] = useState<Record<string, WithdrawRow>>({})
  const [balances, setBalances] = useState<Record<string, BalanceEntry>>({})

  const fetchBalances = useCallback(async () => {
    if (!publicClient || !contractAddress) return
    if (!supportedTokens || supportedTokens.length === 0) {
      setBalances({})
      return
    }
    try {
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
  }, [publicClient, contractAddress, supportedTokens])

  useEffect(() => {
    if (!publicClient || !contractAddress) return
    let ignore = false
    ;(async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        const fromBlock = latest > 9n ? latest - 9n : 0n

        const [registered, approved, executed] = await Promise.all([
          publicClient.getLogs({
            address: contractAddress,
            abi: invoiceFlowAbi,
            eventName: 'WithdrawRequestRegistered',
            fromBlock,
            toBlock: latest
          }),
          publicClient.getLogs({
            address: contractAddress,
            abi: invoiceFlowAbi,
            eventName: 'WithdrawRequestApproved',
            fromBlock,
            toBlock: latest
          }),
          publicClient.getLogs({
            address: contractAddress,
            abi: invoiceFlowAbi,
            eventName: 'WithdrawRequestExecuted',
            fromBlock,
            toBlock: latest
          })
        ])

      if (ignore) return
      const map: Record<string, WithdrawRow> = {}
        registered.forEach((log) => {
          const id = (log.args?._id ?? 0n) as bigint
          map[id.toString()] = {
            id,
            token: (log.args?._token as Address) ?? zeroAddress,
            amountRaw: (log.args?._amount as bigint) ?? 0n,
            confirmations: [],
            executed: Boolean(log.args?._executed)
          }
        })
        approved.forEach((log) => {
          const id = (log.args?._id ?? 0n).toString()
          const approver = (log.args?._approver as Address) ?? zeroAddress
          if (!map[id]) return
          if (!map[id].confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) {
            map[id].confirmations = [...map[id].confirmations, approver]
          }
        })
        executed.forEach((log) => {
          const id = (log.args?._id ?? 0n).toString()
          if (map[id]) map[id].executed = Boolean(log.args?._executed ?? true)
        })
        setRows(map)
      } catch (err) {
        console.warn('Unable to fetch withdraw history (limited range).', err)
      }
    })()

    return () => {
      ignore = true
    }
  }, [publicClient, contractAddress])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawRequestRegistered',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          const id = (log.args?._id ?? 0n).toString()
          next[id] = {
            id: (log.args?._id ?? 0n) as bigint,
            token: (log.args?._token as Address) ?? zeroAddress,
            amountRaw: (log.args?._amount as bigint) ?? 0n,
            confirmations: [],
            executed: Boolean(log.args?._executed)
          }
        })
        return next
      })
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawRequestApproved',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          const id = (log.args?._id ?? 0n).toString()
          const approver = (log.args?._approver as Address) ?? zeroAddress
          if (!next[id]) return
          if (!next[id].confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) {
            next[id].confirmations = [...next[id].confirmations, approver]
          }
        })
        return next
      })
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawRequestExecuted',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      setRows((prev) => {
        const next = { ...prev }
        logs.forEach((log) => {
          const id = (log.args?._id ?? 0n).toString()
          if (next[id]) next[id].executed = Boolean(log.args?._executed ?? true)
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

