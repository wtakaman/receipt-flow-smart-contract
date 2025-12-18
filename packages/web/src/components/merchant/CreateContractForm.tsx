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
  const [ownersList, setOwnersList] = useState<string[]>([defaultOwner ?? ''])
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

  function addOwner() {
    setOwnersList([...ownersList, ''])
  }

  function removeOwner(index: number) {
    // Cannot remove the first owner (connected wallet) or if only one owner remains
    if (index === 0 || ownersList.length <= 1) return
    setOwnersList(ownersList.filter((_, i) => i !== index))
  }

  function updateOwner(index: number, value: string) {
    // Cannot edit the first owner (connected wallet)
    if (index === 0) return
    const updated = [...ownersList]
    updated[index] = value
    setOwnersList(updated)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const owners = ownersList.map((o) => o.trim()).filter(Boolean) as Address[]
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
      <fieldset className="owners-fieldset">
        <legend>Owners (withdraw approvers)</legend>
        <span className="hint">These addresses can manage invoices and approve withdrawals</span>
        <div className="owners-list">
          {ownersList.map((owner, index) => {
            const isConnectedWallet = index === 0
            return (
              <div key={index} className={`owner-row ${isConnectedWallet ? 'locked' : ''}`}>
                <span className="owner-index">{index + 1}</span>
                <input
                  type="text"
                  placeholder="0x..."
                  value={owner}
                  onChange={(e) => updateOwner(index, e.target.value)}
                  readOnly={isConnectedWallet}
                  className={isConnectedWallet ? 'readonly' : ''}
                />
                {isConnectedWallet ? (
                  <span className="owner-badge" title="Connected wallet (cannot be removed)">You</span>
                ) : (
                  <button
                    type="button"
                    className="btn-icon remove"
                    onClick={() => removeOwner(index)}
                    title="Remove owner"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" className="btn-add-owner" onClick={addOwner}>
          + Add owner
        </button>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Withdraw settings</legend>
        <label>
          Withdraw address
          <input
            placeholder="0x..."
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value as Address)}
          />
          <span className="hint">Where funds will be sent when withdrawals are executed</span>
        </label>
        <label>
          Required approvals
          <input type="number" min="1" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
          <span className="hint">How many owners must approve each withdrawal (e.g., 2 of 3 owners)</span>
        </label>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Accepted tokens</legend>
        <label>
          Token addresses (comma-separated)
          <input placeholder="0xToken1, 0xToken2" value={tokensText} onChange={(e) => setTokensText(e.target.value)} />
          <span className="hint">Leave empty to accept ETH only. Add ERC-20 contract addresses to accept tokens.</span>
        </label>
      </fieldset>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create contract'}
      </button>
      {info && <p className="hint">{info}</p>}
    </form>
  )
}


