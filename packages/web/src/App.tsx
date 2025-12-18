import { useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import './App.css'
import logoSvg from './assets/logo.svg'
import { useAccount, useConnect, useDisconnect, usePublicClient } from 'wagmi'
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
import { usePaidInvoices } from './hooks/usePaidInvoices'
import { invoiceFlowAbi, normalizeAddressInput } from './config/contracts'
import { InvoicePage } from './components/InvoicePage'
import { ContractPage } from './components/ContractPage'
import { ReceiptPage } from './components/ReceiptPage'
import { HomePage } from './components/HomePage'
import { WalletButton } from './components/common/WalletButton'

type Role = 'merchant' | 'payer'
const tabs = ['Invoices', 'Withdrawals', 'Governance'] as const
type Tab = (typeof tabs)[number]
type Route =
  | { type: 'home' }
  | { type: 'app' }
  | {
      type: 'invoice'
      contractAddress: Address
      invoiceId: bigint
    }
  | {
      type: 'contract'
      contractAddress: Address
    }
  | {
      type: 'receipt'
      receiptNftAddress: Address
      tokenId: bigint
      txHash?: string
    }

function parseHash(): Route {
  const rawHash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '')
  const [path, query] = rawHash.split('?')
  const parts = path.split('/').filter(Boolean)
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
  if (parts[0] === 'receipt' && parts[1] && parts[2]) {
    const receiptAddress = normalizeAddressInput(parts[1]) as Address | undefined
    try {
      const tokenId = BigInt(parts[2])
      if (receiptAddress) {
        const params = new URLSearchParams(query ?? '')
        const txHash = params.get('tx') ?? undefined
        return { type: 'receipt', receiptNftAddress: receiptAddress, tokenId, txHash: txHash || undefined }
      }
    } catch {
      // ignore parse errors
    }
  }
  if (parts[0] === 'app') {
    return { type: 'app' }
  }
  if (parts[0] === 'contract' && parts[1]) {
    const contract = normalizeAddressInput(parts[1]) as Address | undefined
    if (contract) return { type: 'contract', contractAddress: contract }
  }
  return { type: 'home' }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash())
  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (route.type === 'home') {
    return (
      <div className="app marketing">
        <HomePage
          onLaunchApp={() => {
            window.location.hash = 'app'
            setRoute({ type: 'app' })
          }}
        />
      </div>
    )
  }

  return <MainApp route={route} />
}

function MainApp({ route }: { route: Route }) {
  const [role, setRole] = useState<Role>('payer')
  const [activeTab, setActiveTab] = useState<Tab>('Invoices')
  const [selectedContract, setSelectedContract] = useState<Address | undefined>()
  const [ownedContracts, setOwnedContracts] = useState<Address[]>([])
  const prevContractsCount = useRef(0)

  const { address, isConnected } = useAccount()
  const { connect, connectors, error: connectError, isPending: connectPending, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()

  const factoryState = useFactory()
  const payerContracts = useMemo(() => Array.from(new Set([...(factoryState.allContracts ?? [])])), [factoryState.allContracts])
  const payerState = usePayerInvoices(factoryState.factoryAddress, address as Address | undefined, payerContracts)

  const summary = useInvoiceSummary(selectedContract)
  const invoicesState = useInvoices(summary.contractAddress)
  const withdrawalsState = useWithdrawals(summary.contractAddress, summary.supportedTokens)
  const governanceState = useGovernance(summary.contractAddress, summary.refetchSummary)
  const paidInvoicesState = usePaidInvoices(summary.contractAddress)

  const isOwner = useMemo(() => {
    if (!address) return false
    return summary.owners.some((owner) => owner && owner.toLowerCase() === (address as Address)?.toLowerCase())
  }, [address, summary.owners])

  useEffect(() => {
    if (!selectedContract && summary.contractAddress) {
      setSelectedContract(summary.contractAddress)
    }
  }, [selectedContract, summary.contractAddress])

  useEffect(() => {
    if (!publicClient || !address || !factoryState.deployedContracts.length) {
      setTimeout(() => setOwnedContracts([]), 0)
      return
    }
    let cancelled = false
    ;(async () => {
      const owned: Address[] = []
      // Limit to first 10 contracts to prevent RPC spam
      const contractsToCheck = factoryState.deployedContracts.slice(0, 10)
      for (const contractAddress of contractsToCheck) {
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
      if (owned.length) {
        setRole('merchant')
        setSelectedContract((prev) => prev ?? owned[0])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, factoryState.deployedContracts.length, publicClient])

  useEffect(() => {
    const currentLength = factoryState.deployedContracts.length
    if (currentLength > prevContractsCount.current) {
      const latest = factoryState.deployedContracts[currentLength - 1]
      if (latest && ownedContracts.includes(latest)) {
        setSelectedContract((prev) => prev ?? latest)
        setRole('merchant')
      }
    }
    prevContractsCount.current = currentLength
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryState.deployedContracts.length])

  useEffect(() => {
    payerState.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, factoryState.factoryAddress, factoryState.deployedContracts.length])

  useEffect(() => {
    if (!isConnected) {
      setRole('payer')
      setSelectedContract(undefined)
      setOwnedContracts([])
    }
  }, [isConnected])

  const walletButton = (
    <WalletButton
      isConnected={isConnected}
      address={address}
      connectors={connectors}
      connect={connect}
      disconnect={disconnect}
      connectError={connectError}
      connectPending={connectPending}
      pendingConnector={pendingConnector}
    />
  )

  return (
    <div className="app">
      {route.type === 'app' && (
        <header className="hero">
          <div className="hero-top">
            <div className="logo-mark">
              <img src={logoSvg} alt="Receipt Flow Console" className="logo-icon" />
              <span>Receipt Flow</span>
            </div>
            <div className="hero-actions">{walletButton}</div>
          </div>
          <h1>Operate your on-chain invoicing</h1>
          <p className="lead">
            Connect your wallet, choose your role, and manage invoices, receipts, and withdrawals.
          </p>
          <RoleSelector role={role} onSelect={setRole} />
        </header>
      )}

      {route.type === 'receipt' ? (
        <ReceiptPage receiptNftAddress={route.receiptNftAddress} tokenId={route.tokenId} txHash={route.txHash} />
      ) : route.type === 'invoice' ? (
        <InvoicePage
          contractAddress={route.contractAddress}
          invoiceId={route.invoiceId}
          address={address as Address | undefined}
          isConnected={isConnected}
          walletButton={walletButton}
        />
      ) : route.type === 'contract' ? (
        <ContractPage
          contractAddress={route.contractAddress}
          address={address as Address | undefined}
          walletButton={walletButton}
        />
      ) : role === 'merchant' ? (
        <MerchantDashboard
          address={address as Address | undefined}
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
              paidInvoices={paidInvoicesState.paidInvoices}
              isPaidLoading={paidInvoicesState.isLoading}
              paidError={paidInvoicesState.error}
              hasFetchedPaid={paidInvoicesState.hasFetched}
              onFetchPaid={paidInvoicesState.fetch}
              onRefreshPaid={paidInvoicesState.refetch}
              chainId={summary.chainId}
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
              balances={withdrawalsState.balances}
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
 
