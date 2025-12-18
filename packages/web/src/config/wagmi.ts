import { createConfig, http } from 'wagmi'
import { hardhat, polygonMumbai, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectIdRaw = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const projectId = projectIdRaw && !projectIdRaw.startsWith('<') ? projectIdRaw : undefined
// Use public RPC as fallback (CORS-friendly, no block limits)
const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
const mumbaiRpc = import.meta.env.VITE_MUMBAI_RPC_URL
const hardhatRpc = import.meta.env.VITE_HARDHAT_RPC_URL

// HTTP transport options to prevent RPC spam
const httpOptions = {
  retryCount: 0, // Disable retries to prevent avalanche on rate-limit
  timeout: 30000,
  batch: {
    batchSize: 100, // Batch up to 100 requests
    wait: 50 // Wait 50ms to collect requests before sending batch
  }
}

export const wagmiConfig = createConfig({
  chains: [sepolia, polygonMumbai, hardhat],
  pollingInterval: 120000, // 2 minutes - reduce load on public RPCs
  syncConnectedChain: false, // Prevent extra chain sync requests
  batch: {
    multicall: true // Enable multicall batching
  },
  transports: {
    [sepolia.id]: http(sepoliaRpc, httpOptions),
    [polygonMumbai.id]: http(mumbaiRpc, httpOptions),
    [hardhat.id]: http(hardhatRpc ?? 'http://127.0.0.1:8545', { ...httpOptions, batch: false })
  },
  connectors: [
    injected({ shimDisconnect: true }),
    projectId
      ? walletConnect({
          projectId,
          showQrModal: true
        })
      : undefined
  ].filter(Boolean) as ReturnType<typeof injected>[]
})

