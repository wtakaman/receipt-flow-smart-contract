import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoleSelector } from '../components/RoleSelector'

describe('RoleSelector', () => {
  it('renders both roles and triggers selection', () => {
    const onSelect = vi.fn()
    render(<RoleSelector role="merchant" onSelect={onSelect} />)

    const merchantBtn = screen.getByRole('button', { name: /merchant view/i })
    const payerBtn = screen.getByRole('button', { name: /payer view/i })

    expect(merchantBtn).toHaveClass('active')
    expect(payerBtn).not.toHaveClass('active')

    fireEvent.click(payerBtn)
    expect(onSelect).toHaveBeenCalledWith('payer')
  })
})


