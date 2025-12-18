import { useCallback, useState } from 'react'
import { useWatchContractEvent, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { invoiceFlowAbi } from '../config/contracts'

export function useGovernance(contractAddress?: Address, onSummaryChange?: () => void) {
  const { writeContractAsync } = useWriteContract()
  const [pendingAddress, setPendingAddress] = useState<Address | null>(null)

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawAddressChangeRequested',
    enabled: Boolean(contractAddress),
    poll: true,
    pollingInterval: 120000,
    onLogs([log]) {
      setPendingAddress((log?.args?._newAddress as Address) ?? null)
      onSummaryChange?.()
    }
  })

  useWatchContractEvent({
    address: contractAddress,
    abi: invoiceFlowAbi,
    eventName: 'WithdrawAddressChanged',
    enabled: Boolean(contractAddress),
    poll: true,
    pollingInterval: 120000,
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


