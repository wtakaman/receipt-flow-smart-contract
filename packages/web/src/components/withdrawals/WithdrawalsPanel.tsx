import { useState } from 'react'
import type { Address } from 'viem'
import { formatUnits, zeroAddress } from 'viem'
import type { WithdrawRow } from '../../hooks/useWithdrawRequests'
import { getTokenMeta } from '../../config/contracts'
import { shortAddress } from '../../lib/format'

type Props = {
  withdrawAddress: Address
  requiredApprovals: number
  ownersCount: number
  requests: WithdrawRow[]
  supportedTokens: Address[]
  isOwner: boolean
  onRegister: (input: { token: Address; amount: string }) => Promise<void>
  onApprove: (id: bigint) => Promise<void>
  onExecute: (id: bigint) => Promise<void>
}

const defaultForm = { amount: '0.5', token: '' as Address | '' }

export function WithdrawalsPanel({
  withdrawAddress,
  requiredApprovals,
  ownersCount,
  requests,
  supportedTokens,
  isOwner,
  onRegister,
  onApprove,
  onExecute
}: Props) {
  const [form, setForm] = useState(defaultForm)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.amount || !form.token) return
    await onRegister({ amount: form.amount, token: form.token as Address })
    setForm(defaultForm)
  }

  const tokenOptions = supportedTokens.length ? supportedTokens : [zeroAddress]

  return (
    <section className="panel">
      <h2>Withdraw queue</h2>
      <div className="grid split">
        <article className="card">
          <h3>Submit request</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </label>
            <label>
              Token
              <select value={form.token} onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value as Address }))}>
                {tokenOptions.map((token) => (
                  <option key={token} value={token}>
                    {getTokenMeta(token).symbol}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!isOwner}>
              Register & auto-confirm
            </button>
          </form>
          <p className="hint">
            Needs {requiredApprovals} of {ownersCount} owner confirmations. Payout address: {shortAddress(withdrawAddress, 6)}
          </p>
        </article>

        <article className="card table-card">
          <div className="table-header">
            <h3>Requests</h3>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>Confirmations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={6}>No withdraw requests yet.</td>
                  </tr>
                )}
                {requests.map((row) => {
                  const meta = getTokenMeta(row.token)
                  return (
                    <tr key={row.id.toString()}>
                      <td>#{row.id.toString()}</td>
                      <td>{meta.symbol}</td>
                      <td>{formatUnits(row.amountRaw, meta.decimals)}</td>
                      <td>
                        {row.confirmations.length}/{requiredApprovals}
                      </td>
                      <td>
                        <span className={`pill ${row.executed ? 'success' : 'warning'}`}>
                          {row.executed ? 'Executed' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          {!row.executed && (
                            <>
                              <button type="button" disabled={!isOwner} onClick={() => onApprove(row.id)}>
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={!isOwner || row.confirmations.length < requiredApprovals}
                                onClick={() => onExecute(row.id)}
                              >
                                Execute
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  )
}

