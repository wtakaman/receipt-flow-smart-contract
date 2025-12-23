import { useChainId, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { invoiceFlowAbi } from '../config/contracts'

type SummaryOptions = {
  enablePolling?: boolean
  refetchIntervalMs?: number
  staleTime?: number
}

export function useInvoiceSummary(contractAddressOverride?: Address, options?: SummaryOptions) {
  const chainId = useChainId()
  const contractAddress = contractAddressOverride
  const enablePolling = options?.enablePolling ?? true
  const refetchIntervalMs = options?.refetchIntervalMs ?? 120000

  const { data, refetch, isLoading } = useReadContract({
    address: contractAddress,
    abi: invoiceFlowAbi,
    functionName: 'getSummary',
    query: {
      enabled: Boolean(contractAddress),
      refetchInterval: enablePolling ? refetchIntervalMs : false,
      staleTime: options?.staleTime
    }
  })

  const [owners, supportedTokens, withdrawAddress, requiredApprovalsRaw] = (data as [
    Address[],
    Address[],
    Address,
    bigint
  ]) || [[], [], undefined, 0n]

  const requiredApprovals = Number(requiredApprovalsRaw)

  return {
    chainId,
    contractAddress,
    owners,
    supportedTokens,
    withdrawAddress,
    requiredApprovals,
    refetchSummary: refetch,
    isLoadingSummary: isLoading
  }
}

