# Invoice Flow Smart Contract

Multi-owner escrow for invoice collection where customers can settle invoices with ETH or supported ERC-20 tokens and withdrawals require M-of-N approvals. The repo contains the core processor (`InvoiceFlowContract.sol`), a factory for spawning new processors, tests, and Hardhat tooling.

## Features
- Register invoices with customer, amount, token, and expiry metadata
- Accept ETH or ERC-20 payments with SafeERC20 transfers and allowance checks
- Multi-sig style withdraw queue plus confirmation tracking per owner
- Managed withdraw address changes gated by the same approval threshold
- Factory contract to deploy dedicated processor instances for each business unit

## Getting Started
1. Install dependencies from the repo root (workspace-aware)
   ```bash
   npm install
   ```
   or run commands locally after `cd packages/contracts` if you prefer.
2. Create a `.env` file (use `hardhat.config.example.ts` as a template) with any remote network credentials **and deployment parameters**:
   ```bash
   SEPOLIA_RPC_URL=https://example.alchemy.com/v2/yourKey
   SEPOLIA_PRIVATE_KEY=0xyourwallet
   MUMBAI_RPC_URL=https://example.polygon.com/v2/yourKey
   MUMBAI_PRIVATE_KEY=0xyourwallet
   # comma-separated owner addresses for InvoiceFlowContract
   OWNERS=0xabc...,0xdef...,0x123...
   # address that receives executed withdrawals
   WITHDRAW_ADDRESS=0xfeed...
   # comma-separated list of accepted token addresses (include zero address for ETH)
   ACCEPTED_TOKENS=0x0000000000000000000000000000000000000000,0xToken...
   # approval threshold (<= owners.length)
   REQUIRED_SIGNATURES=2
   ```
   Leave fields blank when you only need the built-in `hardhat` network, but keep owners/withdraw/tokens filled before hitting deploy.

3. Common commands
   ```bash
   # run the mocha/ethers suite on the Hardhat network
   npm run test             # inside packages/contracts
   npm run test:contracts   # from the repo root

   # collect solidity-coverage output
   npm run coverage

   # compile or deploy against a configured network
   npm run compile:hardhat
   npm run compile:sepolia
   npm run deploy:sepolia
   npm run deploy:mumbai
   ```

## Project Structure
- `contracts/InvoiceFlowContract.sol` – core logic for invoices, payments, withdrawals, and governance
- `contracts/InvoiceFlowContractFactory.sol` – factory to instantiate configured processors
- `scripts/deploy.js` – Hardhat deployment helper (see `scripts/deploy.example.js` for parameter hints)
- `test/*.test.js` – mocha suites (chai + hardhat-chai-matchers) covering constructor guards, invoice lifecycle, withdrawals, and governance flows

## Security Notes
- Never commit private keys or RPC secrets; keep them in `.env` files outside version control.
- Review the `owners` array and `requiredOwnersApprovals` before deploying—withdrawals and address changes depend on them.
- `supportedTokens` entries must be real ERC-20 contracts; invalid addresses are rejected at deployment time.

## Contributing
Run tests (and coverage when relevant) before opening a PR:
```bash
npm run test && npm run coverage
```
Please include reproduction steps, network information, and any additional context when filing issues. All contributions should remain compatible with Solidity `0.8.9` unless we explicitly agree to bump the compiler version.
