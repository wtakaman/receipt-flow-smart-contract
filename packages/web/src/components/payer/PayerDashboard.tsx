import { Fragment, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import type { PayerInvoice } from '../../hooks/usePayerInvoices'
import { getTokenMeta, normalizeAddressInput } from '../../config/contracts'

type Props = {
  invoices: PayerInvoice[]
  isLoading: boolean
  paymentStatus: string | null
  setPaymentStatus: (msg: string | null) => void
  onRefresh: () => Promise<void>
  onPay: (invoice: PayerInvoice) => Promise<void>
  chainId?: number
}

export function PayerDashboard({
  invoices,
  isLoading,
  paymentStatus,
  onRefresh,
  onPay,
  chainId
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section className="panel">
      <h2>Payer console</h2>
      <p className="section-lead">Invoices linked to your wallet across all deployed contracts.</p>
      <div className="grid split">
        <article className="card table-card">
          <div className="table-header">
            <h3>Invoices</h3>
            <button type="button" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Contract</th>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6}>{isLoading ? 'Loading...' : 'No invoices found for this wallet.'}</td>
                  </tr>
                )}
                {invoices.map((invoice) => {
                  const meta = getTokenMeta(invoice.token)
                  const displaySymbol = invoice.tokenSymbol ?? meta.symbol
                  const key = `${invoice.contractAddress}-${invoice.id.toString()}`
                  const formatted = formatUnits(invoice.amountRaw, meta.decimals)
                  const isExpanded = expandedId === key
                  const isPaid = invoice.isPaid === true
                  const expired = isExpired(invoice.expiration)
                  const status = isPaid ? 'Paid' : expired ? 'Expired' : 'Open'
                  const statusClass = isPaid ? 'success' : expired ? 'error' : 'warning'
                return (
                  <Fragment key={key}>
                    <tr className={isExpanded ? 'row expanded' : ''}>
                      <td>#{invoice.id.toString()}</td>
                      <td>{shortAddress(invoice.contractAddress)}</td>
                      <td>{displaySymbol}</td>
                      <td>
                        {Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td>
                        <span className={`badge ${statusClass}`}>{status}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(isExpanded ? null : key)
                            }}
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                          {isPaid ? (
                            invoice.receiptTokenId !== undefined && invoice.receiptNftAddress ? (
                              <a
                                href={`#/receipt/${invoice.receiptNftAddress}/${invoice.receiptTokenId.toString()}${invoice.txHash ? `?tx=${invoice.txHash}` : ''}`}
                                className="btn-link"
                                title="View Receipt NFT"
                                target="_blank"
                                rel="noreferrer"
                              >
                                📜 Receipt
                              </a>
                            ) : (
                              <span className="muted-text">No receipt</span>
                            )
                          ) : (
                            <button type="button" onClick={() => onPay(invoice)} disabled={expired}>
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={6}>
                          <InvoiceDetails invoice={invoice} chainId={chainId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
                })}
              </tbody>
            </table>
          </div>
          {paymentStatus && <p className="banner info">{paymentStatus}</p>}
        </article>

      </div>
    </section>
  )
}

function InvoiceDetails({
  invoice,
  chainId
}: {
  invoice: PayerInvoice
  chainId?: number
}) {
  const isPaid = invoice.isPaid === true
  const hasReceipt = isPaid && invoice.receiptTokenId !== undefined && invoice.receiptNftAddress
  
  return (
    <dl className="details">
      <div>
        <dt>ID</dt>
        <dd>#{invoice.id.toString()}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{invoice.isPaid ? 'Paid' : isExpired(invoice.expiration) ? 'Expired' : 'Open'}</dd>
      </div>
      {hasReceipt && (
        <div>
          <dt>Receipt NFT</dt>
          <dd className="copy-line">
            <a
              href={`#/receipt/${invoice.receiptNftAddress}/${invoice.receiptTokenId!.toString()}${invoice.txHash ? `?tx=${invoice.txHash}` : ''}`}
              className="btn-link"
              title="View Receipt NFT"
              target="_blank"
              rel="noreferrer"
            >
              📜 Receipt #{invoice.receiptTokenId!.toString()}
            </a>
            <a
              href={explorerLink(chainId, invoice.receiptNftAddress!, 'nft', invoice.receiptTokenId!.toString())}
              target="_blank"
              rel="noreferrer"
              title="View on explorer"
              className="icon-link"
            >
              🔗
            </a>
          </dd>
        </div>
      )}
      <div>
        <dt>Contract</dt>
        <dd className="copy-line">
          {shortAddress(invoice.contractAddress)}
          <CopyButton value={invoice.contractAddress} />
          <a
            href={explorerLink(chainId, invoice.contractAddress)}
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
        <dt>Customer</dt>
        <dd className="copy-line">
          {shortAddress(invoice.customer)}
          <CopyButton value={invoice.customer} />
        </dd>
      </div>
      <div>
        <dt>Token</dt>
        <dd className="copy-line">
          {invoice.tokenName ?? getTokenMeta(invoice.token).name ?? getTokenMeta(invoice.token).symbol}
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
          {formatAmount(invoice)} <small>({invoice.amountRaw.toString()} wei)</small>
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

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

function formatAmount(invoice: PayerInvoice) {
  const meta = getTokenMeta(invoice.token)
  const value = Number(formatUnits(invoice.amountRaw, meta.decimals))
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${meta.symbol}`
}

function isExpired(expiration: bigint) {
  if (!expiration || expiration === 0n) return false
  const now = BigInt(Math.floor(Date.now() / 1000))
  return expiration < now
}

function explorerLink(chainId: number | undefined, address: string, type: 'address' | 'nft' = 'address', tokenId?: string) {
  const addr = normalizeAddressInput(address) ?? address
  const base = chainId === 11155111 
    ? 'https://sepolia.etherscan.io' 
    : chainId === 80001 
    ? 'https://mumbai.polygonscan.com' 
    : 'https://etherscan.io'
  
  if (type === 'nft' && tokenId) {
    return `${base}/nft/${addr}/${tokenId}`
  }
  return `${base}/address/${addr}`
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


