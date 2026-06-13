// Step 1 — Create + fund the deployer account on Stellar testnet.
//
// With native XLM there is no token to issue; we only need one funded account
// to deploy the contract and act as its admin / read-only reader.
//
//   node setup.js
import {
  Keypair,
  fundWithFriendbot,
  loadDeployment,
  saveDeployment,
} from "./config.js";

async function main() {
  console.log("ParaPo :: create + fund deployer on Stellar testnet\n");
  const deployment = loadDeployment();

  if (deployment.admin && deployment.admin.secret) {
    console.log("Deployer already exists; skipping creation.");
    console.log("  admin :", deployment.admin.publicKey);
    return;
  }

  const admin = Keypair.random();
  console.log("Generated deployer keypair:");
  console.log("  admin :", admin.publicKey());

  console.log("\nFunding account via Friendbot...");
  await fundWithFriendbot(admin.publicKey());

  deployment.network = "testnet";
  deployment.admin = { publicKey: admin.publicKey(), secret: admin.secret() };
  saveDeployment(deployment);

  console.log(
    "\nDone. Next: `npm run deploy` to resolve the native XLM SAC and deploy the fare-escrow contract."
  );
}

main().catch((err) => {
  console.error("\nsetup failed:", err?.response?.data ?? err);
  process.exit(1);
});
