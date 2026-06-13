// Step 3 — Seed demo wallets: a driver and a commuter, funded with XLM and PHPx,
// written to web/public/demo-accounts.json for one-tap import in the PWA.
//
//   node seed.js
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  Keypair,
  horizon,
  fundWithFriendbot,
  establishTrustline,
  payPHPx,
  loadDeployment,
  DEMO_ACCOUNTS_FILE,
} from "./config.js";

const COMMUTER_PHPX = "500"; // give the commuter 500 PHPx to ride with
const DRIVER_PHPX = "10"; // small float so the driver account is reserve-ready

async function makeAccount(role, issuerPublicKey, distributor, amount) {
  const kp = Keypair.random();
  console.log(`\n${role}: ${kp.publicKey()}`);
  await fundWithFriendbot(kp.publicKey());
  await establishTrustline(kp, issuerPublicKey);
  if (Number(amount) > 0) {
    await payPHPx(distributor, kp.publicKey(), issuerPublicKey, amount);
  }
  return { role, publicKey: kp.publicKey(), secret: kp.secret(), phpx: amount };
}

async function main() {
  console.log("ParaPo :: seeding demo wallets\n");
  const d = loadDeployment();
  if (!d.issuer || !d.distributor) {
    throw new Error("Run `npm run setup` (and `npm run deploy`) first.");
  }
  const distributor = Keypair.fromSecret(d.distributor.secret);
  const issuerPublic = d.issuer.publicKey;

  const driver = await makeAccount("driver", issuerPublic, distributor, DRIVER_PHPX);
  const commuter = await makeAccount(
    "commuter",
    issuerPublic,
    distributor,
    COMMUTER_PHPX
  );

  const payload = {
    network: "testnet",
    phpxIssuer: issuerPublic,
    phpxSac: d.sacId ?? null,
    fareEscrowId: d.contractId ?? null,
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
