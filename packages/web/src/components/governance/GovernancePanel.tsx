import { useState } from 'react'
import type { Address } from 'viem'
import { shortAddress } from '../../lib/format'

type Props = {
  withdrawAddress: Address
  requiredApprovals: number
  isOwner: boolean
  onPropose: (address: Address) => Promise<void>
  onConfirm: () => Promise<void>
}

export function GovernancePanel({ withdrawAddress, requiredApprovals, isOwner, onPropose, onConfirm }: Props) {
  const [proposal, setProposal] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  async function handlePropose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!proposal) return
    try {
      await onPropose(proposal as Address)
      setProposal('')
      setStatus('Proposal submitted')
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  async function handleConfirm() {
    try {
      await onConfirm()
      setStatus('Confirmation submitted')
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  return (
    <section className="panel">
      <h2>Withdraw address governance</h2>
      <div className="grid split">
        <article className="card">
          <h3>Current address</h3>
          <p className="lead">{withdrawAddress}</p>
          <form className="form" onSubmit={handlePropose}>
            <label>
              New address
              <input value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="0x..." />
            </label>
            <button type="submit" disabled={!isOwner}>
              Propose change
            </button>
          </form>
          {status && <p className="banner info">{status}</p>}
        </article>
        <article className="card">
          <h3>Confirmations</h3>
          <p>
            Requires {requiredApprovals} owner approvals for a new withdraw address. Use the button below once a proposal exists on-chain.
          </p>
          <button type="button" disabled={!isOwner} onClick={handleConfirm}>
            Confirm proposal
          </button>
          <p className="hint">Current payout: {shortAddress(withdrawAddress, 6)}</p>
        </article>
      </div>
    </section>
  )
}

