import { useState } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import type { CreateContractParams } from '../../hooks/useFactory'

type Props = {
  defaultOwner?: Address
  onCreate: (params: CreateContractParams) => Promise<void>
  isSubmitting: boolean
}

export function CreateContractForm({ defaultOwner, onCreate, isSubmitting }: Props) {
  const [ownersText, setOwnersText] = useState(defaultOwner ?? '')
  const [withdrawAddress, setWithdrawAddress] = useState<Address | ''>(defaultOwner ?? '')
  const [tokensText, setTokensText] = useState('') // comma-separated
  const [requiredApprovals, setRequiredApprovals] = useState('1')
  const [info, setInfo] = useState<string | null>(null)

  function parseAddresses(value: string) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) as Address[]
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const owners = parseAddresses(ownersText || '')
    if (!owners.length) {
      setInfo('Add at least one owner address.')
      return
    }
    const tokens = parseAddresses(tokensText || '').filter(Boolean)
    const acceptedTokens = tokens.length ? tokens : [zeroAddress]
    await onCreate({
      owners,
      withdrawAddress: (withdrawAddress || owners[0]) as Address,
      acceptedTokens,
      requiredApprovals: Number(requiredApprovals || '1')
    })
    setInfo('Create transaction sent.')
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Owners (comma-separated)
        <input
          placeholder="0xabc...,0xdef..."
          value={ownersText}
          onChange={(e) => setOwnersText(e.target.value)}
        />
      </label>
      <label>
        Withdraw address
        <input
          placeholder="0x..."
          value={withdrawAddress}
          onChange={(e) => setWithdrawAddress(e.target.value as Address)}
        />
      </label>
      <label>
        Accepted tokens (comma-separated, empty = ETH)
        <input placeholder="0xToken1,0xToken2" value={tokensText} onChange={(e) => setTokensText(e.target.value)} />
      </label>
      <label>
        Required approvals
        <input type="number" min="1" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create contract'}
      </button>
      {info && <p className="hint">{info}</p>}
    </form>
  )
}


