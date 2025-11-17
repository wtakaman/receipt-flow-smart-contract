import type { Address } from 'viem'

export type ChainInvoice = {
  id: bigint
  customer: Address
  token: Address
  amountRaw: bigint
  expiration: bigint
}

export type WithdrawRow = {
  id: bigint
  token: Address
  amountRaw: bigint
  confirmations: Address[]
  executed: boolean
}

export type EventEntry = {
  title: string
  subtitle: string
  timestamp: number
}

