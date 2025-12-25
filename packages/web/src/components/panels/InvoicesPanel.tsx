import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits, erc20Abi } from 'viem'
import { usePublicClient } from 'wagmi'
import { getTokenMeta, getReceiptNftAddress, addTokenMeta } from '../../config/contracts'
import type { ChainInvoice, PaidInvoice } from '../../types/invoice'
import { Metric } from '../common/Metric'
import { ShareInvoiceModal } from '../ShareInvoiceModal'
import { RegisterInvoiceModal } from '../RegisterInvoiceModal'

type Metrics = {
  openCount: number
  expiredCount: number
  paidCount: number
}

type SubTab = 'open' | 'paid'

type Props = {
  isOwner: boolean
  supportedTokens: Address[]
  invoices: ChainInvoice[]
  metrics: Metrics
  contractAddress?: Address
  connectedAddress?: Address
  onRegisterInvoice: (params: {
    id: bigint
    customer: Address
    token: Address
    amount: string
    decimals: number
    expiresInDays: number
  }) => Promise<void>
  onRemoveInvoice: (id: bigint) => Promise<void>
  onRefreshOpen: () => Promise<void>
  // Paid invoices props
  paidInvoices: PaidInvoice[]
  isPaidLoading: boolean
  paidError: string | null
  hasFetchedPaid: boolean
  onFetchPaid: () => void
  onRefreshPaid: () => void
  chainId?: number
}

const PAGE_SIZE = 10

export function InvoicesPanel({
  isOwner,
  supportedTokens,
  invoices,
  metrics,
  contractAddress,
  connectedAddress,
  onRegisterInvoice,
  onRemoveInvoice,
  onRefreshOpen,
  paidInvoices,
  isPaidLoading,
  paidError,
  hasFetchedPaid,
  onFetchPaid,
  onRefreshPaid,
  chainId
}: Props) {
  const defaultToken = supportedTokens[0]
  const [shareLink, setShareLink] = useState<string | null>(null)
  const sortedInvoices = useMemo(() => invoices.sort((a, b) => Number(b.id - a.id)), [invoices])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [subTab, setSubTab] = useState<SubTab>('open')
  const [currentPage, setCurrentPage] = useState(1)
  const [isRefreshingOpen, setIsRefreshingOpen] = useState(false)

  // Fetch paid invoices when switching to paid tab (only once per contract)
  useEffect(() => {
    if (subTab === 'paid' && !hasFetchedPaid && !isPaidLoading) {
      onFetchPaid()
    }
  }, [subTab, hasFetchedPaid, isPaidLoading, onFetchPaid])

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [paidInvoices.length])

  // Sort paid invoices by expiration desc, then id desc
  const sortedPaidInvoices = useMemo(() => {
    return [...paidInvoices].sort((a, b) => {
      const expDiff = Number(b.expiration - a.expiration)
      if (expDiff !== 0) return expDiff
      return Number(b.id - a.id)
    })
  }, [paidInvoices])

  // Pagination for paid invoices
  const totalPages = Math.ceil(sortedPaidInvoices.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedPaidInvoices = sortedPaidInvoices.slice(startIndex, startIndex + PAGE_SIZE)

  const receiptNftAddress = getReceiptNftAddress(chainId)

  return (
    <section className="panel">
      <h2>Invoices</h2>
      <div className="metrics">
        <Metric label="Open" value={metrics.openCount} />
        <Metric label="Expired" value={metrics.expiredCount} />
        <Metric label="Paid" value={paidInvoices.length || metrics.paidCount} />
      </div>

      {/* Sub-tabs */}
      <div className="sub-tabs">
        <button 
          className={subTab === 'open' ? 'active' : ''} 
          onClick={() => setSubTab('open')}
        >
          Open
        </button>
        <button 
          className={subTab === 'paid' ? 'active' : ''} 
          onClick={() => setSubTab('paid')}
        >
          Paid
        </button>
      </div>

      {/* Open Invoices */}
      {subTab === 'open' && (
        <article className="card table-card">
          <div className="table-header">
            <h3>Open invoices</h3>
            <div className="table-actions">
              <button
                style={{marginRight: '10px'}}
                type="button"
                onClick={async () => {
                  setIsRefreshingOpen(true)
                  try {
                    await onRefreshOpen()
                  } finally {
                    setIsRefreshingOpen(false)
                  }
                }}
                disabled={isRefreshingOpen}
              >
                {isRefreshingOpen ? 'Refreshing...' : 'Refresh'}
              </button>
              <button type="button" onClick={() => setRegisterOpen(true)} disabled={!isOwner}>
                Register invoice
              </button>
            </div>
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
                    <td colSpan={6} className="empty-row">No open invoices.</td>
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
        </article>
      )}

      {/* Paid Invoices */}
      {subTab === 'paid' && (
        <article className="card table-card">
          <div className="table-header">
            <h3>Paid invoices</h3>
            <button type="button" onClick={onRefreshPaid} disabled={isPaidLoading}>
              {isPaidLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {paidError && <p className="error" style={{ padding: '0 1rem' }}>Error: {paidError}</p>}
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
                {paidInvoices.length === 0 && !isPaidLoading && (
                  <tr>
                    <td colSpan={7} className="empty-row">No paid invoices found.</td>
                  </tr>
                )}
                {isPaidLoading && paidInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">Loading paid invoices...</td>
                  </tr>
                )}
                {paginatedPaidInvoices.map((invoice) => {
                  const meta = getTokenMeta(invoice.token)
                  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)
                  const paidDate = new Date(invoice.paidAt).toLocaleDateString()
                  const key = `paid-${invoice.id.toString()}-${invoice.txHash}`
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
                            {receiptNftAddress && invoice.receiptTokenId ? (
                              <a
                                className="btn-link"
                                href={`#/receipt/${receiptNftAddress}/${invoice.receiptTokenId.toString()}?tx=${invoice.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View Receipt NFT"
                              >
                                📜 Receipt
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="expanded-row">
                          <td colSpan={7}>
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
                Page {currentPage} of {totalPages}
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
      )}

      <RegisterInvoiceModal
        open={registerOpen}
        supportedTokens={supportedTokens}
        defaultToken={defaultToken}
        connectedAddress={connectedAddress}
        onClose={() => setRegisterOpen(false)}
        onSubmit={async (params) => {
          await onRegisterInvoice(params)
          await onRefreshOpen()
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
  const publicClient = usePublicClient()
  const [meta, setMeta] = useState(() => getTokenMeta(invoice.token))
  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!publicClient) return
      
      let tokenMeta = getTokenMeta(invoice.token)
      const needsOnchain =
        (!tokenMeta.name || tokenMeta.name.trim() === '' || tokenMeta.name === 'Unknown Token') ||
        (!tokenMeta.symbol || tokenMeta.symbol === 'TOKEN' || tokenMeta.symbol === '???' || tokenMeta.symbol.trim() === '')

      if (needsOnchain && invoice.token && invoice.token !== '0x0000000000000000000000000000000000000000') {
        try {
          const [onName, onSymbol, onDecimals] = await Promise.all([
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'name' }).catch(() => undefined),
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'symbol' }).catch(() => undefined),
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'decimals' }).catch(() => undefined)
          ])
          tokenMeta = {
            name: (onName as string | undefined) ?? tokenMeta.name,
            symbol: (onSymbol as string | undefined) ?? tokenMeta.symbol ?? 'TOKEN',
            decimals: Number(onDecimals ?? tokenMeta.decimals ?? 18),
            isNative: tokenMeta.isNative
          }
          if (tokenMeta.symbol && tokenMeta.symbol !== '???' && tokenMeta.symbol !== 'TOKEN') {
            addTokenMeta(invoice.token, tokenMeta)
          }
        } catch {
          // ignore failures, keep fallback meta
        }
      }

      if (!cancelled) {
        setMeta(tokenMeta)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, invoice.token])

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

function explorerTxLink(chainId: number | undefined, txHash: string) {
  if (!txHash) return '#'
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`
  if (chainId === 80001) return `https://mumbai.polygonscan.com/tx/${txHash}`
  return `https://etherscan.io/tx/${txHash}`
}

function PaidInvoiceDetails({ invoice, chainId }: { invoice: PaidInvoice; chainId?: number }) {
  const publicClient = usePublicClient()
  const [meta, setMeta] = useState(() => getTokenMeta(invoice.token))
  const amountDisplay = formatAmount(invoice.amountRaw, meta.decimals)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!publicClient) return
      
      let tokenMeta = getTokenMeta(invoice.token)
      const needsOnchain =
        (!tokenMeta.name || tokenMeta.name.trim() === '' || tokenMeta.name === 'Unknown Token') ||
        (!tokenMeta.symbol || tokenMeta.symbol === 'TOKEN' || tokenMeta.symbol === '???' || tokenMeta.symbol.trim() === '')

      if (needsOnchain && invoice.token && invoice.token !== '0x0000000000000000000000000000000000000000') {
        try {
          const [onName, onSymbol, onDecimals] = await Promise.all([
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'name' }).catch(() => undefined),
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'symbol' }).catch(() => undefined),
            publicClient.readContract({ address: invoice.token, abi: erc20Abi, functionName: 'decimals' }).catch(() => undefined)
          ])
          tokenMeta = {
            name: (onName as string | undefined) ?? tokenMeta.name,
            symbol: (onSymbol as string | undefined) ?? tokenMeta.symbol ?? 'TOKEN',
            decimals: Number(onDecimals ?? tokenMeta.decimals ?? 18),
            isNative: tokenMeta.isNative
          }
          if (tokenMeta.symbol && tokenMeta.symbol !== '???' && tokenMeta.symbol !== 'TOKEN') {
            addTokenMeta(invoice.token, tokenMeta)
          }
        } catch {
          // ignore failures, keep fallback meta
        }
      }

      if (!cancelled) {
        setMeta(tokenMeta)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, invoice.token])

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

