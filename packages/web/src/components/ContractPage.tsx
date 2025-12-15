import { useMemo, useState } from 'react'
import type { Address, Connector } from 'viem'
import { useChainId } from 'wagmi'
import { ConnectPanel } from './ConnectPanel'
import { InvoicesPanel } from './panels/InvoicesPanel'
import { PaidInvoicesPanel } from './panels/PaidInvoicesPanel'
import { WithdrawalsPanel } from './panels/WithdrawalsPanel'
import { GovernancePanel } from './panels/GovernancePanel'
import { useInvoiceSummary } from '../hooks/useInvoiceSummary'
import { useInvoices } from '../hooks/useInvoices'
import { usePaidInvoices } from '../hooks/usePaidInvoices'
import { useWithdrawals } from '../hooks/useWithdrawals'
import { useGovernance } from '../hooks/useGovernance'

type Tab = 'Invoices' | 'Paid' | 'Withdrawals' | 'Governance'

type Props = {
  contractAddress: Address
  address?: Address
  isConnected: boolean
  connectors: readonly Connector[]
  connect: (args: { connector: Connector }) => void
  disconnect: () => void
  connectError: Error | null
  connectPending: boolean
  pendingConnector: Connector | undefined
}

export function ContractPage({
  contractAddress,
  address,
  isConnected,
  connectors,
  connect,
  disconnect,
  connectError,
  connectPending,
  pendingConnector
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Invoices')
  const chainId = useChainId()
  const summary = useInvoiceSummary(contractAddress)
  const invoicesState = useInvoices(summary.contractAddress)
  const paidInvoicesState = usePaidInvoices(summary.contractAddress)
  const withdrawalsState = useWithdrawals(summary.contractAddress)
  const governanceState = useGovernance(summary.contractAddress, summary.refetchSummary)

  const isOwner = useMemo(() => {
    if (!address) return false
    return summary.owners.some((owner) => owner && owner.toLowerCase() === address.toLowerCase())
  }, [address, summary.owners])

  return (
    <div className="app">
      <section className="panel">
        <h2>Contract management</h2>
        <p className="lead">Manage invoices, withdrawals, and governance for this contract.</p>
        <div className="row-actions" style={{ marginTop: '0.5rem' }}>
          <a className="link-button" href="#/">
            ← Back to home
          </a>
        </div>
        <ConnectPanel
          isConnected={isConnected}
          address={address}
          isOwner={isOwner}
          isCustomer={false}
          connectors={connectors}
          connect={connect}
          disconnect={disconnect}
          connectError={connectError}
          connectPending={connectPending}
          pendingConnector={pendingConnector}
        />
      </section>

      <section className="panel">
        <div className="table-header">
          <div>
            <p className="label">Contract</p>
            <h3>{contractAddress}</h3>
          </div>
          <nav className="tab-nav">
            {(['Invoices', 'Paid', 'Withdrawals', 'Governance'] as Tab[]).map((tab) => (
              <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'Invoices' && (
          <InvoicesPanel
            isOwner={isOwner}
            supportedTokens={summary.supportedTokens}
            contractAddress={summary.contractAddress}
            invoices={invoicesState.invoices}
            metrics={invoicesState.metrics}
            onRegisterInvoice={invoicesState.registerInvoice}
            onRemoveInvoice={invoicesState.removeInvoice}
          />
        )}

        {activeTab === 'Paid' && (
          <PaidInvoicesPanel
            paidInvoices={paidInvoicesState.paidInvoices}
            isLoading={paidInvoicesState.isLoading}
            error={paidInvoicesState.error}
            hasFetched={paidInvoicesState.hasFetched}
            onFetch={paidInvoicesState.fetch}
            onRefresh={paidInvoicesState.refetch}
            chainId={chainId}
          />
        )}

        {activeTab === 'Withdrawals' && (
          <WithdrawalsPanel
            isOwner={isOwner}
            supportedTokens={summary.supportedTokens}
            requiredApprovals={summary.requiredApprovals}
            ownersCount={summary.owners.length}
            withdrawAddress={summary.withdrawAddress}
            withdrawRows={withdrawalsState.withdrawRows}
            registerWithdraw={withdrawalsState.registerWithdrawRequest}
            approveWithdraw={withdrawalsState.approveWithdrawRequest}
            executeWithdraw={withdrawalsState.executeWithdrawRequest}
          />
        )}

        {activeTab === 'Governance' && (
          <GovernancePanel
            withdrawAddress={summary.withdrawAddress}
            pendingAddress={governanceState.pendingAddress}
            requiredApprovals={summary.requiredApprovals}
            isOwner={isOwner}
            proposeAddress={governanceState.proposeAddress}
            confirmAddress={governanceState.confirmAddress}
          />
        )}
      </section>
    </div>
  )
}


