import { useState } from 'react'
import type { Address } from 'viem'
import { zeroAddress, formatUnits } from 'viem'
import { getTokenMeta } from '../../config/contracts'
import type { WithdrawRow } from '../../types/invoice'

type Props = {
  isOwner: boolean
  supportedTokens: Address[]
  requiredApprovals: number
  ownersCount: number
  withdrawAddress?: Address
  withdrawRows: WithdrawRow[]
  balances: Record<string, { raw: bigint; formatted: string; symbol: string }>
  registerWithdraw: (args: { token: Address; amount: string; decimals: number }) => Promise<void>
  approveWithdraw: (id: bigint) => Promise<void>
  executeWithdraw: (id: bigint) => Promise<void>
}

export function WithdrawalsPanel({
  isOwner,
  supportedTokens,
  requiredApprovals,
  ownersCount,
  withdrawAddress,
  withdrawRows,
  balances,
  registerWithdraw,
  approveWithdraw,
  executeWithdraw
}: Props) {
  const [form, setForm] = useState({ amount: '0.5', token: supportedTokens[0] ?? zeroAddress })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const tokenMeta = getTokenMeta(form.token)
    await registerWithdraw({ token: form.token, amount: form.amount, decimals: tokenMeta.decimals })
  }

  return (
    <section className="panel">
      <h2>Withdraw queue</h2>
      <p className="section-lead">Register payouts, track confirmations, and execute once approved.</p>
      
      <div className="grid two-col">
        <article className="card">
          <h3>New request</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Amount
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label>
              Token
              <select value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value as Address })}>
                {(supportedTokens.length ? supportedTokens : [zeroAddress]).map((token) => {
                  const meta = getTokenMeta(token)
                  return (
                    <option key={token} value={token}>
                      {meta.symbol}
                    </option>
                  )
                })}
              </select>
            </label>
            <button type="submit" disabled={!isOwner}>
              Register & auto-confirm
            </button>
          </form>
          <p className="hint">
            Needs {requiredApprovals} of {ownersCount} owners. Current withdraw address: {withdrawAddress ? shortAddress(withdrawAddress) : '—'}
          </p>
        </article>
        <article className="card">
          <h3>Contract balances</h3>
          {supportedTokens.length === 0 && <p className="empty">No supported tokens.</p>}
          {supportedTokens.length > 0 && (
            <ul className="details" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {supportedTokens.map((token) => {
                const meta = getTokenMeta(token)
                const b = balances[token.toLowerCase()]
                const formatted = b?.formatted ?? '0'
                return (
                  <li key={token} style={{ padding: '0.35rem 0' }}>
                    <div className="label">{meta.symbol}</div>
                    <div className="value">
                      {formatted} {meta.symbol}
                    </div>
                    <div className="muted mono">{token}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </div>

      <article className="card table-card" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Withdraw requests</h3>
          <span className="hint">{withdrawRows.length} request{withdrawRows.length !== 1 ? 's' : ''}</span>
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
              {withdrawRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">No withdraw requests yet.</td>
                </tr>
              )}
              {withdrawRows.map((row) => {
                const meta = getTokenMeta(row.token)
                const formatted = formatUnits(row.amountRaw, meta.decimals)
                return (
                  <tr key={row.id.toString()}>
                    <td>#{row.id.toString()}</td>
                    <td>{meta.symbol}</td>
                    <td>
                      {Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} {meta.symbol}
                    </td>
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
                            <button type="button" disabled={!isOwner} onClick={() => approveWithdraw(row.id)}>
                              Approve
                            </button>
                            <button type="button" disabled={!isOwner || row.confirmations.length < requiredApprovals} onClick={() => executeWithdraw(row.id)}>
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
    </section>
  )
}

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

