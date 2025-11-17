import { useState } from 'react'
import type { Address } from 'viem'

type Props = {
  withdrawAddress?: Address
  pendingAddress?: Address | null
  requiredApprovals: number
  confirmAddress: () => Promise<void>
  proposeAddress: (address: Address) => Promise<void>
  isOwner: boolean
}

export function GovernancePanel({
  withdrawAddress,
  pendingAddress,
  requiredApprovals,
  confirmAddress,
  proposeAddress,
  isOwner
}: Props) {
  const [input, setInput] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input) return
    await proposeAddress(input as Address)
    setInput('')
  }

  return (
    <section className="panel">
      <h2>Withdraw address governance</h2>
      <div className="grid split">
        <article className="card">
          <h3>Current withdraw address</h3>
          <p className="lead">{withdrawAddress ?? '—'}</p>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              New address
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x..." />
            </label>
            <button type="submit" disabled={!isOwner}>
              Propose change
            </button>
          </form>
        </article>
        <article className="card">
          <h3>Pending proposal</h3>
          {pendingAddress ? (
            <>
              <p className="lead">{pendingAddress}</p>
              <p>
                Requires {requiredApprovals} confirmations. Use the button below to confirm as an owner.
              </p>
              <button type="button" onClick={confirmAddress} disabled={!isOwner}>
                Confirm proposal
              </button>
            </>
          ) : (
            <p className="empty">No proposal in flight.</p>
          )}
        </article>
      </div>
    </section>
  )
}

