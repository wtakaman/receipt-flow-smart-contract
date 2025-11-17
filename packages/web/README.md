# Receipt Flow UI (Vite + React)

This package is the front-end workspace inside the monorepo. It ships with Vite, React 19, TypeScript, and ESLint already configured so you can focus on wiring the interface to the smart contracts that live in `packages/contracts`.

## Available Scripts

Run all commands from the repository root unless noted otherwise.

| Command | Description |
| --- | --- |
| `npm run dev:web` | Start the Vite dev server with HMR on <http://localhost:5173> |
| `npm run build:web` | Type-check + create a production build |
| `npm run lint:web` | Run ESLint with the default config |

You can also `cd packages/web` and use the local `npm run dev`, `npm run build`, etc.

## Contract Integration Pointers

- Import ABIs and deployed addresses from `packages/contracts/artifacts` or by publishing a tiny helper module (e.g., `packages/common`).
- Install a wallet layer (`wagmi`, `viem`, `@rainbow-me/rainbowkit`, etc.) and connect to the same networks configured in Hardhat (Sepolia, Mumbai, local Hardhat network).
- Use the contract functions directly:
  - `registerInvoice` / `removeInvoice` for owner flows
  - `handleTransfer` for customer payments
  - `registerWithdrawRequest`, `approveWithdrawRequest`, `executeWithdrawRequest` for treasury releases
  - `changeWithdrawAddressRequest` and `confirmWithdrawAddressChange` for governance
- Listen to emitted events (`InvoiceRegistered`, `InvoicePaid`, `WithdrawRequest*`, `WithdrawAddress*`) to keep UI state in sync without manual refreshes.

## What the Prototype Shows

`src/App.tsx` now implements the flows described in the “Suggested UI Flow” doc:

- **Invoices tab** – register/remove invoices, see live metrics, and simulate “mark paid”.
- **Payments tab** – lookup an invoice as a customer and simulate `handleTransfer`.
- **Withdrawals tab** – submit withdraw requests, track approvals, and simulate execution.
- **Governance tab** – propose and confirm withdraw-address changes with confirmation counts.

Everything is mocked with in-memory state so you can iterate on look & feel before wiring real contract calls.

## Environment Variables

Create `packages/web/.env` (or `.env.local`) with:

```
VITE_SEPOLIA_RPC_URL=https://...
VITE_MUMBAI_RPC_URL=https://...
VITE_HARDHAT_RPC_URL=http://127.0.0.1:8545
VITE_SEPOLIA_INVOICE_FLOW_ADDRESS=0xYourDeployedContract
VITE_MUMBAI_INVOICE_FLOW_ADDRESS=0xOptional
VITE_HARDHAT_INVOICE_FLOW_ADDRESS=0xOptional
VITE_WALLETCONNECT_PROJECT_ID=yourProjectId
# Optional ERC-20 metadata for nicer labels
VITE_SAMPLE_ERC20_ADDRESS=0x...
VITE_SAMPLE_ERC20_SYMBOL=TTK
VITE_SAMPLE_ERC20_DECIMALS=18
```

With those values in place, the forms and buttons interact with the live InvoiceFlow contract through wagmi/viem, wallet authentication, and event-driven updates.
