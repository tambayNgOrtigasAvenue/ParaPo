// Step 3 — Seed demo wallets: a driver and a commuter, funded with XLM via
// Friendbot, written to web/public/demo-accounts.json for one-tap import.
//
//   node seed.js
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  Keypair,
  fundWithFriendbot,
  loadDeployment,
  DEMO_ACCOUNTS_FILE,
} from "./config.js";

// Friendbot funds each new testnet account with 10,000 XLM.
const FRIENDBOT_XLM = "10000";

async function makeAccount(role) {
  const kp = Keypair.random();
  console.log(`\n${role}: ${kp.publicKey()}`);
  await fundWithFriendbot(kp.publicKey());
  return { role, publicKey: kp.publicKey(), secret: kp.secret(), xlm: FRIENDBOT_XLM };
}

async function main() {
  console.log("ParaPo :: seeding demo wallets\n");
  const d = loadDeployment();
  if (!d.admin) {
    throw new Error("Run `npm run setup` (and `npm run deploy`) first.");
  }

  const driver = await makeAccount("driver");
  const commuter = await makeAccount("commuter");

  const payload = {
    network: "testnet",
    xlmSac: d.sacId ?? null,
    fareEscrowId: d.contractId ?? null,
    reader: d.admin.publicKey,
    accounts: [driver, commuter],
    note: "Demo testnet wallets. Import via the ParaPo onboarding screen.",
  };

  mkdirSync(dirname(DEMO_ACCOUNTS_FILE), { recursive: true });
  writeFileSync(DEMO_ACCOUNTS_FILE, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${DEMO_ACCOUNTS_FILE}`);
  console.log("\nDemo accounts ready. Start the web app: `cd web && npm run dev`.");
}

main().catch((err) => {
  console.error("\nseed failed:", err?.response?.data ?? err);
  process.exit(1);
});
