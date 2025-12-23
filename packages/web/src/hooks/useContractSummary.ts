import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { invoiceFlowAbi } from '../config/contracts'

export function useContractSummary(contractAddress?: Address) {
  const summaryQuery = useReadContract({
    address: contractAddress,
    abi: invoiceFlowAbi,
    functionName: 'getSummary',
    query: { enabled: Boolean(contractAddress) }
  })

  const tuple = summaryQuery.data as [Address[], Address[], Address, bigint] | undefined
  const owners = tuple?.[0] ?? []
  const supportedTokens = tuple?.[1] ?? []
  const withdrawAddress = tuple?.[2] ?? ('0x0000000000000000000000000000000000000000' as Address)
  const requiredApprovals = tuple ? Number(tuple[3] ?? 0n) : 0

  return {
    owners,
    supportedTokens,
    withdrawAddress,
    requiredApprovals,
    refetch: summaryQuery.refetch,
    isLoading: summaryQuery.isLoading
  }
}

