import { useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import './App.css'
import { useAccount, useConnect, useDisconnect, usePublicClient } from 'wagmi'
import { ConnectPanel } from './components/ConnectPanel'
import { InvoicesPanel } from './components/panels/InvoicesPanel'
import { WithdrawalsPanel } from './components/panels/WithdrawalsPanel'
import { GovernancePanel } from './components/panels/GovernancePanel'
import { RoleSelector } from './components/RoleSelector'
import { MerchantDashboard } from './components/merchant/MerchantDashboard'
import { PayerDashboard } from './components/payer/PayerDashboard'
import { useInvoiceSummary } from './hooks/useInvoiceSummary'
import { useInvoices } from './hooks/useInvoices'
import { useWithdrawals } from './hooks/useWithdrawals'
import { useGovernance } from './hooks/useGovernance'
import { useFactory } from './hooks/useFactory'
import { usePayerInvoices } from './hooks/usePayerInvoices'
import { invoiceFlowAbi, normalizeAddressInput } from './config/contracts'
import { InvoicePage } from './components/InvoicePage'
import { ContractPage } from './components/ContractPage'

type Role = 'merchant' | 'payer'
const tabs = ['Invoices', 'Withdrawals', 'Governance'] as const
type Tab = (typeof tabs)[number]
type Route =
  | { type: 'home' }
  | {
      type: 'invoice'
      contractAddress: Address
      invoiceId: bigint
    }
  | {
      type: 'contract'
      contractAddress: Address
    }

function parseHash(): Route {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '')
  const parts = hash.split('/').filter(Boolean)
  if (parts[0] === 'invoice' && parts[1] && parts[2]) {
    const contract = normalizeAddressInput(parts[1]) as Address | undefined
    try {
      const invoiceId = BigInt(parts[2])
      if (contract) {
        return { type: 'invoice', contractAddress: contract, invoiceId }
      }
    } catch {
      // ignore parse errors
    }
  }
  if (parts[0] === 'contract' && parts[1]) {
    const contract = normalizeAddressInput(parts[1]) as Address | undefined
    if (contract) return { type: 'contract', contractAddress: contract }
  }
  return { type: 'home' }
}

export default function App() {
  const [role, setRole] = useState<Role>('payer')
  const [activeTab, setActiveTab] = useState<Tab>('Invoices')
  const [selectedContract, setSelectedContract] = useState<Address | undefined>()
  const [ownedContracts, setOwnedContracts] = useState<Address[]>([])
  const prevContractsCount = useRef(0)

  const { address, isConnected } = useAccount()
  const { connect, connectors, error: connectError, isPending: connectPending, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const [route, setRoute] = useState<Route>(() => parseHash())

  const factoryState = useFactory()
  const payerContracts = useMemo(() => Array.from(new Set([...(factoryState.allContracts ?? [])])), [factoryState.allContracts])

  const payerState = usePayerInvoices(factoryState.factoryAddress, address as Address | undefined, payerContracts)

  const summary = useInvoiceSummary(selectedContract)
  const invoicesState = useInvoices(summary.contractAddress)
  const withdrawalsState = useWithdrawals(summary.contractAddress)
  const governanceState = useGovernance(summary.contractAddress, summary.refetchSummary)

  const isOwner = useMemo(() => {
    if (!address) return false
    return summary.owners.some((owner) => owner && owner.toLowerCase() === (address as Address)?.toLowerCase())
  }, [address, summary.owners])

  const isCustomer = useMemo(() => {
    if (!address) return false
    return invoicesState.invoices.some(
      (invoice) => invoice.customer && invoice.customer.toLowerCase() === (address as Address)?.toLowerCase()
    )
  }, [address, invoicesState.invoices])

  useEffect(() => {
    if (!selectedContract && summary.contractAddress) {
      setSelectedContract(summary.contractAddress)
    }
  }, [selectedContract, summary.contractAddress])

  useEffect(() => {
    if (!publicClient || !address || !factoryState.deployedContracts.length) {
      setOwnedContracts([])
      return
    }
    let cancelled = false
    ;(async () => {
      const owned: Address[] = []
      for (const contractAddress of factoryState.deployedContracts) {
        try {
          const data = (await publicClient.readContract({
            address: contractAddress,
            abi: invoiceFlowAbi,
            functionName: 'getSummary'
          })) as [Address[], Address[], Address, bigint]
          const owners = data?.[0] ?? []
          if (owners.some((owner) => owner.toLowerCase() === address.toLowerCase())) {
            owned.push(contractAddress)
          }
        } catch {
          // ignore invalid contract addresses
        }
      }
      if (cancelled) return
      setOwnedContracts(owned)
      if (owned.length && role !== 'merchant') {
        setRole('merchant')
        setSelectedContract((prev) => prev ?? owned[0])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [address, factoryState.deployedContracts, publicClient, role])

  useEffect(() => {
    if (factoryState.deployedContracts.length > prevContractsCount.current) {
      const latest = factoryState.deployedContracts[factoryState.deployedContracts.length - 1]
      if (latest) {
        // Only auto-select if the wallet owns it
        if (ownedContracts.includes(latest)) {
          setSelectedContract((prev) => prev ?? latest)
          if (role !== 'merchant') setRole('merchant')
        }
      }
    }
    prevContractsCount.current = factoryState.deployedContracts.length
  }, [factoryState.deployedContracts, ownedContracts, role])

  useEffect(() => {
    payerState.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, factoryState.factoryAddress, factoryState.deployedContracts, payerState.refresh, payerContracts])

  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    if (!isConnected) {
      setRole('payer')
      setSelectedContract(undefined)
      setOwnedContracts([])
    }
  }, [isConnected])

  return (
    <div className="app">
      {route.type === 'home' && (
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
          <RoleSelector role={role} onSelect={setRole} />
        </header>
      )}

      {route.type === 'invoice' ? (
        <InvoicePage
          contractAddress={route.contractAddress}
          invoiceId={route.invoiceId}
          address={address as Address | undefined}
          isConnected={isConnected}
          connectors={connectors}
          connect={connect}
          disconnect={disconnect}
          connectError={connectError}
          connectPending={connectPending}
          pendingConnector={pendingConnector}
        />
      ) : route.type === 'contract' ? (
        <ContractPage
          contractAddress={route.contractAddress}
          address={address as Address | undefined}
          isConnected={isConnected}
          connectors={connectors}
          connect={connect}
          disconnect={disconnect}
          connectError={connectError}
          connectPending={connectPending}
          pendingConnector={pendingConnector}
        />
      ) : role === 'merchant' ? (
        <MerchantDashboard
          address={address as Address | undefined}
          deployedContracts={factoryState.deployedContracts}
          ownedContracts={ownedContracts}
          selectedContract={selectedContract}
          onSelectContract={setSelectedContract}
          onCreateContract={factoryState.createContract}
          isCreating={factoryState.isCreating}
        >
          <nav className="tab-nav">
            {tabs.map((tab) => (
              <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>

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
        </MerchantDashboard>
      ) : (
        <PayerDashboard
          invoices={payerState.invoices}
          isLoading={payerState.isLoading}
          paymentStatus={payerState.paymentMessage}
          setPaymentStatus={payerState.setPaymentMessage}
          onRefresh={payerState.refresh}
          onPay={payerState.payInvoice}
          chainId={summary.chainId}
        />
      )}
    </div>
  )
}
 
