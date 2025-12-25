import { useState } from 'react'
import logoSvg from '../assets/logo.svg'
import flowDiagram from '../assets/flow_diagram.svg'

type Props = {
  onLaunchApp: () => void
}

const faqs = [
  {
    q: 'Is Receipt Flow free to use?',
    a: 'Yes. You can deploy contracts and use the hosted UI for free. You only pay standard network gas fees.'
  },
  {
    q: 'Why "Soulbound" receipts?',
    a: 'They provide an immutable, non-transferable on-chain proof of payment that cannot be forged or sold. Perfect for audits and accounting.'
  },
  {
    q: 'How secure are the contracts?',
    a: 'We use industry-standard OpenZeppelin libraries (SafeERC20) and a comprehensive test suite. The non-custodial design means you always retain control of your funds via Multi-Sig.'
  },
  {
    q: 'Can I accept any token?',
    a: 'Yes. You define the whitelist at deployment. Accept ETH, USDC, USDT, or any ERC-20 token relevant to your business.'
  },
  {
    q: 'Do I need my own infrastructure?',
    a: 'No. The app runs client-side and connects directly to the blockchain (Sepolia/Mumbai/Mainnet) via your wallet RPC.'
  }
]

export function HomePage({ onLaunchApp }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo-mark">
          <img src={logoSvg} alt="Receipt Flow" className="logo-icon" />
          <span>Receipt Flow</span>
        </div>
        <nav>
          <a href="#process">Architecture</a>
          <a href="#features">Capabilities</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="header-actions">
          <button className="cta" onClick={onLaunchApp}>
            Launch app
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-text">
          <h1 className="hero-title">
            <span>Verifiable</span>
            <span className="accent">On-Chain Invoicing</span>
          </h1>
          <p className="lead">
          A shared source of truth for merchants and customers. <br/>
          Issue, track, and verify invoices with immutable on-chain records.
          </p>
          <div className="mini-metrics hero-metrics">
            <div>
              <p className="label">Treasury</p>
              <p className="metric">Multi-Sig</p>
            </div>
            <div>
              <p className="label">Audit Trail</p>
              <p className="metric">On-Chain</p>
            </div>
            <div>
              <p className="label">Cost</p>
              <p className="metric">Gas Only</p>
            </div>
          </div>
        </div>
        <div className="home-hero-visual">
          <div className="blob-layer" />
          <div className="floating-card">
            <p className="eyebrow">Live payment flow</p>
            <div className="floating-rows">
              <div className="floating-row">
                <span className="dot" />
                <div>
                  <p className="label">Deploy Contract</p>
                  <p className="small">Your rules, your keys</p>
                </div>
                <span className="pill muted">Setup</span>
              </div>
              <div className="floating-row">
                <span className="dot success" />
                <div>
                  <p className="label">Client Pays</p>
                  <p className="small">ETH / ERC-20</p>
                </div>
                <span className="pill success">Settled</span>
              </div>
              <div className="floating-row">
                <span className="dot" />
                <div>
                  <p className="label">Proof Minted</p>
                  <p className="small">Soulbound Receipt NFT</p>
                </div>
                <span className="pill info">Automated</span>
              </div>
            </div>
            <div className="floating-glow" />
          </div>
        </div>
      </section>

      <section className="home-section" id="process">
        <div className="section-header">
          <p className="eyebrow">Architecture</p>
          <h2 className="section-title">Trustless Invoicing Flow</h2>
          <p className="section-lead">A fully auditable lifecycle from deployment to withdrawal.</p>
        </div>
        <div className="architecture-diagram">
          <img
            src={flowDiagram}
            alt="Receipt Flow Architecture"
            className="flow-diagram-img"
            style={{
              maxWidth: '800px',
              width: '100%',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'block',
              margin: '0 auto',
              background: '#1a1a1a'
            }}
          />
        </div>
      </section>

      <section className="home-section" id="features">
        <div className="section-header">
          <p className="eyebrow">Capabilities</p>
          <h2 className="section-title">Built for Audit-Grade Operations</h2>
        </div>
        <div className="card-grid features">
          <article className="card">
            <div className="icon-circle" data-icon="shield" />
            <h3>Multi-Sig Treasury</h3>
            <p>Secure your funds with M-of-N owner approvals. No single point of failure for withdrawals or settings.</p>
          </article>
          <article className="card">
            <div className="icon-circle" data-icon="token" />
            <h3>Native Token Support</h3>
            <p>Accept ETH or any ERC-20 stablecoin. Integrated allowance checks and SafeERC20 standards.</p>
          </article>
          <article className="card">
            <div className="icon-circle" data-icon="receipt" />
            <h3>Soulbound Proof</h3>
            <p>Every payment mints an immutable Receipt NFT containing the payer, ID, and amount for instant audits.</p>
          </article>
          <article className="card">
            <div className="icon-circle" data-icon="govern" />
            <h3>On-Chain Governance</h3>
            <p>Manage withdrawal destinations and permissions transparently via the smart contract itself.</p>
          </article>
        </div>
      </section>

      <section className="cta-banner" id="testimonials">
        <div>
          <p className="eyebrow">What builders say</p>
          <h2>“The easiest way to prove on-chain payments.”</h2>
          <p className="small">Auditable receipts, multi-sig control, and ERC-20 flexibility in one flow.</p>
        </div>
        <button className="cta" onClick={onLaunchApp}>
          Launch app
        </button>
      </section>

      <section className="faq" id="faq">
        <div className="section-header">
          <p className="eyebrow">FAQ</p>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>
        <div className="faq-accordion">
          {faqs.map((item, idx) => {
            const open = openFaq === idx
            return (
              <article key={item.q} className={`faq-item ${open ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : idx)}
                >
                  <span>{item.q}</span>
                  <span className="chevron">{open ? '−' : '+'}</span>
                </button>
                {open && <p className="faq-answer muted">{item.a}</p>}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
