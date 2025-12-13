import { useChainId, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { getInvoiceContractAddress, invoiceFlowAbi } from '../config/contracts'

export function useInvoiceSummary(contractAddressOverride?: Address) {
  const chainId = useChainId()
  const contractAddress = contractAddressOverride ?? getInvoiceContractAddress(chainId)

  const { data, refetch, isLoading } = useReadContract({
    address: contractAddress,
    abi: invoiceFlowAbi,
    functionName: 'getSummary',
    query: { enabled: Boolean(contractAddress) }
  })

  const owners = (data?.[0] as Address[]) ?? []
  const supportedTokens = (data?.[1] as Address[]) ?? []
  const withdrawAddress = (data?.[2] as Address) ?? undefined
  const requiredApprovals = data ? Number(data[3] ?? 0n) : 0

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

