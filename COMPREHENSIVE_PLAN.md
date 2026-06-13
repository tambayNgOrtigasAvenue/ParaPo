# ParaPo — Decentralized PUV Fare Wallet on Stellar

> "ParaPo!" is what Filipino commuters shout to signal a stop. This project turns
> that moment into an exact, trustless, on-chain fare settlement.

ParaPo is a decentralized fare-payment platform for Philippine Public Utility
Vehicles (Jeepneys, E-Jeeps, Buses). Commuters and drivers each hold a
**non-custodial Stellar wallet**. Fares are paid in a **PHP-pegged stablecoin
(PHPx)**, escrowed on-chain in a **Soroban smart contract**, GPS-tracked, and
settled with **automatic partial-route refunds**. Drivers withdraw their
decentralized earnings via Stellar's low-fee network.

## Problems solved

| Problem | ParaPo solution |
| --- | --- |
| Driver earnings centralized / held by coop or gov | Non-custodial Stellar keypair per driver. The cooperative gets **read-only visibility**, never custody. |
| Commuter has no exact change; driver struggles with change | Exact digital fare. Escrow + smart-contract math removes cash change entirely. |
| Driver gives wrong change | Contract computes and releases the exact fare and refund. No human error. |
| Beep cards lock funds; e-wallets unreliable on bad networks | PHPx is withdrawable anytime; the PWA is offline-first (queue + deferred submit). |

## How it works

1. **Driver starts a biyahe (session).** The app shows a **rotating, signed QR
   code** (rotates every ~15s, encodes session id + nonce + timestamp to block
   screenshot replay).
2. **Commuter scans to board.** This calls `start_ride`, locking the **maximum
   end-to-end fare** for the route into the escrow contract.
3. **GPS tracks the route** for both wallets.
4. **Commuter re-scans to alight.** This calls `finalize_ride`. The contract
   pays the driver the **actual fare** for the distance travelled and **refunds
   the remainder** to the commuter.

```
Board  --> start_ride(max_fare)  --> escrow locks max_fare
Alight --> finalize_ride(fare)   --> driver gets fare, commuter refunded the rest
```

## Monorepo layout

```
parapo/
├── contracts/
│   └── fare-escrow/        # Soroban smart contract (Rust)
├── web/                    # Next.js PWA (driver + commuter + coop)
├── scripts/                # PHPx issuance, SAC wrap, deploy, seed-demo (Node)
├── oracle/                 # Route fare-matrix + GPS attestation API (Node)
└── Cargo.toml              # Rust workspace
```

## Quick start

### 1. Build & test the contract

```bash
rustup target add wasm32v1-none      # if not already installed
cargo test                            # run contract unit tests (11 tests)
stellar contract build                # build the wasm
```

> Windows without MSVC Build Tools: Rust needs a host linker for proc-macros. The
> simplest fix is the GNU toolchain, which ships its own linker:
>
> ```bash
> rustup toolchain install stable-x86_64-pc-windows-gnu
> rustup override set stable-x86_64-pc-windows-gnu
> rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu
> ```

### 2. Issue PHPx + deploy escrow to testnet

```bash
cd scripts
npm install
npm run setup        # creates issuer/distributor, issues PHPx, wraps SAC
npm run deploy       # builds + deploys fare-escrow, writes web/.env.local
npm run seed         # funds demo driver/commuter wallets with PHPx
```

### 3. Run the web app

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

### 4. (Optional) Run the oracle

```bash
cd oracle
npm install
npm run dev          # http://localhost:4000
```

## Tech

- **Stellar / Soroban** — escrow smart contract, PHPx Stellar Asset Contract.
- **Next.js + TypeScript + Tailwind** — installable PWA, one app with three roles.
- **@stellar/stellar-sdk** — Horizon + Soroban RPC.
- **In-browser non-custodial wallet** — keypair generated client-side, encrypted
  in IndexedDB. No extension required (works on mobile browsers).

> Testnet only. No real funds are ever used.

## License

MIT
