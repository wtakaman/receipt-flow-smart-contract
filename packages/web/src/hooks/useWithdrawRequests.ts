import { useCallback, useEffect, useState } from 'react'
import { usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { formatUnits, parseUnits, zeroAddress } from 'viem'
import { getTokenMeta, invoiceFlowAbi } from '../config/contracts'
import { shortAddress } from '../lib/format'

export type WithdrawRow = {
  id: bigint
  token: Address
  amountRaw: bigint
  confirmations: Address[]
  executed: boolean
}

export type RegisterWithdrawInput = {
  token: Address
  amount: string
}

export function useWithdrawRequests(contractAddress?: Address) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [requests, setRequests] = useState<WithdrawRow[]>([])

  useEffect(() => {
    if (!publicClient || !contractAddress) return
    let ignore = false
    async function loadExisting() {
      const [registered, approved, executed] = await Promise.all([
        publicClient.getLogs({
          address: contractAddress,
          abi: invoiceFlowAbi,
          eventName: 'WithdrawRequestRegistered',
          fromBlock: 0n
        }),
        publicClient.getLogs({
          address: contractAddress,
          abi: invoiceFlowAbi,
          eventName: 'WithdrawRequestApproved',
          fromBlock: 0n
        }),
        publicClient.getLogs({
          address: contractAddress,
          abi: invoiceFlowAbi,
          eventName: 'WithdrawRequestExecuted',
          fromBlock: 0n
        })
      ])

      if (ignore) return

      const map = new Map<string, WithdrawRow>()
      registered.forEach((log) => {
        const id = (log.args?._id ?? 0n) as bigint
        map.set(id.toString(), {
          id,
          token: (log.args?._token as Address) ?? zeroAddress,
          amountRaw: (log.args?._amount as bigint) ?? 0n,
          confirmations: [],
          executed: Boolean(log.args?._executed)
        })
      })

      approved.forEach((log) => {
        const id = (log.args?._id ?? 0n).toString()
        const approver = (log.args?._approver as Address) ?? zeroAddress
        const entry = map.get(id)
        if (entry && !entry.confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) {
          entry.confirmations = [...entry.confirmations, approver]
        }
      })

      executed.forEach((log) => {
        const id = (log.args?._id ?? 0n).toString()
        const entry = map.get(id)
        if (entry) {
          entry.executed = Boolean(log.args?._executed ?? true)
        }
      })

      setRequests(Array.from(map.values()).sort((a, b) => Number(b.id - a.id)))
    }
    loadExisting()
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
      setRequests((prev) => {
        const map = new Map(prev.map((row) => [row.id.toString(), row]))
        logs.forEach((log) => {
          const id = (log.args?._id ?? 0n) as bigint
          map.set(id.toString(), {
            id,
            token: (log.args?._token as Address) ?? zeroAddress,
            amountRaw: (log.args?._amount as bigint) ?? 0n,
            confirmations: [],
            executed: Boolean(log.args?._executed)
          })
        })
        return Array.from(map.values()).sort((a, b) => Number(b.id - a.id))
      })
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawRequestApproved',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      setRequests((prev) =>
        prev.map((row) => {
          const log = logs.find((entry) => (entry.args?._id ?? 0n) === row.id)
          if (!log) return row
          const approver = (log.args?._approver as Address) ?? zeroAddress
          if (row.confirmations.some((addr) => addr.toLowerCase() === approver.toLowerCase())) return row
          return { ...row, confirmations: [...row.confirmations, approver] }
        })
      )
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawRequestExecuted',
    enabled: Boolean(contractAddress),
    onLogs(logs) {
      setRequests((prev) =>
        prev.map((row) => {
          const log = logs.find((entry) => (entry.args?._id ?? 0n) === row.id)
          if (!log) return row
          return { ...row, executed: Boolean(log.args?._executed ?? true) }
        })
      )
    }
  })

  const registerWithdraw = useCallback(
    async (input: RegisterWithdrawInput) => {
      if (!contractAddress) throw new Error('Contract not configured')
      const tokenMeta = getTokenMeta(input.token)
      const amountRaw = parseUnits(input.amount, tokenMeta.decimals)
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'registerWithdrawRequest',
        args: [amountRaw, input.token]
      })
    },
    [contractAddress, writeContractAsync]
  )

  const approveWithdraw = useCallback(
    async (id: bigint) => {
      if (!contractAddress) throw new Error('Contract not configured')
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'approveWithdrawRequest',
        args: [id]
      })
    },
    [contractAddress, writeContractAsync]
  )

  const executeWithdraw = useCallback(
    async (id: bigint) => {
      if (!contractAddress) throw new Error('Contract not configured')
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'executeWithdrawRequest',
        args: [id]
      })
    },
    [contractAddress, writeContractAsync]
  )

  return {
    requests,
    registerWithdraw,
    approveWithdraw,
    executeWithdraw,
    formatAmount(row: WithdrawRow) {
      const meta = getTokenMeta(row.token)
      return `${formatUnits(row.amountRaw, meta.decimals)} ${meta.symbol}`
    },
    summary(row: WithdrawRow) {
      const meta = getTokenMeta(row.token)
      return `${meta.symbol} • ${shortAddress(row.token)}`
    }
  }
}

