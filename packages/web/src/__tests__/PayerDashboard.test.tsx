import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayerDashboard } from '../components/payer/PayerDashboard'
import type { PayerInvoice } from '../hooks/usePayerInvoices'

const addrA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const addrB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const invoices: PayerInvoice[] = [
  {
    id: 1n,
    customer: addrA as `0x${string}`,
    token: addrB as `0x${string}`,
    amountRaw: 1_000_000_000_000_000_000n, // 1 ETH
    expiration: 0n,
    contractAddress: addrB as `0x${string}`
  },
  {
    id: 2n,
    customer: addrA as `0x${string}`,
    token: addrA as `0x${string}`,
    amountRaw: 2_000_000_000_000_000_000n,
    expiration: 1_700_000_000n,
    contractAddress: addrA as `0x${string}`
  }
]

describe('PayerDashboard', () => {
  it('renders invoices and triggers pay and refresh', async () => {
    const user = userEvent.setup()
    const onPay = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    render(
      <PayerDashboard
        invoices={invoices}
        isLoading={false}
        paymentStatus={null}
        setPaymentStatus={() => undefined}
        onRefresh={onRefresh}
        onPay={onPay}
      />
    )

    expect(screen.getByText(/payer console/i)).toBeInTheDocument()
    expect(screen.getByText(/invoices linked to your wallet/i)).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(invoices.length + 1) // header + rows

    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)

    const payButtons = screen.getAllByRole('button', { name: /pay/i })
    await user.click(payButtons[0])
    expect(onPay).toHaveBeenCalledTimes(1)
    expect(onPay).toHaveBeenCalledWith(invoices[0])
  })
})


