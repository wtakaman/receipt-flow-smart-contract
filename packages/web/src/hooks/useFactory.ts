import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { useChainId, useReadContract, useWatchContractEvent, useWriteContract } from 'wagmi'
import { getExtraContracts, getFactoryAddress, invoiceFactoryAbi, normalizeAddressInput } from '../config/contracts'

export type CreateContractParams = {
  owners: Address[]
  withdrawAddress: Address
  acceptedTokens: Address[]
  requiredApprovals: number
}

export function useFactory() {
  const chainId = useChainId()
  const factoryAddress = getFactoryAddress(chainId)
  const { writeContractAsync, isPending: isCreating } = useWriteContract()

  const { data, refetch, isFetching } = useReadContract({
    address: factoryAddress,
    abi: invoiceFactoryAbi,
    functionName: 'getDeployedInvoiceFlowContracts',
    query: { enabled: Boolean(factoryAddress) }
  })

  const deployedContracts = useMemo(() => (data as Address[] | undefined) ?? [], [data])
  const extraContracts = useMemo(() => getExtraContracts(chainId), [chainId])
  const allContracts = useMemo(() => {
    const merged = [...deployedContracts, ...extraContracts]
    return Array.from(
      new Set(
        merged
          .map((addr) => normalizeAddressInput(addr))
          .filter((addr): addr is Address => Boolean(addr))
      )
    )
  }, [deployedContracts, extraContracts])

  useWatchContractEvent({
    address: factoryAddress,
    abi: invoiceFactoryAbi,
    eventName: 'NewInvoiceFlowContract',
    enabled: Boolean(factoryAddress),
    poll: false,
    onLogs() {
      refetch()
    }
  })

  const createContract = useCallback(
    async ({ owners, withdrawAddress, acceptedTokens, requiredApprovals }: CreateContractParams) => {
      if (!factoryAddress) throw new Error('Factory not configured')
      await writeContractAsync({
        address: factoryAddress,
        abi: invoiceFactoryAbi,
        functionName: 'createInvoiceFlowContract',
        args: [owners, withdrawAddress, acceptedTokens, requiredApprovals]
      })
      await refetch()
    },
    [factoryAddress, refetch, writeContractAsync]
  )

  return {
    chainId,
    factoryAddress,
    deployedContracts,
    extraContracts,
    allContracts,
    isFetchingContracts: isFetching,
    isCreating,
    refetchContracts: refetch,
    createContract
  }
}


