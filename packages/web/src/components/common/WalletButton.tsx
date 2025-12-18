import { useEffect, useRef, useState } from 'react'
import type { Connector } from 'wagmi'

type Props = {
  isConnected: boolean
  address?: string
  connectors: Connector[]
  connect: (args: { connector: Connector }) => void
  disconnect: () => void
  connectError?: Error | null
  connectPending: boolean
  pendingConnector?: Connector
}

export function WalletButton({
  isConnected,
  address,
  connectors,
  connect,
  disconnect,
  connectError,
  connectPending,
  pendingConnector
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = connectors.filter((c) => c.id === 'injected' || c.id === 'walletConnect')

  const handleConnect = (connector: Connector) => {
    setOpen(false)
    connect({ connector })
  }

  return (
    <div className="wallet-button" ref={containerRef}>
      {isConnected ? (
        <div className="wallet-connected">
          <span className="badge">Connected: {shortAddress(address)}</span>
          <button type="button" className="btn ghost" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="btn primary" onClick={() => setOpen((v) => !v)}>
            Connect
          </button>
          {open && (
            <div className="wallet-dropdown">
              {filtered.map((connector) => {
                const isPending = connectPending && connector.id === pendingConnector?.id
                return (
                  <button
                    key={connector.id}
                    type="button"
                    className="wallet-dropdown-item"
                    disabled={isPending}
                    onClick={() => handleConnect(connector)}
                  >
                    {isPending ? 'Connecting…' : connector.name}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
      {connectError && <p className="banner info">{connectError.message}</p>}
    </div>
  )
}

function shortAddress(value?: string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}
