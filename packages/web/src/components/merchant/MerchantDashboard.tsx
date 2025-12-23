import { useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { CreateContractForm } from './CreateContractForm'
import { useInvoiceSummary } from '../../hooks/useInvoiceSummary'

type Props = {
  address?: Address
  ownedContracts: Address[]
  selectedContract?: Address
  onSelectContract: (addr: Address) => void
  onCreateContract: (params: {
    owners: Address[]
    withdrawAddress: Address
    acceptedTokens: Address[]
    requiredApprovals: number
  }) => Promise<void>
  isCreating: boolean
  children?: ReactNode
}

export function MerchantDashboard({
  address,
  ownedContracts,
  selectedContract,
  onSelectContract,
  onCreateContract,
  isCreating,
  children
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const hasOwned = ownedContracts.length > 0
  const currentSelection = selectedContract ?? (hasOwned ? ownedContracts[0] : undefined)

  return (
    <>
      <section className="panel">
        <h2>Merchant console</h2>
        <p className="section-lead">Deploy and manage the invoice contracts you own.</p>
        <article className="card table-card">
          <div className="table-header" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Your contracts</h3>
              {hasOwned && (
                <select
                  value={currentSelection ?? ''}
                  onChange={(e) => onSelectContract(e.target.value as Address)}
                  style={{ minWidth: '260px' }}
                >
                  {ownedContracts.map((addr) => (
                    <option key={addr} value={addr}>
                      {addr}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button type="button" onClick={() => setShowCreate(true)}>
              Add contract
            </button>
          </div>

          {!hasOwned && <p className="empty" style={{ padding: '1rem 1.25rem' }}>No owned contracts detected for this wallet.</p>}

          {hasOwned && currentSelection && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Owners</th>
                    <th>Withdraw</th>
                    <th>Withdraw Approvals</th>
                  </tr>
                </thead>
                <tbody>
                  <ContractRow addr={currentSelection} />
                </tbody>
              </table>
            </div>
          )}
        </article>

        {children}
      </section>
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Deploy new contract</h3>
              <button type="button" className="icon-button" onClick={() => setShowCreate(false)}>
                ✕
              </button>
            </header>
            <div className="modal-body">
              <CreateContractForm
                defaultOwner={address}
                onCreate={async (params) => {
                  await onCreateContract(params)
                  setShowCreate(false)
                }}
                isSubmitting={isCreating}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ContractRow({
  addr
}: {
  addr: Address
}) {
  const summary = useInvoiceSummary(addr, { enablePolling: false, staleTime: Infinity })
  return ( 
    <tr>
      <td>{addr}</td>
      <td>{summary.isLoadingSummary ? '…' : summary.owners.length}</td>
      <td>{summary.isLoadingSummary ? '…' : summary.withdrawAddress}</td>
      <td>{summary.isLoadingSummary ? '…' : summary.requiredApprovals}</td>
    </tr>
  )
}
