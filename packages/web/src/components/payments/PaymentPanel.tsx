import { useState } from 'react'
import type { ChainInvoice } from '../../types/invoice'
import type { EventEntry } from '../../types/events'
import { getTokenMeta } from '../../config/contracts'
import { formatUnits } from 'viem'
import { shortAddress } from '../../lib/format'
import { EventFeed } from '../common/EventFeed'

type Props = {
  invoices: ChainInvoice[]
  onPay: (invoice: ChainInvoice) => Promise<void>
  events: EventEntry[]
  isConnected: boolean
}

export function PaymentPanel({ invoices, onPay, events, isConnected }: Props) {
  const [invoiceId, setInvoiceId] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const selectedInvoice =
    invoiceId && invoices.length ? invoices.find((invoice) => invoice.id === BigInt(invoiceId)) : undefined

  async function handlePay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedInvoice) {
      setStatus('Invoice not found')
      return
    }
    if (!isConnected) {
      setStatus('Connect a wallet to pay')
      return
    }
    try {
      await onPay(selectedInvoice)
      setStatus(`Invoice #${selectedInvoice.id.toString()} payment submitted`)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  return (
    <section className="panel">
      <h2>Customer payment</h2>
      <div className="grid split">
        <article className="card">
          <h3>Lookup invoice</h3>
          <form className="form" onSubmit={handlePay}>
            <label>
              Invoice ID
              <input type="number" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
            </label>
            <button type="submit" disabled={!isConnected}>
              Pay invoice
            </button>
            {status && <p className="banner info">{status}</p>}
          </form>
        </article>
        <article className="card">
          <h3>Invoice details</h3>
          {selectedInvoice ? (
            <dl className="details">
              <div>
                <dt>ID</dt>
                <dd>#{selectedInvoice.id.toString()}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{shortAddress(selectedInvoice.customer)}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>{getTokenMeta(selectedInvoice.token).symbol}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatUnits(selectedInvoice.amountRaw, getTokenMeta(selectedInvoice.token).decimals)}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty">Enter an invoice ID to preview.</p>
          )}
        </article>
        <article className="card table-card">
          <div className="table-header">
            <h3>InvoicePaid events</h3>
          </div>
          <EventFeed events={events} />
        </article>
      </div>
    </section>
  )
}

