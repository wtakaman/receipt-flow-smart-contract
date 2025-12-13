import { Fragment, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { getTokenMeta } from '../../config/contracts'
import type { ChainInvoice } from '../../types/invoice'
import { Metric } from '../common/Metric'
import { ShareInvoiceModal } from '../ShareInvoiceModal'
import { RegisterInvoiceModal } from '../RegisterInvoiceModal'
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
  contractAddress?: Address
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
  contractAddress,
  onRegisterInvoice,
  onRemoveInvoice
}: Props) {
  const defaultToken = supportedTokens[0]
  const [shareLink, setShareLink] = useState<string | null>(null)
  const sortedInvoices = useMemo(() => invoices.sort((a, b) => Number(b.id - a.id)), [invoices])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  return (
    <section className="panel">
      <h2>Invoices</h2>
      <div className="metrics">
        <Metric label="Open invoices" value={metrics.openCount} />
        <Metric label="Expired" value={metrics.expiredCount} />
        <Metric label="Paid (recent)" value={metrics.paidCount} />
      </div>
      <article className="card table-card">
        <div className="table-header">
          <h3>Open invoices</h3>
          <button type="button" onClick={() => setRegisterOpen(true)} disabled={!isOwner}>
            Register invoice
          </button>
        </div>
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
                if (!invoice?.id) return null
                const meta = getTokenMeta(invoice.token)
                const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)
                const expiration =
                  invoice.expiration === 0n ? '—' : new Date(Number(invoice.expiration) * 1000).toLocaleDateString()
                const key = invoice.id.toString()
                const isExpanded = expandedId === key
                return (
                  <Fragment key={key}>
                    <tr className={isExpanded ? 'row expanded' : ''}>
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
                          <button type="button" onClick={() => setExpandedId(isExpanded ? null : key)}>
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                          {contractAddress && (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                title="Copy share link"
                                onClick={() => copyShareLink(contractAddress, invoice.id)}
                              >
                                📋
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                title="Share"
                                onClick={() => setShareLink(buildShareLink(contractAddress, invoice.id))}
                              >
                                📤
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={6}>
                          <InvoiceDetails invoice={invoice} chainId={undefined} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <RegisterInvoiceModal
        open={registerOpen}
        supportedTokens={supportedTokens}
        defaultToken={defaultToken}
        onClose={() => setRegisterOpen(false)}
        onSubmit={async (params) => {
          await onRegisterInvoice(params)
          setRegisterOpen(false)
        }}
      />

      <ShareInvoiceModal url={shareLink} onClose={() => setShareLink(null)} />
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

function isExpired(expiration: bigint) {
  if (!expiration || expiration === 0n) return false
  const now = BigInt(Math.floor(Date.now() / 1000))
  return expiration < now
}

function explorerLink(chainId: number | undefined, address: string) {
  if (!address) return '#'
  if (chainId === 11155111) return `https://sepolia.etherscan.io/address/${address}`
  if (chainId === 80001) return `https://mumbai.polygonscan.com/address/${address}`
  return `https://etherscan.io/address/${address}`
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      title="Copy"
      className="icon-button"
      onClick={() => {
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(value).catch(() => {})
        }
      }}
    >
      📋
    </button>
  )
}

function InvoiceDetails({ invoice, chainId }: { invoice: ChainInvoice; chainId?: number }) {
  const meta = getTokenMeta(invoice.token)
  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)
  return (
    <dl className="details">
      <div>
        <dt>Status</dt>
        <dd>{isExpired(invoice.expiration) ? 'Expired' : 'Open'}</dd>
      </div>
      <div>
        <dt>Customer</dt>
        <dd className="copy-line">
          {shortAddress(invoice.customer)}
          <CopyButton value={invoice.customer} />
          <a
            href={explorerLink(chainId, invoice.customer)}
            target="_blank"
            rel="noreferrer"
            title="View on explorer"
            className="icon-link"
          >
            🔗
          </a>
        </dd>
      </div>
      <div>
        <dt>Token</dt>
        <dd className="copy-line">
          {meta.name ?? meta.symbol} ({meta.symbol})
          <CopyButton value={invoice.token} />
          <a
            href={explorerLink(chainId, invoice.token)}
            target="_blank"
            rel="noreferrer"
            title="View on explorer"
            className="icon-link"
          >
            🔗
          </a>
        </dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>
          {amountDisplay} {meta.symbol} <small>({invoice.amountRaw.toString()} wei)</small>
        </dd>
      </div>
      <div>
        <dt>Expiration</dt>
        <dd>
          {invoice.expiration === 0n
            ? '—'
            : `${new Date(Number(invoice.expiration) * 1000).toLocaleString()}${
                isExpired(invoice.expiration) ? ' (expired)' : ''
              }`}
        </dd>
      </div>
    </dl>
  )
}

function buildShareLink(contractAddress: Address, invoiceId: bigint) {
  const base = window.location.origin
  return `${base}/#/invoice/${contractAddress}/${invoiceId.toString()}`
}

function copyShareLink(contractAddress: Address, invoiceId: bigint) {
  const url = buildShareLink(contractAddress, invoiceId)
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

