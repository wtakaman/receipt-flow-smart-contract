import { Fragment, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { getTokenMeta } from '../../config/contracts'
import type { PaidInvoice } from '../../types/invoice'
import { Metric } from '../common/Metric'
import { getReceiptNftAddress } from '../../config/contracts'

type Props = {
  paidInvoices: PaidInvoice[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  onFetch: () => void
  onRefresh: () => void
  chainId?: number
}

const PAGE_SIZE = 10

export function PaidInvoicesPanel({ paidInvoices, isLoading, error, hasFetched, onFetch, onRefresh, chainId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [didTriggerFetch, setDidTriggerFetch] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch on first render of this panel (only once)
  useEffect(() => {
    if (!hasFetched && !isLoading && !didTriggerFetch) {
      setDidTriggerFetch(true)
      onFetch()
    }
  }, [hasFetched, isLoading, didTriggerFetch, onFetch])

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [paidInvoices.length])

  // Pagination calculations
  const totalPages = Math.ceil(paidInvoices.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const paginatedInvoices = paidInvoices.slice(startIndex, endIndex)

  // Calculate total value paid per token
  const totals = paidInvoices.reduce(
    (acc, inv) => {
      const key = inv.token.toLowerCase()
      acc[key] = (acc[key] || 0n) + inv.amountRaw
      return acc
    },
    {} as Record<string, bigint>
  )

  const receiptNftAddress = getReceiptNftAddress(chainId)

  return (
    <section className="panel">
      <h2>Paid Invoices</h2>
      <p className="section-lead">Receipt-backed payments with links to transactions and NFTs.</p>
      <div className="metrics">
        <Metric label="Total paid" value={paidInvoices.length} />
        {Object.entries(totals).map(([token, amount]) => {
          const meta = getTokenMeta(token as Address)
          const formatted = formatAmount(amount, meta.decimals)
          return <Metric key={token} label={`Total ${meta.symbol}`} value={formatted} />
        })}
      </div>

      <article className="card table-card">
        <div className="table-header">
          <h3>Payment history</h3>
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <p className="error">Error: {error}</p>}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Token</th>
                <th>Amount</th>
                <th>Paid at</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paidInvoices.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7}>No paid invoices found.</td>
                </tr>
              )}
              {isLoading && paidInvoices.length === 0 && (
                <tr>
                  <td colSpan={7}>Loading paid invoices...</td>
                </tr>
              )}
              {paginatedInvoices.map((invoice) => {
                const meta = getTokenMeta(invoice.token)
                const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)
                const paidDate = new Date(invoice.paidAt).toLocaleString()
                const key = `${invoice.id.toString()}-${invoice.txHash}`
                const isExpanded = expandedId === key

                return (
                  <Fragment key={key}>
                    <tr className={isExpanded ? 'row expanded' : ''}>
                      <td>#{invoice.id.toString()}</td>
                      <td>{shortAddress(invoice.customer)}</td>
                      <td>{meta.symbol}</td>
                      <td>{amountDisplay}</td>
                      <td>{paidDate}</td>
                      <td>{invoice.receiptTokenId ? `#${invoice.receiptTokenId.toString()}` : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => setExpandedId(isExpanded ? null : key)}>
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                          <a
                            href={explorerTxLink(chainId, invoice.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="icon-link"
                            title="View transaction"
                          >
                            🔗
                          </a>
                          {receiptNftAddress && invoice.receiptTokenId && (
                            <a
                              className="icon-link"
                              href={`#/receipt/${receiptNftAddress}/${invoice.receiptTokenId.toString()}?tx=${invoice.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open receipt page"
                            >
                              🧾
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={6}>
                          <PaidInvoiceDetails invoice={invoice} chainId={chainId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← Prev
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages} ({paidInvoices.length} total)
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </article>
    </section>
  )
}

function PaidInvoiceDetails({ invoice, chainId }: { invoice: PaidInvoice; chainId?: number }) {
  const meta = getTokenMeta(invoice.token)
  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)

  return (
    <dl className="details">
      <div>
        <dt>Status</dt>
        <dd className="status-paid">✓ Paid</dd>
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
        </dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>
          {amountDisplay} {meta.symbol} <small>({invoice.amountRaw.toString()} wei)</small>
        </dd>
      </div>
      <div>
        <dt>Paid at</dt>
        <dd>{new Date(invoice.paidAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt>Transaction</dt>
        <dd className="copy-line">
          {shortAddress(invoice.txHash, 8)}
          <CopyButton value={invoice.txHash} />
          <a
            href={explorerTxLink(chainId, invoice.txHash)}
            target="_blank"
            rel="noreferrer"
            title="View transaction"
            className="icon-link"
          >
            🔗
          </a>
        </dd>
      </div>
      <div>
        <dt>Block</dt>
        <dd>{invoice.blockNumber.toString()}</dd>
      </div>
    </dl>
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

function explorerLink(chainId: number | undefined, address: string) {
  if (!address) return '#'
  if (chainId === 11155111) return `https://sepolia.etherscan.io/address/${address}`
  if (chainId === 80001) return `https://mumbai.polygonscan.com/address/${address}`
  return `https://etherscan.io/address/${address}`
}

function explorerTxLink(chainId: number | undefined, txHash: string) {
  if (!txHash) return '#'
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`
  if (chainId === 80001) return `https://mumbai.polygonscan.com/tx/${txHash}`
  return `https://etherscan.io/tx/${txHash}`
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
