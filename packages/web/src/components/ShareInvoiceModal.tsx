import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

type Props = {
  url: string | null
  onClose: () => void
}

export function ShareInvoiceModal({ url, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  if (!url) return null

  const handleCopy = async () => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // fallback: do nothing
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Share payment link</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body share-modal-body">
          <p className="share-instruction">
            Send this link to your customer to collect payment
          </p>
          
          <div className="qr-section">
            <div className="qr-code-wrapper">
              <QRCodeCanvas 
                value={url} 
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={true}
              />
            </div>
            <p className="qr-hint">Scan to pay</p>
          </div>

          <div className="share-url-section">
            <label className="share-url-label">Payment URL</label>
            <div className="share-url-box">
              <span className="share-url-text">{url}</span>
              <button
                type="button"
                className={`share-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="share-actions">
            <a href={url} target="_blank" rel="noreferrer" className="share-open-btn">
              Open payment page →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}


