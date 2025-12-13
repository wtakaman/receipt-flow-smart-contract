import type { Connector } from 'wagmi'

type Props = {
  isConnected: boolean
  address?: string
  isOwner: boolean
  isCustomer: boolean
  connectors: Connector[]
  connect: (args: { connector: Connector }) => void
  disconnect: () => void
  connectError?: Error | null
  connectPending: boolean
  pendingConnector?: Connector
}

export function ConnectPanel({
  isConnected,
  address,
  isOwner,
  isCustomer,
  connectors,
  connect,
  disconnect,
  connectError,
  connectPending,
  pendingConnector
}: Props) {
  async function handleConnect(connector: Connector) {
    const maybeWindow = typeof window !== 'undefined' ? (window as typeof window & { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }) : undefined
    if (connector.id === 'injected' && maybeWindow?.ethereum?.request) {
      try {
        await maybeWindow.ethereum.request({ method: 'eth_requestAccounts' })
      } catch (err) {
        // User can cancel; we still fall through to wagmi connect
        console.warn('Account request rejected or failed', err)
      }
    }
    connect({ connector })
  }

  return (
    <div className="connect-panel">
      {isConnected ? (
        <>
          <span className="badge">Connected: {shortAddress(address)}</span>
          {isOwner && <span className="badge success">Owner</span>}
          {!isOwner && isCustomer && <span className="badge">Customer</span>}
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </>
      ) : (
        connectors
          .filter((connector) => connector.id !== 'injected') // Remove redundant injected connector
          .map((connector) => {
            const isPending = connectPending && connector.id === pendingConnector?.id
            return (
              <button key={connector.id} type="button" disabled={isPending} onClick={() => handleConnect(connector)}>
                {isPending ? 'Connecting…' : `Connect ${connector.name}`}
              </button>
            )
          })
      )}
      {connectError && <p className="banner info">{connectError.message}</p>}
    </div>
  )
}

function shortAddress(value?: string, size = 4) {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

