import { useMemo, useState } from 'react'
import type { ChainInvoice, EventEntry } from '../../types/invoice'
import { getTokenMeta } from '../../config/contracts'
import { EventFeed } from '../common/EventFeed'
import { formatUnits } from 'viem'

type Props = {
  invoices: ChainInvoice[]
  isConnected: boolean
  onPay: (invoice: ChainInvoice) => Promise<void>
  paymentStatus: string | null
  setPaymentStatus: (msg: string | null) => void
  eventFeed: EventEntry[]
}

export function PaymentsPanel({ invoices, isConnected, onPay, paymentStatus, setPaymentStatus, eventFeed }: Props) {
  const [invoiceId, setInvoiceId] = useState('1')
  const invoice = useMemo(() => {
    const id = invoiceId ? BigInt(invoiceId) : null
    return invoices.find((item) => item.id === id)
  }, [invoiceId, invoices])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!invoice) {
      setPaymentStatus('Invoice not found.')
      return
    }
    if (!isConnected) {
      setPaymentStatus('Connect a wallet to pay.')
      return
    }
    await onPay(invoice)
  }

  return (
    <section className="panel">
      <h2>Customer payment</h2>
      <div className="grid split">
        <article className="card">
          <h3>Lookup invoice</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Invoice ID
              <input type="number" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
            </label>
            <button type="submit" disabled={!invoice || !isConnected}>
              Pay invoice
            </button>
            {paymentStatus && <p className="banner info">{paymentStatus}</p>}
          </form>
        </article>
        <article className="card">
          <h3>Invoice details</h3>
          {invoice ? (
            <dl className="details">
              <div>
                <dt>ID</dt>
                <dd>#{invoice.id.toString()}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{shortAddress(invoice.customer)}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>{getTokenMeta(invoice.token).symbol}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatAmount(invoice)}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty">Enter an existing invoice id.</p>
          )}
        </article>
        <article className="card table-card">
          <div className="table-header">
            <h3>Recent events</h3>
          </div>
          <EventFeed events={eventFeed} emptyLabel="No InvoicePaid events yet." />
        </article>
      </div>
    </section>
  )
}

function shortAddress(value?: string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

function formatAmount(invoice: ChainInvoice) {
  const meta = getTokenMeta(invoice.token)
  const value = Number(formatUnits(invoice.amountRaw, meta.decimals))
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${meta.symbol}`
}

