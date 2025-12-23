# Receipt Flow

Multi-owner escrow, invoice payments, and soulbound payment receipts in one stack. This monorepo houses the smart contracts and the React UI.

## Problem Statement
- Businesses need secure invoice payment collection that supports crypto.
- Traditional flows lack transparent, on-chain proof of payment.
- Treasury releases often require multi-party approvals.
- Accounting and audits benefit from immutable receipts tied to each payment.

## Solution
- **Multi-owner escrow contract**: M-of-N approvals to register invoices, withdraw funds, and change treasury address.
- **Soulbound receipts**: Non-transferable ERC-721 receipts minted per payment for auditability.
- **Flexible payments**: Accept ETH and any whitelisted ERC-20 with SafeERC20 transfers.
- **Factory pattern**: Spawn dedicated processors per business unit with shared defaults.
- **Non-custodial design**: Funds live on-chain; withdrawals respect configured approvals.

## Architecture

```mermaid
flowchart LR
  merchant[Merchant/Owners (wallets)]
  customer[Customer (wallet)]
  ui[React UI (Vite + wagmi/viem)]
  factory[InvoiceFlowContractFactory]
  processor[InvoiceFlowContract]
  receiptNFT[ReceiptNFT (soulbound)]
  storage[On-chain Storage]

  merchant -->|Configure owners, tokens, withdraw address| factory
  factory -->|Deploys| processor
  ui <-->|RPC (Sepolia/Mumbai/Hardhat)| processor
  ui <-->|RPC| factory
  customer -->|Pay invoice (ETH/ERC-20)| processor
  processor -->|Mint receipt| receiptNFT
  processor -->|Funds held| storage
  merchant -->|Approve withdraw| processor
  processor -->|Payout to withdraw address| storage
```

See the visual at `packages/web/src/assets/flow_diagram.svg` for a styled version.

## Monorepo Layout
- `packages/contracts` – Hardhat project with `InvoiceFlowContract`, factory, ReceiptNFT, scripts, and tests.
- `packages/web` – React + Vite UI that integrates wagmi/viem.

## Deployed Addresses (Sepolia, chainId 11155111)
| Contract | Address | Notes |
| --- | --- | --- |
| TakaCoin (test ERC-20) | `0xf897B4F27b3aCA64b24f4a3d57AB7afC49DFd72E` | Verified via `scripts/verify-takacoin.js` |
| InvoiceFlowContract | _fill with deployed address_ | Set `VITE_SEPOLIA_INVOICE_FLOW_ADDRESS` in `packages/web/.env` |
| InvoiceFlowContractFactory | _fill with deployed address_ | Set `VITE_SEPOLIA_FACTORY_ADDRESS` |
| ReceiptNFT | _fill with deployed address_ | Set `VITE_SEPOLIA_RECEIPT_NFT_ADDRESS` |

Update the table after deployment and add Etherscan links as needed.

## How to Run Locally
1) Install deps (workspace-aware):
```bash
npm install
```
2) Configure env:
- `packages/contracts/.env` (see `hardhat.config.example.ts`): `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, `OWNERS`, `WITHDRAW_ADDRESS`, `ACCEPTED_TOKENS`, `REQUIRED_SIGNATURES`, optional `SKIP_TOKEN_VALIDATION`.
- `packages/web/.env` (or `.env.local`): RPC URLs and contract addresses (`VITE_SEPOLIA_*`, `VITE_HARDHAT_*`), optional token metadata.
3) Local Hardhat node (optional):
```bash
cd packages/contracts
npx hardhat node
```
4) Deploy locally (Hardhat network):
```bash
npm run deploy:hardhat --workspace packages/contracts
```
5) Start the UI:
```bash
npm run dev:web
```
Open <http://localhost:5173> and connect your wallet (Hardhat or Sepolia).

## Scripts (contracts workspace)
- `npm run deploy:sepolia` – Deploy `InvoiceFlowContract` using `packages/contracts/.env`.
- `npm run deploy:factory:sepolia` – Deploy `InvoiceFlowContractFactory`.
- `npm run deploy:takacoin:sepolia` – Deploy test ERC-20.
- Verify on Sepolia: either `npm run verify:takacoin:sepolia` or `npx hardhat verify --network sepolia <address> <ctor args>`.
- Tests: `npm run test:contracts`
- Coverage: `npm run coverage:contracts`

## Tests
Smart-contract tests live in `packages/contracts/test`.
- **Access control**: Constructor guards (OWNERS_ARE_REQUIRED, WITHDRAW_ADDRESS_REQUIRED, INVALID_APPROVALS_NUMBER) and `onlyOwners` enforcement (UNAUTHORIZED) on invoice, withdraw, and governance flows.
- **State transitions**: Invoice lifecycle (register/pay/remove), withdraw workflow (register/approve/execute with balance checks), withdraw-address change (request/confirm/change), and view helpers.
- **Event emissions**: `InvoiceRegistered`, `InvoicePaid`, `InvoiceRemoved`, `WithdrawRequestRegistered`, `WithdrawRequestApproved`, `WithdrawRequestExecuted`, `WithdrawAddressChangeRequested/Approved/Changed`.

## Branch Policy
`master` is protected. Open PRs for changes, get approval, and ensure tests pass before merge.

## Security Notes
- Uses OpenZeppelin SafeERC20 for ERC-20 transfers.
- Non-custodial design with M-of-N approvals on withdrawals and address changes.
- Receipts are soulbound to prevent resale/fraud; minting only by authorized invoice contracts.

## Contributing
- Run `npm run test:contracts` and `npm run coverage:contracts` before PRs.
- Keep secrets in local `.env` files; never commit keys.

## License
MIT. See repository for details.

