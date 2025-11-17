import { useState } from 'react'
import type { Address } from 'viem'
import { formatUnits, zeroAddress } from 'viem'
import type { ChainInvoice, InvoiceMetrics, RegisterInvoiceInput } from '../../hooks/useInvoices'
import { getTokenMeta } from '../../config/contracts'
import { formatDateFromSeconds, shortAddress } from '../../lib/format'
import { Metric } from '../common/Metric'

type Props = {
  invoices: ChainInvoice[]
  metrics: InvoiceMetrics
  supportedTokens: Address[]
  isOwner: boolean
  onRegister: (input: RegisterInvoiceInput) => Promise<void>
  onRemove: (id: bigint) => Promise<void>
}

const defaultForm = {
  id: '',
  customer: '',
  amount: '',
  token: '' as Address | '',
  expiresInDays: '30'
}

export function InvoiceRegistry({ invoices, metrics, supportedTokens, isOwner, onRegister, onRemove }: Props) {
  const [form, setForm] = useState(defaultForm)

  const tokenOptions = supportedTokens.length ? supportedTokens : [zeroAddress]

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.id || !form.customer || !form.amount || !form.token) return
    await onRegister({
      id: BigInt(form.id),
      customer: form.customer as Address,
      token: form.token as Address,
      amount: form.amount,
      expiresInDays: Number(form.expiresInDays || '30')
    })
    setForm(defaultForm)
  }

  return (
    <section className="panel">
      <h2>Invoices</h2>
      <div className="metrics">
        <Metric label="Open" value={metrics.openCount} />
        <Metric label="Expired" value={metrics.expiredCount} />
        <Metric label="Recent payments" value={metrics.paidCount} />
      </div>

      <div className="grid split">
        <article className="card">
          <h3>Register invoice</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Invoice ID
              <input
                type="number"
                value={form.id}
                onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="e.g. 101"
              />
            </label>
            <label>
              Customer address
              <input
                value={form.customer}
                onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value }))}
                placeholder="0x..."
              />
            </label>
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </label>
            <label>
              Token
              <select
                value={form.token}
                onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value as Address }))}
              >
                {tokenOptions.map((token) => {
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
              <input
                type="number"
                min="1"
                value={form.expiresInDays}
                onChange={(e) => setForm((prev) => ({ ...prev, expiresInDays: e.target.value }))}
              />
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
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6}>No invoices registered.</td>
                  </tr>
                )}
                {invoices.map((invoice) => {
                  const meta = getTokenMeta(invoice.token)
                  return (
                    <tr key={invoice.id.toString()}>
                      <td>#{invoice.id.toString()}</td>
                      <td>{shortAddress(invoice.customer)}</td>
                      <td>{meta.symbol}</td>
                      <td>{formatUnits(invoice.amountRaw, meta.decimals)}</td>
                      <td>{formatDateFromSeconds(invoice.expiration)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" disabled={!isOwner} onClick={() => onRemove(invoice.id)}>
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

