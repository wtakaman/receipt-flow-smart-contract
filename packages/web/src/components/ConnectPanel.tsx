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
        connectors.map((connector) => {
          const disabled = !connector.ready || (connectPending && connector.id === pendingConnector?.id)
          return (
            <button key={connector.id} type="button" disabled={disabled} onClick={() => connect({ connector })}>
              {connector.ready ? `Connect ${connector.name}` : `${connector.name} unavailable`}
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

