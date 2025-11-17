import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { zeroAddress, formatUnits } from 'viem'
import { getTokenMeta } from '../../config/contracts'
import type { ChainInvoice } from '../../types/invoice'
import { Metric } from '../common/Metric'
type Metrics = {
  openCount: number
  expiredCount: number
  paidCount: number
}

type Props = {
  isOwner: boolean
  supportedTokens: Address[]
  invoices: ChainInvoice[]
  metrics: Metrics
  onRegisterInvoice: (params: {
    id: bigint
    customer: Address
    token: Address
    amount: string
    decimals: number
    expiresInDays: number
  }) => Promise<void>
  onRemoveInvoice: (id: bigint) => Promise<void>
}

export function InvoicesPanel({
  isOwner,
  supportedTokens,
  invoices,
  metrics,
  onRegisterInvoice,
  onRemoveInvoice
}: Props) {
  const defaultToken = supportedTokens[0] ?? zeroAddress
  const [form, setForm] = useState({
    id: '',
    customer: '',
    amount: '',
    token: defaultToken,
    expiresInDays: '30'
  })

  useEffect(() => {
    setForm((prev) => ({ ...prev, token: supportedTokens[0] ?? zeroAddress }))
  }, [supportedTokens])

  const sortedInvoices = useMemo(() => invoices.sort((a, b) => Number(b.id - a.id)), [invoices])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.id || !form.customer) return
    const tokenMeta = getTokenMeta(form.token)
    await onRegisterInvoice({
      id: BigInt(form.id),
      customer: form.customer as Address,
      token: form.token,
      amount: form.amount || '0',
      decimals: tokenMeta.decimals,
      expiresInDays: Number(form.expiresInDays || '30')
    })
    setForm({ ...form, id: '', customer: '', amount: '' })
  }

  return (
    <section className="panel">
      <h2>Invoices</h2>
      <div className="metrics">
        <Metric label="Open invoices" value={metrics.openCount} />
        <Metric label="Expired" value={metrics.expiredCount} />
        <Metric label="Paid (recent)" value={metrics.paidCount} />
      </div>
      <div className="grid split">
        <article className="card">
          <h3>Register invoice</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Invoice ID
              <input type="number" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="e.g. 101" />
            </label>
            <label>
              Customer address
              <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="0x..." />
            </label>
            <label>
              Amount
              <input type="number" min="0" step="0.0001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label>
              Token
              <select value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value as Address })}>
                {(supportedTokens.length ? supportedTokens : [zeroAddress]).map((token) => {
                  const meta = getTokenMeta(token)
                  return (
                    <option key={token} value={token}>
                      {meta.symbol} ({shortAddress(token)})
                    </option>
                  )
                })}
              </select>
            </label>
            <label>
              Expires in (days)
              <input type="number" min="1" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })} />
            </label>
            <button type="submit" disabled={!isOwner}>
              Register
            </button>
          </form>
        </article>

        <article className="card table-card">
          <h3>Open invoices</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>Expiration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6}>No invoices registered.</td>
                  </tr>
                )}
                {sortedInvoices.map((invoice) => {
                  const meta = getTokenMeta(invoice.token)
                  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)
                  const expiration =
                    invoice.expiration === 0n ? '—' : new Date(Number(invoice.expiration) * 1000).toLocaleDateString()
                  return (
                    <tr key={invoice.id.toString()}>
                      <td>#{invoice.id.toString()}</td>
                      <td>{shortAddress(invoice.customer)}</td>
                      <td>{meta.symbol}</td>
                      <td>{amountDisplay}</td>
                      <td>{expiration}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" disabled={!isOwner} onClick={() => onRemoveInvoice(invoice.id)}>
                            Remove
                          </button>
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

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

function formatAmount(value: bigint, decimals: number) {
  const units = Number(formatUnits(value, decimals))
  return units.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

