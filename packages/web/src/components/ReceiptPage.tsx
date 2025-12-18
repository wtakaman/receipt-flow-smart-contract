import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { decodeEventLog, erc20Abi, formatUnits } from 'viem'
import { usePublicClient } from 'wagmi'
import { addTokenMeta, getTokenMeta, receiptNftAbi } from '../config/contracts'
import logoSvg from '../assets/logo.svg'

type Props = {
  receiptNftAddress: Address
  tokenId: bigint
  txHash?: string
}

type ReceiptData = {
  invoiceContract: Address
  invoiceId: bigint
  payer: Address
  token: Address
  amount: bigint
  paidAt: bigint
  tokenMeta: {
    name?: string
    symbol: string
    decimals: number
    isNative?: boolean
  }
}

const explorerBase = 'https://sepolia.etherscan.io'

export function ReceiptPage({ receiptNftAddress, tokenId, txHash }: Props) {
  const publicClient = usePublicClient()
  const [resolvedAddress, setResolvedAddress] = useState<Address>(receiptNftAddress)
  const [resolvedTokenId, setResolvedTokenId] = useState<bigint>(tokenId)
  const [data, setData] = useState<ReceiptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedTxHash, setResolvedTxHash] = useState<string | undefined>(txHash)

  // If no txHash was provided, try to resolve it from ReceiptMinted logs
  useEffect(() => {
    if (resolvedTxHash || !publicClient) return
    let cancelled = false
    const receiptMintedEvent = {
      type: 'event',
      name: 'ReceiptMinted',
      inputs: [
        { name: 'tokenId', type: 'uint256', indexed: true },
        { name: 'invoiceContract', type: 'address', indexed: true },
        { name: 'invoiceId', type: 'uint256', indexed: true },
        { name: 'payer', type: 'address', indexed: false }
      ]
    } as const

    ;(async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        const fromBlock = latest > 4000n ? latest - 4000n : 0n
        const logs = await publicClient.getLogs({
          address: receiptNftAddress,
          event: receiptMintedEvent,
          args: { tokenId },
          fromBlock,
          toBlock: latest
        })
        const last = logs[logs.length - 1]
        if (!cancelled && last?.transactionHash) {
          setResolvedTxHash(last.transactionHash)
        }
      } catch {
        // ignore resolution failures
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, receiptNftAddress, tokenId, resolvedTxHash, txHash])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!publicClient) return
      setIsLoading(true)
      setError(null)
      try {
        const receipt = await fetchReceipt(publicClient, receiptNftAddress, tokenId, txHash)
        if (!receipt) {
          throw new Error('Receipt not found')
        }

        const { invoiceContract, invoiceId, payer, token, amount, paidAt, receiptAddress, resolvedToken, txHash: receiptTx } =
          receipt
        setResolvedAddress(receiptAddress)
        setResolvedTokenId(resolvedToken)
        if (!resolvedTxHash && receiptTx) {
          setResolvedTxHash(receiptTx)
        }

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
            if (meta.symbol && meta.symbol !== '???' && meta.symbol !== 'TOKEN') {
              addTokenMeta(token, meta)
            }
          } catch {
            // ignore failures, keep fallback meta
          }
        }

        if (!cancelled) {
          setData({
            invoiceContract,
            invoiceId,
            payer,
            token,
            amount,
            paidAt,
            tokenMeta: meta.symbol ? meta : { ...meta, symbol: meta.symbol || 'TOKEN' }
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, receiptNftAddress, tokenId, txHash, resolvedTxHash])

  const nftLink = `${explorerBase}/nft/${resolvedAddress}/${resolvedTokenId.toString()}`
  const txLink = (resolvedTxHash ?? txHash) ? `${explorerBase}/tx/${resolvedTxHash ?? txHash}` : null
  const invoiceLink = data ? `${explorerBase}/address/${data.invoiceContract}` : null

  return (
    <section className="panel receipt-page">
      <header className="hero">
        <div className="hero-top">
          <div className="logo-mark">
            <img src={logoSvg} alt="Receipt Flow Console" className="logo-icon" />
            <span>Receipt Flow</span>
          </div>
        </div>
        <h1>Receipt NFT</h1>
        <p className="lead">Share or verify the receipt NFT and transaction details.</p>
      </header>

      <div className="card receipt-card">
        <div className="receipt-summary">
          <div className="receipt-meta">
            <p className="eyebrow">Receipt NFT</p>
            <h2>#{resolvedTokenId.toString()}</h2>
            <p className="label micro">NFT address</p>
            <p className="muted mono">{resolvedAddress}</p>
          </div>
        </div>

        {isLoading && <p>Loading receipt...</p>}
        {error && <p className="error">Error: {error}</p>}

        {data && !isLoading && !error && (
          <div className="receipt-body">
            <div className="info-grid two-col">
              <div className="info-card">
                <p className="label">Invoice</p>
                <p className="value">#{data.invoiceId.toString()}</p>
                <p className="muted mono">{data.invoiceContract}</p>
                {invoiceLink && (
                  <a className="icon-link" href={invoiceLink} target="_blank" rel="noreferrer">
                    🔗 View contract
                  </a>
                )}
              </div>
              <div className="info-card">
                <p className="label">Token</p>
                <p className="value">
                  {data.tokenMeta.name ?? data.tokenMeta.symbol} ({data.tokenMeta.symbol})
                </p>
                <p className="muted mono">{data.token}</p>
              </div>
              <div className="info-card">
                <p className="label">Payer</p>
                <p className="value mono">{shortAddress(data.payer, 6)}</p>
                <p className="muted mono">{data.payer}</p>
              </div>
              <div className="info-card">
                <p className="label">Amount</p>
                <p className="value emphasis">
                  {formatAmount(data.amount, data.tokenMeta.decimals)} {data.tokenMeta.symbol}
                </p>
                <p className="muted mono">{data.amount.toString()} wei</p>
              </div>
              <div className="info-card">
                <p className="label">Paid at</p>
                <p className="value">{prettyDate(data.paidAt)}</p>
              </div>
              {txLink && (
                <div className="info-card">
                  <p className="label">Transaction</p>
                  <a className="icon-link" href={txLink} target="_blank" rel="noreferrer">
                    🔗 {shortHash(resolvedTxHash ?? txHash)}
                  </a>
                </div>
              )}
            </div>
            <div className="receipt-actions">
              <p className="label micro">Links</p>
              <a className="btn secondary wide" href={nftLink} target="_blank" rel="noreferrer">
                Open NFT
              </a>
              {txLink && (
                <a className="btn secondary wide" href={txLink} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function formatAmount(value: bigint, decimals: number) {
  const units = Number(formatUnits(value, decimals))
  return units.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function prettyDate(timestamp: bigint) {
  if (!timestamp || timestamp === 0n) return '—'
  return new Date(Number(timestamp) * 1000).toLocaleString()
}

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

function shortHash(value?: string, size = 6) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

async function fetchReceipt(
  publicClient: {
    readContract: typeof import('viem').readContract
    getTransactionReceipt: (args: { hash: string }) => Promise<{
      logs: { topics?: string[]; data: string; transactionHash?: string; address: Address }[]
    }>
  },
  initialAddress: Address,
  initialTokenId: bigint,
  txHash?: string
): Promise<
  | {
      invoiceContract: Address
      invoiceId: bigint
      payer: Address
      token: Address
      amount: bigint
      paidAt: bigint
      receiptAddress: Address
      resolvedToken: bigint
      txHash?: string
    }
  | null
> {
  type ReceiptStruct = {
    invoiceContract?: Address
    invoiceId?: bigint
    payer?: Address
    token?: Address
    amount?: bigint
    paidAt?: bigint
  } & {
    0?: Address
    1?: bigint
    2?: Address
    3?: Address
    4?: bigint
    5?: bigint
  }

  const pickField = <T,>(value: ReceiptStruct, key: keyof ReceiptStruct, index: number, fallback: T): T => {
    const direct = value[key]
    if (direct !== undefined) return direct as T
    const tuple = value as unknown as Array<unknown>
    if (Array.isArray(tuple) && tuple[index] !== undefined) return tuple[index] as T
    return fallback
  }

  const readOnce = async (address: Address, tokenId: bigint) => {
    const r = (await publicClient.readContract({
      address,
      abi: receiptNftAbi,
      functionName: 'getReceipt',
      args: [tokenId]
    })) as ReceiptStruct

    return {
      invoiceContract: pickField<Address>(r, 'invoiceContract', 0, '0x0' as Address),
      invoiceId: pickField<bigint>(r, 'invoiceId', 1, 0n),
      payer: pickField<Address>(r, 'payer', 2, '0x0' as Address),
      token: pickField<Address>(r, 'token', 3, '0x0' as Address),
      amount: pickField<bigint>(r, 'amount', 4, 0n),
      paidAt: pickField<bigint>(r, 'paidAt', 5, 0n)
    }
  }

  // Try the provided address/tokenId first
  try {
    const base = await readOnce(initialAddress, initialTokenId)
    return { ...base, receiptAddress: initialAddress, resolvedToken: initialTokenId }
  } catch (err) {
    // If we have a transaction hash, attempt to discover the correct receipt NFT address & tokenId from logs
    if (!txHash || !publicClient) throw err

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
      const receiptMintedAbi = {
        type: 'event',
        name: 'ReceiptMinted',
        inputs: [
          { name: 'tokenId', type: 'uint256', indexed: true },
          { name: 'invoiceContract', type: 'address', indexed: true },
          { name: 'invoiceId', type: 'uint256', indexed: true },
          { name: 'payer', type: 'address', indexed: false }
        ]
      } as const
      const topics0 = '0xcb133e83919b8bbacb3ab1cb2e9e2744efbd95937f70b5b661ea186688ef1b35' // keccak of ReceiptMinted(uint256,address,uint256,address)

      for (const log of receipt.logs) {
        if (log.topics?.[0]?.toLowerCase() === topics0) {
          try {
            const decoded = decodeEventLog({
              abi: [receiptMintedAbi],
              data: log.data,
              topics: log.topics
            })
            const decodedArgs = decoded.args as { tokenId?: bigint }
            const decodedTokenId = decodedArgs?.tokenId
            const newAddress = log.address as Address
            const tokenIdToUse = decodedTokenId ?? initialTokenId
            const base = await readOnce(newAddress, tokenIdToUse)
            return { ...base, receiptAddress: newAddress, resolvedToken: tokenIdToUse, txHash }
          } catch {
            // ignore decode errors, keep searching
          }
        }
      }
    } catch {
      // ignore tx parsing failures, fall through
    }

    // If all fails, rethrow original error
    throw err
  }
}
