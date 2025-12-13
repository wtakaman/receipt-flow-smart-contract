import { useEffect, useMemo, useState } from 'react'
import { usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { formatUnits, parseUnits, zeroAddress } from 'viem'
import { getTokenMeta, invoiceFlowAbi } from '../config/contracts'
import type { WithdrawRow } from '../types/invoice'

export function useWithdrawals(contractAddress?: Address) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [rows, setRows] = useState<Record<string, WithdrawRow>>({})

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
  }

  async function approveWithdrawRequest(id: bigint) {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'approveWithdrawRequest',
      args: [id]
    })
  }

  async function executeWithdrawRequest(id: bigint) {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'executeWithdrawRequest',
      args: [id]
    })
  }

  const withdrawRows = useMemo(() => Object.values(rows).sort((a, b) => Number(b.id - a.id)), [rows])

  return {
    withdrawRows,
    registerWithdrawRequest,
    approveWithdrawRequest,
    executeWithdrawRequest,
    tokenFormatter: (token: Address, amountRaw: bigint) => {
      const meta = getTokenMeta(token)
      return { ...meta, formatted: formatUnits(amountRaw, meta.decimals) }
    }
  }
}

