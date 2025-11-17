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

  const owners = (summaryQuery.data?.[0] as Address[]) ?? []
  const supportedTokens = (summaryQuery.data?.[1] as Address[]) ?? []
  const withdrawAddress = (summaryQuery.data?.[2] as Address) ?? ('0x0000000000000000000000000000000000000000' as Address)
  const requiredApprovals = summaryQuery.data ? Number(summaryQuery.data[3] ?? 0n) : 0

  return {
    owners,
    supportedTokens,
    withdrawAddress,
    requiredApprovals,
    refetch: summaryQuery.refetch,
    isLoading: summaryQuery.isLoading
  }
}

