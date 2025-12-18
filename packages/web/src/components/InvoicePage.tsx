import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { usePublicClient, useWriteContract } from 'wagmi'
import { invoiceFlowAbi, getTokenMeta, addTokenMeta } from '../config/contracts'
import logoSvg from '../assets/logo.svg'
import type { ReactNode } from 'react'

type Props = {
  contractAddress: Address
  invoiceId: bigint
  address?: Address
  isConnected: boolean
  walletButton?: ReactNode
}

type InvoiceData = {
  id: bigint
  customer: string
  token: Address
  amountRaw: bigint
  expiration: bigint
  tokenMeta: {
    name?: string
    symbol: string
    decimals: number
    isNative?: boolean
  }
}

export function InvoicePage({
  contractAddress,
  invoiceId,
  address,
  isConnected,
  walletButton
}: Props) {
  // Note: connectPending and pendingConnector available in Props but not used here
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaid, setIsPaid] = useState(false)
  const [isPaymentSubmitted, setIsPaymentSubmitted] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const isExpired = useMemo(() => {
    if (!invoice) return false
    if (!invoice.expiration || invoice.expiration === 0n) return false
    return invoice.expiration < BigInt(Math.floor(Date.now() / 1000))
  }, [invoice])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!publicClient) return
      setIsLoading(true)
      try {
        const result = (await publicClient.readContract({
          address: contractAddress,
          abi: invoiceFlowAbi,
          functionName: 'invoices',
          args: [invoiceId]
        })) as { id?: bigint; customer?: string; token?: Address; amount?: bigint; amountRaw?: bigint; expiration?: bigint; 0?: bigint; 1?: string; 2?: bigint; 3?: Address; 4?: bigint }

        const { id: parsedId, customer: parsedCustomer } = normalizeInvoiceFields(result, invoiceId)

        // Check if invoice exists (expiration = 0 means deleted/paid)
        const expiration = (result.expiration ?? result[4] ?? 0n) as bigint
        if (expiration === 0n && parsedId === 0n) {
          // Invoice doesn't exist or was paid
          if (!cancelled) {
            setIsPaid(true)
            setInvoice(null)
            setStatus(null)
          }
          return
        }

        const tokenRaw = result.token ?? result[3]
        const token = pickAddress(tokenRaw) ?? (tokenRaw?.toString?.() as Address)
        let meta = getTokenMeta(token)
        const needsOnchain =
          (!meta.name || meta.name.trim() === '' || meta.name === 'Unknown Token') ||
          (!meta.symbol || meta.symbol === 'TOKEN' || meta.symbol === '???' || meta.symbol.trim() === '')
        if (needsOnchain && token && token !== '0x0000000000000000000000000000000000000000') {
          try {
            const [onName, onSymbol, onDecimals] = await Promise.all([
              publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'name' }).catch(() => undefined),
              publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(() => undefined),
              publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => undefined)
            ])
            meta = {
              name: (onName as string | undefined) ?? meta.name,
              symbol: (onSymbol as string | undefined) ?? meta.symbol ?? 'TOKEN',
              decimals: Number(onDecimals ?? meta.decimals ?? 18),
              isNative: meta.isNative
            }
            // Cache the fetched metadata for other components
            if (meta.symbol && meta.symbol !== '???' && meta.symbol !== 'TOKEN') {
              addTokenMeta(token, meta)
            }
          } catch {
            // ignore
          }
        }

        const invoiceData: InvoiceData = {
          id: parsedId,
          customer: parsedCustomer,
          token,
          amountRaw: (result.amountRaw ?? result.amount ?? result[2] ?? 0n) as bigint,
          expiration: expiration,
          tokenMeta: meta.symbol ? meta : { ...meta, symbol: meta.symbol || 'TOKEN' }
        }
        console.log('[invoice-page] loaded invoice', invoiceData)
        if (!cancelled) {
          // Only reset paid flag when not waiting on a submitted payment confirmation
          if (!isPaymentSubmitted) {
            setIsPaid(false)
          }
          setInvoice(invoiceData)
          if (!invoiceData.customer) {
            setStatus('This invoice has no customer set on-chain; payment requires the customer wallet.')
          }
        }
      } catch (err) {
        if (!cancelled) setStatus((err as Error).message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, contractAddress, invoiceId, refreshKey, isPaymentSubmitted])

  const pay = async () => {
    if (!invoice) return
    if (!publicClient) {
      setStatus('No RPC provider available.')
      return
    }
    if (!isConnected || !address) {
      setStatus('Connect wallet to pay this invoice.')
      return
    }
    if (!invoice.customer) {
      setStatus('Invoice customer is not set.')
      return
    }
    if (safeLower(invoice.customer) !== safeLower(address)) {
      setStatus(`This invoice is for ${invoice.customer}. You are connected as ${address}.`)
      return
    }
    setStatus(null)
    setIsPaying(true)
    try {
      if (!invoice.tokenMeta.isNative) {
        const allowance = (await publicClient?.readContract({
          address: invoice.token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, contractAddress]
        })) as bigint
        if (allowance < invoice.amountRaw) {
          await writeContractAsync({
            address: invoice.token,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractAddress, invoice.amountRaw]
          })
        }
      }

      await writeContractAsync({
        address: contractAddress,
        abi: invoiceFlowAbi,
        functionName: 'handleTransfer',
        args: [invoice.id],
        value: invoice.tokenMeta.isNative ? invoice.amountRaw : undefined,
        gas: 3_000_000n
      })
      setStatus(`Payment successful for invoice #${invoice.id.toString()}!`)
      setIsPaid(true)
      setIsPaymentSubmitted(true)
      // Refresh invoice data after a short delay to confirm it's been paid
      setTimeout(() => setRefreshKey((k) => k + 1), 2000)
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <section className="panel">
      <header className="hero">
        <div className="hero-top">
          <div className="hero-brand">
            <img src={logoSvg} alt="Receipt Flow" className="hero-logo" />
            <p className="eyebrow">Receipt Flow Console</p>
          </div>
          <div className="hero-actions">{walletButton}</div>
        </div>
        <h1>Invoice payment</h1>
        <p className="lead">Review the invoice details and pay with the correct customer wallet.</p>
      </header>

      <div className="card">
        <div className="table-header">
          <div>
            <h3>Payment steps</h3>
            <ol className="steps">
              <li>Connect the payer wallet.</li>
              <li>Confirm the connected wallet matches the invoice customer.</li>
              <li>If the token is ERC-20, approve the exact amount.</li>
              <li>Click Pay to submit the transaction.</li>
            </ol>
          </div>
        </div>

        {isLoading && <p>Loading invoice…</p>}
        {!isLoading && !invoice && isPaid && (
          <div className="paid-notice">
            <span className="badge success large">✓ Invoice Paid</span>
            <p>This invoice has been paid and is no longer available.</p>
          </div>
        )}
        {!isLoading && !invoice && !isPaid && <p className="empty">Invoice not found.</p>}

        {invoice && (
          <div className="invoice-bill">
            <header className="bill-header invoice-hero">
              <div className="receipt-meta">
                <p className="eyebrow">Invoice</p>
                <h2>#{invoiceId.toString()}</h2>
                <p className="label micro">Contract</p>
                <p className="muted mono">{contractAddress}</p>
              </div>
              <div className="bill-status">
                <span className={`status-pill ${isPaid ? 'success' : isExpired ? 'warning' : 'info'}`}>
                  {isPaid ? '✓ Paid' : isExpired ? 'Expired' : 'Open'}
                </span>
                <p className="muted">
                  {invoice.expiration === 0n ? 'No expiration' : prettyDate(invoice.expiration)}
                </p>
              </div>
            </header>

            <div className="bill-body">
              <div className="bill-row">
                <div>
                  <p className="label">Bill to</p>
                  <p className="value mono">{invoice.customer || 'Not provided on-chain'}</p>
                </div>
              </div>

              <div className="bill-grid">
                <div>
                  <p className="label">Token</p>
                  <p className="value">
                    {invoice.tokenMeta.name ?? invoice.tokenMeta.symbol} ({invoice.tokenMeta.symbol})
                  </p>
                  <p className="muted mono">{invoice.token}</p>
                </div>
                <div>
                  <p className="label">Amount</p>
                  <p className="value emphasis">
                    {formatAmount(invoice.amountRaw, invoice.tokenMeta.decimals)} {invoice.tokenMeta.symbol}
                  </p>
                  <p className="muted mono">{invoice.amountRaw.toString()} wei</p>
                </div>
              </div>

              <div className="bill-row action">
                <div>
                  <p className="label">Payment</p>
                  <p className="muted">
                    {isPaid 
                      ? 'This invoice has been paid successfully.' 
                      : 'Use the customer wallet to submit payment. Unsupported wallets or wrong addresses will be blocked.'}
                  </p>
                </div>
                {!isPaid && (
                  <button
                    type="button"
                    onClick={pay}
                    disabled={
                      isExpired ||
                      isPaying ||
                      isPaymentSubmitted ||
                      !invoice.customer ||
                      !isConnected ||
                      !address ||
                      safeLower(invoice.customer) !== safeLower(address)
                    }
                  className="btn primary"
                  >
                    {isExpired ? 'Expired' : isPaying ? 'Submitting…' : isPaymentSubmitted ? 'Submitted…' : 'Pay invoice'}
                  </button>
                )}
                {isPaid && (
                  <span className="badge success">✓ Payment complete</span>
                )}
              </div>

              {!isPaid && (!isConnected || safeLower(invoice.customer) !== safeLower(address)) && (
                <p className="muted warning-text">
                  {invoice.customer
                    ? `This invoice is for ${invoice.customer}. Connect that wallet to pay.`
                    : 'No customer address set for this invoice.'}
                </p>
              )}
            </div>
          </div>
        )}
        {status && <p className="banner info">{status}</p>}
      </div>
    </section>
  )
}

function formatAmount(value: bigint, decimals: number) {
  const factor = 10n ** BigInt(decimals ?? 18)
  const whole = value / factor
  const fraction = value % factor
  const fracStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr.slice(0, 6)}` : whole.toString()
}

function safeLower(value?: string | bigint | { toString?: () => string }) {
  if (!value) return ''
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'bigint') return value.toString().toLowerCase()
  if (typeof value === 'object' && value?.toString) return value.toString().toLowerCase()
  return ''
}

function pickAddress(value: unknown): Address | undefined {
  if (typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)) return value as Address
  if (value && typeof value === 'object' && typeof value.toString === 'function') {
    const str = value.toString()
    if (/^0x[a-fA-F0-9]{40}$/.test(str)) return str as Address
  }
  return undefined
}

function prettyDate(expiration: bigint) {
  if (!expiration || expiration === 0n) return 'No expiration'
  const ts = Number(expiration) * 1000
  return new Date(ts).toLocaleString()
}

function normalizeInvoiceFields(result: Record<string, unknown>, fallbackId: bigint): { id: bigint; customer: string } {
  const rawId = result.id ?? result[0] ?? fallbackId
  const rawCustomer = result.customer ?? result[1] ?? ''

  const idStr = rawId?.toString?.() ?? ''
  const custStr = rawCustomer?.toString?.() ?? ''

  const idLooksLikeAddr = /^0x[a-fA-F0-9]{40}$/.test(idStr)
  const custLooksLikeAddr = /^0x[a-fA-F0-9]{40}$/.test(custStr)
  const customer: string = custLooksLikeAddr ? custStr : idLooksLikeAddr ? idStr : custStr

  let parsedId: bigint
  try {
    if (!custLooksLikeAddr && /^\d+$/.test(custStr)) {
      parsedId = BigInt(custStr)
    } else if (!idLooksLikeAddr && /^\d+$/.test(idStr)) {
      parsedId = BigInt(idStr)
    } else {
      parsedId = typeof rawId === 'bigint' ? rawId : BigInt(rawId ?? fallbackId)
    }
  } catch {
    parsedId = fallbackId
  }

  return { id: parsedId, customer }
}

