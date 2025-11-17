import type { Abi, Address } from 'viem'
import { zeroAddress } from 'viem'
import invoiceFlowArtifact from '../../../contracts/artifacts/contracts/InvoiceFlowContract.sol/InvoiceFlowContract.json'

type TokenMeta = {
  symbol: string
  decimals: number
  isNative?: boolean
}

export const invoiceFlowAbi = invoiceFlowArtifact.abi as Abi

const env = import.meta.env

export const tokenMetadata: Record<string, TokenMeta> = {
  [zeroAddress.toLowerCase()]: { symbol: 'ETH', decimals: 18, isNative: true },
  // Example ERC-20 entry (update to match your deployment)
  [env.VITE_SAMPLE_ERC20_ADDRESS?.toLowerCase() ?? '0x829432ef1471e34c5499f2f9a11d3e34d4056553'.toLowerCase()]: {
    symbol: env.VITE_SAMPLE_ERC20_SYMBOL ?? 'TTK',
    decimals: Number(env.VITE_SAMPLE_ERC20_DECIMALS ?? 18)
  }
}

const addressBook: Partial<Record<number, Address>> = {
  11155111: env.VITE_SEPOLIA_INVOICE_FLOW_ADDRESS as Address | undefined,
  80001: env.VITE_MUMBAI_INVOICE_FLOW_ADDRESS as Address | undefined,
  31337: env.VITE_HARDHAT_INVOICE_FLOW_ADDRESS as Address | undefined
}

export function getInvoiceContractAddress(chainId?: number): Address | undefined {
  if (chainId && addressBook[chainId]) return addressBook[chainId]
  return addressBook[11155111]
}

export function getTokenMeta(address: Address | string | undefined): TokenMeta {
  if (!address) return { symbol: 'TOKEN', decimals: 18 }
  return tokenMetadata[address.toLowerCase()] ?? { symbol: 'TOKEN', decimals: 18 }
}

