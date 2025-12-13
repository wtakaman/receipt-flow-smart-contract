import { useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { CreateContractForm } from './CreateContractForm'
import { useInvoiceSummary } from '../../hooks/useInvoiceSummary'

type Props = {
  address?: Address
  deployedContracts: Address[]
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
  deployedContracts,
  ownedContracts,
  selectedContract,
  onSelectContract,
  onCreateContract,
  isCreating
}: Props) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <section className="panel">
        <h2>Merchant console</h2>
        <p className="section-lead">Deploy and manage the invoice contracts you own.</p>
        <div className="grid split">
          <article className="card">
            <div className="table-header">
              <h3>Your contracts</h3>
              <button type="button" onClick={() => setShowCreate(true)}>
                Add contract
              </button>
            </div>
            {ownedContracts.length === 0 && <p className="empty">No owned contracts detected for this wallet.</p>}
            {ownedContracts.length > 0 && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Owners</th>
                      <th>Withdraw</th>
                      <th>Approvals</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ownedContracts.map((addr) => (
                      <ContractRow
                        key={addr}
                        addr={addr}
                        selectedContract={selectedContract}
                        onSelectContract={onSelectContract}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {deployedContracts.length > 0 && (
              <p className="hint">
                All deployed contracts ({deployedContracts.length}):{' '}
                {deployedContracts.map((addr) => shortAddress(addr)).join(', ')}
              </p>
            )}
          </article>
        </div>
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
  addr,
  selectedContract,
  onSelectContract
}: {
  addr: Address
  selectedContract?: Address
  onSelectContract: (addr: Address) => void
}) {
  const summary = useInvoiceSummary(addr)
  return (
    <tr>
      <td>{shortAddress(addr)}</td>
      <td>{summary.isLoadingSummary ? '…' : summary.owners.length}</td>
      <td>{summary.isLoadingSummary ? '…' : shortAddress(summary.withdrawAddress)}</td>
      <td>{summary.isLoadingSummary ? '…' : summary.requiredApprovals}</td>
      <td>
        <div className="row-actions">
          <button
            type="button"
            className={addr === selectedContract ? 'active' : ''}
            onClick={() => onSelectContract(addr)}
          >
            Select
          </button>
          <a className="icon-link" href={`#/contract/${addr}`}>
            Manage
          </a>
        </div>
      </td>
    </tr>
  )
}

function shortAddress(value?: Address | string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}


