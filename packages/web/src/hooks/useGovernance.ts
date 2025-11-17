import { useState } from 'react'
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
    onLogs() {
      setPendingAddress(null)
      onSummaryChange?.()
    }
  })

  async function proposeAddress(address: Address) {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'changeWithdrawAddressRequest',
      args: [address]
    })
  }

  async function confirmAddress() {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'confirmWithdrawAddressChange'
    })
    onSummaryChange?.()
  }

  return {
    pendingAddress,
    proposeAddress,
    confirmAddress
  }
}
import { useCallback } from 'react'
import { useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { invoiceFlowAbi } from '../config/contracts'

export function useGovernance(contractAddress?: Address) {
  const { writeContractAsync } = useWriteContract()

  const proposeWithdrawAddress = useCallback(
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

  const confirmWithdrawAddress = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not configured')
    await writeContractAsync({
      address: contractAddress,
      abi: invoiceFlowAbi,
      functionName: 'confirmWithdrawAddressChange'
    })
  }, [contractAddress, writeContractAsync])

  return {
    proposeWithdrawAddress,
    confirmWithdrawAddress
  }
}

