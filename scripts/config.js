// Shared configuration + helpers for ParaPo deployment scripts.
// Settlement asset is native XLM, so there is no token to issue.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

// --- Network ---------------------------------------------------------------
export const NETWORK = "testnet";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";

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

export { Keypair };
