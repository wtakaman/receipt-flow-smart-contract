import type { Abi, Address } from 'viem'
import { getAddress, zeroAddress } from 'viem'
import invoiceFlowArtifact from '../../../contracts/artifacts/contracts/InvoiceFlowContract.sol/InvoiceFlowContract.json'
import invoiceFlowFactoryArtifact from '../../../contracts/artifacts/contracts/InvoiceFlowContractFactory.sol/InvoiceFlowContractFactory.json'

type TokenMeta = {
  name?: string
  symbol: string
  decimals: number
  isNative?: boolean
}

export const invoiceFlowAbi = invoiceFlowArtifact.abi as Abi
export const invoiceFactoryAbi = invoiceFlowFactoryArtifact.abi as Abi
export const receiptNftAbi = [
  {
    name: 'getReceipt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'invoiceContract', type: 'address' },
          { name: 'invoiceId', type: 'uint256' },
          { name: 'payer', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'paidAt', type: 'uint256' }
        ]
      }
    ]
  }
] as const

const env = import.meta.env

export function normalizeAddressInput(value?: string): Address | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('<')) return undefined
  try {
    return getAddress(trimmed)
  } catch {
    return undefined
  }
}

export const tokenMetadata: Record<string, TokenMeta> = {
  [zeroAddress.toLowerCase()]: { name: 'Ether', symbol: 'ETH', decimals: 18, isNative: true },
  // Example ERC-20 entry (update to match your deployment)
  [env.VITE_SAMPLE_ERC20_ADDRESS?.toLowerCase() ?? '0x829432ef1471e34c5499f2f9a11d3e34d4056553'.toLowerCase()]: {
    name: env.VITE_SAMPLE_ERC20_NAME ?? 'Sample Token',
    symbol: env.VITE_SAMPLE_ERC20_SYMBOL ?? 'TTK',
    decimals: Number(env.VITE_SAMPLE_ERC20_DECIMALS ?? 18)
  },
  // TakaCoin (TKC) - add your deployed address here or via env
  [env.VITE_TAKACOIN_ADDRESS?.toLowerCase() ?? '']: {
    name: 'TakaCoin',
    symbol: 'TKC',
    decimals: 18
  }
}

// Cache for dynamically fetched token metadata
const dynamicTokenCache: Record<string, TokenMeta> = {}

export function addTokenMeta(address: Address | string, meta: TokenMeta) {
  dynamicTokenCache[address.toLowerCase()] = meta
}

const addressBook: Partial<Record<number, Address>> = {
  11155111: normalizeAddressInput(env.VITE_SEPOLIA_INVOICE_FLOW_ADDRESS),
  80001: normalizeAddressInput(env.VITE_MUMBAI_INVOICE_FLOW_ADDRESS),
  31337: normalizeAddressInput(env.VITE_HARDHAT_INVOICE_FLOW_ADDRESS)
}

const factoryAddressBook: Partial<Record<number, Address>> = {
  11155111: normalizeAddressInput(env.VITE_SEPOLIA_FACTORY_ADDRESS),
  80001: normalizeAddressInput(env.VITE_MUMBAI_FACTORY_ADDRESS),
  31337: normalizeAddressInput(env.VITE_HARDHAT_FACTORY_ADDRESS)
}

const receiptNftAddressBook: Partial<Record<number, Address>> = {
  11155111: normalizeAddressInput(env.VITE_SEPOLIA_RECEIPT_NFT_ADDRESS),
  80001: normalizeAddressInput(env.VITE_MUMBAI_RECEIPT_NFT_ADDRESS),
  31337: normalizeAddressInput(env.VITE_HARDHAT_RECEIPT_NFT_ADDRESS)
}

function parseAddressList(value?: string): Address[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => normalizeAddressInput(v.trim()))
    .filter((v): v is Address => Boolean(v))
}

const extraContractsByChain: Partial<Record<number, Address[]>> = {
  11155111: parseAddressList(env.VITE_SEPOLIA_EXTRA_CONTRACTS),
  80001: parseAddressList(env.VITE_MUMBAI_EXTRA_CONTRACTS),
  31337: parseAddressList(env.VITE_HARDHAT_EXTRA_CONTRACTS)
}

export function getInvoiceContractAddress(chainId?: number): Address | undefined {
  if (chainId && addressBook[chainId]) return addressBook[chainId]
  return addressBook[11155111]
}

export function getFactoryAddress(chainId?: number): Address | undefined {
  if (chainId && factoryAddressBook[chainId]) return factoryAddressBook[chainId]
  return factoryAddressBook[11155111]
}

export function getReceiptNftAddress(chainId?: number): Address | undefined {
  if (chainId && receiptNftAddressBook[chainId]) return receiptNftAddressBook[chainId]
  return receiptNftAddressBook[11155111]
}

export function getExtraContracts(chainId?: number): Address[] {
  if (chainId && extraContractsByChain[chainId]) return extraContractsByChain[chainId] ?? []
  return extraContractsByChain[11155111] ?? []
}

export function getTokenMeta(address: Address | string | undefined): TokenMeta {
  if (!address) return { name: 'Ether', symbol: 'ETH', decimals: 18, isNative: true }
  const key = address.toLowerCase()
  // Check static metadata first
  const staticMeta = tokenMetadata[key]
  if (staticMeta && staticMeta.symbol && staticMeta.symbol.trim() !== '') {
    return staticMeta
  }
  // Check dynamic cache
  const dynamicMeta = dynamicTokenCache[key]
  if (dynamicMeta && dynamicMeta.symbol && dynamicMeta.symbol.trim() !== '') {
    return dynamicMeta
  }
  // Fallback for unknown tokens
  return { name: 'Unknown Token', symbol: '???', decimals: 18 }
}

