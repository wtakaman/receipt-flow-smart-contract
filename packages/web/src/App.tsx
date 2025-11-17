import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import './App.css'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useInvoiceSummary } from './hooks/useInvoiceSummary'
import { useInvoices } from './hooks/useInvoices'
import { useWithdrawals } from './hooks/useWithdrawals'
import { useGovernance } from './hooks/useGovernance'
import { ConnectPanel } from './components/ConnectPanel'
import { InvoicesPanel } from './components/panels/InvoicesPanel'
import { PaymentsPanel } from './components/panels/PaymentsPanel'
import { WithdrawalsPanel } from './components/panels/WithdrawalsPanel'
import { GovernancePanel } from './components/panels/GovernancePanel'

const tabs = ['Invoices', 'Payments', 'Withdrawals', 'Governance'] as const
type Tab = (typeof tabs)[number]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Invoices')
  const { address, isConnected } = useAccount()
  const { connect, connectors, error: connectError, isPending: connectPending, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()

  const summary = useInvoiceSummary()
  const invoicesState = useInvoices(summary.contractAddress)
  const withdrawalsState = useWithdrawals(summary.contractAddress)
  const governanceState = useGovernance(summary.contractAddress, summary.refetchSummary)

  const {
    invoices,
    metrics: invoiceMetrics,
    eventFeed,
    paymentMessage,
    setPaymentMessage,
    registerInvoice,
    removeInvoice,
    payInvoice,
    fetchEventHistory
  } = invoicesState

  useEffect(() => {
    if (!summary.contractAddress) return
    fetchEventHistory()
  }, [summary.contractAddress, fetchEventHistory])

  const isOwner = useMemo(
    () => Boolean(address && summary.owners.some((owner) => owner.toLowerCase() === (address as Address)?.toLowerCase())),
    [address, summary.owners]
  )

  const isCustomer = useMemo(
    () => Boolean(address && invoices.some((invoice) => invoice.customer.toLowerCase() === (address as Address)?.toLowerCase())),
    [address, invoices]
  )

  if (!summary.contractAddress) {
    return (
      <div className="app">
        <header className="hero">
          <h1>Configure contract address</h1>
          <p className="lead">
            Set <code>VITE_SEPOLIA_INVOICE_FLOW_ADDRESS</code> (or another network env var) to start interacting with InvoiceFlow.
          </p>
        </header>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Receipt Flow Console</p>
        <h1>On-chain invoicing dashboard</h1>
        <p className="lead">
          Register invoices, guide customers through payments, orchestrate withdrawals, and govern the withdraw address from the deployed contract.
        </p>
        <ConnectPanel
          isConnected={isConnected}
          address={address}
          isOwner={isOwner}
          isCustomer={isCustomer}
          connectors={connectors}
          connect={connect}
          disconnect={disconnect}
          connectError={connectError}
          connectPending={connectPending}
          pendingConnector={pendingConnector}
        />
        <nav className="tab-nav">
          {tabs.map((tab) => (
            <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'Invoices' && (
        <InvoicesPanel
          isOwner={isOwner}
          supportedTokens={summary.supportedTokens}
          invoices={invoices}
          metrics={invoiceMetrics}
          onRegisterInvoice={registerInvoice}
          onRemoveInvoice={removeInvoice}
        />
      )}

      {activeTab === 'Payments' && (
        <PaymentsPanel
          invoices={invoices}
          isConnected={isConnected}
          onPay={payInvoice}
          paymentStatus={paymentMessage}
          setPaymentStatus={setPaymentMessage}
          eventFeed={eventFeed}
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
    </div>
  )
}
 
