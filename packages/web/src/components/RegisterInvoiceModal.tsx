import type { Address } from 'viem'
import { getTokenMeta, normalizeAddressInput } from '../config/contracts'

type FormState = {
  id: string
  customer: string
  amount: string
  token: Address
  expiresInDays: string
}

type Props = {
  open: boolean
  supportedTokens: Address[]
  defaultToken: Address
  onClose: () => void
  onSubmit: (params: {
    id: bigint
    customer: Address
    token: Address
    amount: string
    decimals: number
    expiresInDays: number
  }) => Promise<void>
}

export function RegisterInvoiceModal({ open, supportedTokens, defaultToken, onClose, onSubmit }: Props) {
  const tokens = supportedTokens.length ? supportedTokens : [defaultToken]
  const [form, setForm] = useState<FormState>({
    id: '',
    customer: '',
    amount: '',
    token: tokens[0],
    expiresInDays: '30'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const idNum = BigInt(form.id || '0')
    const customer = normalizeAddressInput(form.customer) as Address | undefined
    if (!idNum || !customer) return
    const tokenMeta = getTokenMeta(form.token)
    setIsSubmitting(true)
    try {
      await onSubmit({
        id: idNum,
        customer,
        token: form.token,
        amount: form.amount || '0',
        decimals: tokenMeta.decimals,
        expiresInDays: Number(form.expiresInDays || '30')
      })
      setForm({ ...form, id: '', customer: '', amount: '' })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Register invoice</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body">
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Invoice ID
              <input
                type="number"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. 101"
                required
              />
            </label>
            <label>
              Customer address
              <input
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                placeholder="0x..."
                required
              />
            </label>
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </label>
            <label>
              Token
              <select value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value as Address })}>
                {tokens.map((token) => {
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
                onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

