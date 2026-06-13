// Shared configuration + helpers for ParaPo deployment scripts.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  Horizon,
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

// --- Network ---------------------------------------------------------------
export const NETWORK = "testnet";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";

// --- Asset -----------------------------------------------------------------
export const ASSET_CODE = "PHPx";
// PHPx uses 7 decimals (Stellar standard). Issue 100,000,000 PHPx.
export const PHPX_TOTAL_SUPPLY = "100000000";

// --- Paths -----------------------------------------------------------------
export const DEPLOYMENT_FILE = join(ROOT, "deployment.json");
export const WASM_PATH = join(
  ROOT,
  "target",
  "wasm32v1-none",
  "release",
  "fare_escrow.wasm"
);
export const WEB_ENV_FILE = join(ROOT, "web", ".env.local");
export const DEMO_ACCOUNTS_FILE = join(ROOT, "web", "public", "demo-accounts.json");

export const horizon = new Horizon.Server(HORIZON_URL);

// --- Deployment state ------------------------------------------------------
export function loadDeployment() {
  if (existsSync(DEPLOYMENT_FILE)) {
    return JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
  }
  return {};
}

export function saveDeployment(data) {
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(data, null, 2));
  console.log(`  saved -> ${DEPLOYMENT_FILE}`);
}

// --- Account helpers -------------------------------------------------------
export async function fundWithFriendbot(publicKey) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status}`);
  }
  // status 400 usually means "account already funded" — fine for idempotency.
}

/** Create a trustline from `holder` to PHPx and (optionally) pay it some PHPx. */
export async function establishTrustline(holderKeypair, issuerPublicKey) {
  const asset = new Asset(ASSET_CODE, issuerPublicKey);
  const account = await horizon.loadAccount(holderKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(3600)
    .build();
  tx.sign(holderKeypair);
  return horizon.submitTransaction(tx);
}

/** Send PHPx from `fromKeypair` to `destPublicKey`. */
export async function payPHPx(fromKeypair, destPublicKey, issuerPublicKey, amount) {
  const asset = new Asset(ASSET_CODE, issuerPublicKey);
  const account = await horizon.loadAccount(fromKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({ destination: destPublicKey, asset, amount: String(amount) })
    )
    .setTimeout(3600)
    .build();
  tx.sign(fromKeypair);
  return horizon.submitTransaction(tx);
}

export { Keypair, Asset, Operation, TransactionBuilder, BASE_FEE };
