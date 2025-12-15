import { QRCodeCanvas } from 'qrcode.react'

type Props = {
  url: string | null
  onClose: () => void
}

export function ShareInvoiceModal({ url, onClose }: Props) {
  if (!url) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Share invoice</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body">
          <p className="mono">{url}</p>
          <div className="modal-actions">
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
              }}
            >
              Copy link
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="link-button">
              Open link
            </a>
          </div>
          <div className="qr-wrapper">
            <QRCodeCanvas value={url} size={140} />
          </div>
        </div>
      </div>
    </div>
  )
}


