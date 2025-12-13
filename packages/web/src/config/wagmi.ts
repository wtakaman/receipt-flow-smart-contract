import { createConfig, http } from 'wagmi'
import { hardhat, polygonMumbai, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectIdRaw = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const projectId = projectIdRaw && !projectIdRaw.startsWith('<') ? projectIdRaw : undefined
// Use public RPC as fallback (CORS-friendly, no block limits)
const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
const mumbaiRpc = import.meta.env.VITE_MUMBAI_RPC_URL
const hardhatRpc = import.meta.env.VITE_HARDHAT_RPC_URL

export const wagmiConfig = createConfig({
  chains: [sepolia, polygonMumbai, hardhat],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [polygonMumbai.id]: http(mumbaiRpc),
    [hardhat.id]: http(hardhatRpc ?? 'http://127.0.0.1:8545')
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

