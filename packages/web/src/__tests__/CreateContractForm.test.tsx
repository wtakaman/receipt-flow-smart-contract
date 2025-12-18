import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateContractForm } from '../components/merchant/CreateContractForm'

const ownerA = '0x1111111111111111111111111111111111111111'
const ownerB = '0x2222222222222222222222222222222222222222'
const withdraw = '0x3333333333333333333333333333333333333333'
const token = '0x4444444444444444444444444444444444444444'

describe('CreateContractForm', () => {
  it('submits parsed owners, tokens, and approvals', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    render(<CreateContractForm defaultOwner={ownerA as `0x${string}`} onCreate={onCreate} isSubmitting={false} />)

    // First owner input is pre-filled with defaultOwner and is readonly (connected wallet)
    const ownerInputs = screen.getAllByPlaceholderText('0x...')
    expect(ownerInputs[0]).toHaveValue(ownerA)
    expect(ownerInputs[0]).toHaveAttribute('readonly')

    // Add second owner
    await user.click(screen.getByRole('button', { name: /add owner/i }))
    const updatedOwnerInputs = screen.getAllByPlaceholderText('0x...')
    await user.type(updatedOwnerInputs[1], ownerB)

    // Fill other fields
    await user.clear(screen.getByLabelText(/Withdraw address/i))
    await user.type(screen.getByLabelText(/Withdraw address/i), withdraw)
    await user.type(screen.getByLabelText(/Token addresses/i), token)
    await user.clear(screen.getByLabelText(/Required approvals/i))
    await user.type(screen.getByLabelText(/Required approvals/i), '2')

    await user.click(screen.getByRole('button', { name: /create contract/i }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({
      owners: [ownerA, ownerB],
      withdrawAddress: withdraw,
      acceptedTokens: [token],
      requiredApprovals: 2
    })
  })
})


