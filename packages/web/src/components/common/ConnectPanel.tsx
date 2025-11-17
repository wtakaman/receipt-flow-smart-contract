import { useAccount, useConnect, useDisconnect } from 'wagmi'
import type { ReactNode } from 'react'
import { shortAddress } from '../../lib/format'

type Props = {
  roleBadges?: ReactNode
}

export function ConnectPanel({ roleBadges }: Props) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, error, isPending, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <div className="connect-panel">
      {isConnected ? (
        <>
          <span className="badge">Connected: {shortAddress(address)}</span>
          {roleBadges}
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        </>
      ) : (
        connectors.map((connector) => (
          <button
            key={connector.id}
            type="button"
            disabled={!connector.ready || (isPending && connector.id === pendingConnector?.id)}
            onClick={() => connect({ connector })}
          >
            Connect {connector.name}
          </button>
        ))
      )}
      {error && <p className="banner info">{error.message}</p>}
    </div>
  )
}

