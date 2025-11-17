# Receipt Flow Monorepo

This repository hosts both the smart contracts and the (work-in-progress) web UI for the Receipt Flow platform. Everything is wired together with npm workspaces so you can install dependencies, run tests, and launch the UI from a single root.

## Directory Layout

```
packages/
  contracts/   # Hardhat project that previously lived at the repo root
  web/         # Vite + React + TypeScript frontend scaffold
```

- `packages/contracts` contains the Invoice Flow smart contracts, factory, scripts, and tests. See `packages/contracts/README.md` for contract-specific commands and deployment details.
- `packages/web` is the starting point for the UI. It currently renders a placeholder React page you can extend with wallet connections, invoice forms, and dashboard views.

## Getting Started

```bash
npm install                # install dependencies for every workspace
npm run test:contracts     # run the Hardhat test suite
npm run coverage:contracts # solidity-coverage via Hardhat
npm run dev:web            # start the Vite dev server (http://localhost:5173)
```

You can also `cd packages/contracts` or `cd packages/web` and run the scripts locally if you prefer.

## Environment Variables

Contracts expect a `.env` file inside `packages/contracts` (see `hardhat.config.example.ts`) with entries such as:

```
SEPOLIA_RPC_URL=https://example.alchemy.com/v2/yourKey
SEPOLIA_PRIVATE_KEY=0xyourwallet
MUMBAI_RPC_URL=https://example.polygon.com/v2/yourKey
MUMBAI_PRIVATE_KEY=0xyourwallet
```

The frontend will eventually use its own `.env` (e.g., `packages/web/.env.local`) with `VITE_`-prefixed variables for deployed contract addresses and network metadata.

## Next Steps

- Build the UI flows in `packages/web` (invoice list, payment wizard, multisig approvals, governance dashboard).
- Share contract ABIs and addresses with the UI (either by importing from `packages/contracts/artifacts` or by exporting a small shared package).
- Extend CI to run `npm run test:contracts` and `npm run build:web`.

With this structure you can iterate on the blockchain layer and the user experience side-by-side without juggling multiple repositories. Happy hacking!

