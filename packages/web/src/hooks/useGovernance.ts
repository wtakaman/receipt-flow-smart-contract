import { useCallback, useState } from 'react'
import { useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { invoiceFlowAbi } from '../config/contracts'

export function useGovernance(contractAddress?: Address, onSummaryChange?: () => void) {
  const { writeContractAsync } = useWriteContract()
  const [pendingAddress, setPendingAddress] = useState<Address | null>(null)
  const eventsEnabled = Boolean(contractAddress)

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawAddressChangeRequested',
    enabled: eventsEnabled,
    poll: false,
    onLogs([log]) {
      const next = (log as { args?: { _newAddress?: Address } })?.args?._newAddress as Address | undefined
      setPendingAddress(next ?? null)
      onSummaryChange?.()
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawAddressChanged',
    enabled: eventsEnabled,
    poll: false,
    onLogs() {
      setPendingAddress(null)
      onSummaryChange?.()
    }
  })

  const proposeAddress = useCallback(
    async (address: Address) => {
      if (!contractAddress) throw new Error('Contract not configured')
      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'changeWithdrawAddressRequest',
        args: [address]
      })
    },
    [contractAddress, writeContractAsync]
  )

  const confirmAddress = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'confirmWithdrawAddressChange'
    })
    onSummaryChange?.()
  }, [contractAddress, onSummaryChange, writeContractAsync])

  return {
    pendingAddress,
    proposeAddress,
    confirmAddress
  }
}


