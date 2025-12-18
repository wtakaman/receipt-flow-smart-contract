import { useEffect, useState } from 'react'
import logoSvg from '../assets/logo.svg'

type Props = {
  onLaunchApp: () => void
}

const steps = [
  {
    title: 'Create a contract',
    copy: 'Spin up an invoice contract with your owners, withdrawal address, and accepted tokens.',
    badge: 'Step 1'
  },
  {
    title: 'Register invoices',
    copy: 'Add customers and amounts in seconds. Share the payment link directly.',
    badge: 'Step 2'
  },
  {
    title: 'Get paid with receipts',
    copy: 'Customers pay in ETH or ERC-20; a Receipt NFT is minted as proof of payment.',
    badge: 'Step 3'
  }
]

const features = [
  {
    title: 'Multi-owner controls',
    copy: 'M-of-N approvals for withdraws and address changes to keep funds safe.',
    icon: 'shield'
  },
  {
    title: 'ETH + ERC-20',
    copy: 'Accept native ETH or supported tokens with allowance checks and SafeERC20 transfers.',
    icon: 'token'
  },
  {
    title: 'Receipt NFTs',
    copy: 'Each payment mints a soulbound receipt with invoice, payer, token, and amount.',
    icon: 'receipt'
  },
  {
    title: 'Governance',
    copy: 'Propose and confirm withdraw address changes with the same approval threshold.',
    icon: 'govern'
  }
]

const testimonials = [
  {
    quote: 'Receipts on-chain give us instant proof of every customer payment.',
    author: 'Finance lead, SaaS vendor (Sepolia pilot)'
  },
  {
    quote: 'Multi-owner withdraw approvals let us ship faster without sacrificing controls on payouts.',
    author: 'Ops manager, digital agency'
  },
  {
    quote: 'Customers love the clear payment trail—Receipt NFTs keep our records auditable.',
    author: 'Accounting lead, B2B marketplace'
  }
]

const faqs = [
  {
    q: 'Do I need my own RPC?',
    a: 'For best results, set a private Sepolia RPC in your .env (e.g., Alchemy/Infura). Public endpoints can rate-limit heavy event polling.'
  },
  {
    q: 'Why use a Receipt NFT instead of just the transaction?',
    a: 'A Receipt NFT encodes payer, invoice ID, token, and amount in one soulbound proof, making it easy to display, audit, and link to invoices—raw transactions alone don’t carry that context.'
  },
  {
    q: 'Where are Receipt NFTs minted?',
    a: 'On the configured ReceiptNFT contract. Each paid invoice mints a soulbound receipt with payer, token, amount, and invoice id.'
  },
  {
    q: 'How do withdraw approvals work?',
    a: 'Withdrawals require the configured M-of-N owner approvals. Requests execute automatically once confirmations meet the threshold.'
  },
  {
    q: 'Can I accept ERC-20 tokens?',
    a: 'Yes. Add supported token addresses when deploying a contract. Customers pay in ETH or any whitelisted ERC-20 with allowance checks.'
  },
  {
    q: 'How fast can I get started?',
    a: 'Deploy a factory and your first contract in minutes on Sepolia; no custom backend needed to register invoices, take payments, and mint receipts.'
  },
  {
    q: 'What proof do customers receive?',
    a: 'Each successful payment mints a non-transferable Receipt NFT containing payer, invoice ID, token, and amount—clear, on-chain proof of payment.'
  },
  {
    q: 'Do I need custom UI to guide payers?',
    a: 'No. The built-in payer flow shows open invoices, supported tokens, and status updates, and links to receipts and transactions.'
  },
  {
    q: 'How are owners protected?',
    a: 'Funds move only with M-of-N approvals. Withdraw and address changes require the same threshold to prevent unilateral actions.'
  },
  {
    q: 'Can I track payments in the dashboard?',
    a: 'Yes. The Paid Invoices view pulls on-chain events, shows receipt token IDs, and links to the explorer for both payments and receipts.'
  },
  {
    q: 'What networks are supported?',
    a: 'Sepolia is ready now; the setup also supports Mumbai and local Hardhat for faster iteration.'
  }
]

export function HomePage({ onLaunchApp }: Props) {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo-mark">
          <img src={logoSvg} alt="Receipt Flow" className="logo-icon" />
          <span>Receipt Flow</span>
        </div>
        <nav>
          <a href="#process">How it works</a>
          <a href="#features">Features</a>
          <a href="#cta">Get started</a>
        </nav>
        <div className="header-actions">
          <a className="link" href="https://github.com/wtakaman/receipt-flow-smart-contract" target="_blank" rel="noreferrer">
            View code
          </a>
          <button className="cta" onClick={onLaunchApp}>
            Launch app
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-text">
          <h1 className="hero-title">
            <span>On-chain invoicing</span>
            <span className="accent">with built-in receipts</span>
          </h1>
          <p className="lead">
            Deploy invoice contracts, guide customers through payment, mint Receipt NFTs as proof, and govern funds with multi-owner controls.
          </p>
          <ul className="pill-row">
            <li>Multi-owner withdraw approvals</li>
            <li>ETH + ERC-20</li>
            <li>Receipt NFTs</li>
          </ul>
          <div className="mini-metrics hero-metrics">
            <div>
              <p className="label">Owners</p>
              <p className="metric">3 of 5</p>
            </div>
            <div>
              <p className="label">Receipts minted</p>
              <p className="metric">1,248</p>
            </div>
            <div>
              <p className="label">Tokens</p>
              <p className="metric">ETH + ERC-20</p>
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
                  <p className="label">Register invoice</p>
                  <p className="small">Share the payment link</p>
                </div>
                <span className="pill muted">Pending</span>
              </div>
              <div className="floating-row">
                <span className="dot success" />
                <div>
                  <p className="label">Customer paid</p>
                  <p className="small">Receipt NFT minted</p>
                </div>
                <span className="pill success">Done</span>
              </div>
              <div className="floating-row">
                <span className="dot" />
                <div>
                  <p className="label">Withdraw queue</p>
                  <p className="small">Multi-owner withdraw approvals</p>
                </div>
                <span className="pill info">2/3</span>
              </div>
            </div>
            <div className="floating-glow" />
          </div>
        </div>
      </section>

      <section className="home-section" id="process">
        <div className="section-header">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title">From contract to paid invoices in minutes</h2>
          <p className="section-lead">Three clear steps: deploy, share, and get paid with on-chain receipts.</p>
        </div>
        <div className="process-grid">
          {steps.map((step, idx) => (
            <article key={step.title} className="process-card">
              <div className="process-head">
                <span className="badge">{step.badge}</span>
              </div>
              <h3>{step.title}</h3>
              <p className="muted">{step.copy}</p>
              <div className="process-visual">
                <div className="process-bars">
                  <span className="bar long" />
                  <span className="bar mid" />
                  <span className="bar short" />
                  <span className="bar mid" />
                  <span className="bar long" />
                </div>
                <div className="process-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="features">
        <div className="section-header">
          <p className="eyebrow">Features</p>
          <h2 className="section-title">Built for teams that need proof and control</h2>
        </div>
        <div className="card-grid features">
          {features.map((feature) => (
            <article key={feature.title} className="card">
              <div className="icon-circle" data-icon={feature.icon} />
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="testimonial">
        <div className="quote">
          <p className="eyebrow">Testimonial</p>
          <h3>“{testimonials[activeTestimonial].quote}”</h3>
          <p className="small">{testimonials[activeTestimonial].author}</p>
        </div>
      </section>

      <section className="cta-banner" id="cta">
        <div>
          <p className="eyebrow">Ready to try it?</p>
          <h2>Launch the app and connect your wallet</h2>
          <p className="small">Deploy on Sepolia testnet, mint receipts, and manage payouts with withdraw approvals.</p>
        </div>
        <button className="cta" onClick={onLaunchApp}>
          Launch app
        </button>
      </section>

      <section className="faq">
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
