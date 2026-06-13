// Step 1 — Issue the PHPx test stablecoin on Stellar testnet.
//
// Creates an issuer and a distributor account, funds them via Friendbot,
// establishes the distributor's trustline to PHPx, and issues the full supply
// from the issuer to the distributor.
//
//   node setup.js
import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  horizon,
  NETWORK_PASSPHRASE,
  ASSET_CODE,
  PHPX_TOTAL_SUPPLY,
  fundWithFriendbot,
  loadDeployment,
  saveDeployment,
} from "./config.js";

async function main() {
  console.log("ParaPo :: PHPx issuance on Stellar testnet\n");
  const deployment = loadDeployment();

  if (deployment.issuer && deployment.distributor) {
    console.log("Issuer + distributor already exist; skipping creation.");
    console.log("  issuer      :", deployment.issuer.publicKey);
    console.log("  distributor :", deployment.distributor.publicKey);
    return;
  }

  const issuer = Keypair.random();
  const distributor = Keypair.random();
  console.log("Generated keypairs:");
  console.log("  issuer      :", issuer.publicKey());
  console.log("  distributor :", distributor.publicKey());

  console.log("\nFunding accounts via Friendbot...");
  await fundWithFriendbot(issuer.publicKey());
  await fundWithFriendbot(distributor.publicKey());

  const asset = new Asset(ASSET_CODE, issuer.publicKey());

  console.log("\nEstablishing distributor trustline to PHPx...");
  {
    const account = await horizon.loadAccount(distributor.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({ asset }))
      .setTimeout(3600)
      .build();
    tx.sign(distributor);
    await horizon.submitTransaction(tx);
  }

  console.log(`Issuing ${PHPX_TOTAL_SUPPLY} ${ASSET_CODE} to distributor...`);
  {
    const account = await horizon.loadAccount(issuer.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: distributor.publicKey(),
          asset,
          amount: PHPX_TOTAL_SUPPLY,
        })
      )
      .setTimeout(3600)
      .build();
    tx.sign(issuer);
    await horizon.submitTransaction(tx);
  }

  deployment.network = "testnet";
  deployment.assetCode = ASSET_CODE;
  deployment.issuer = { publicKey: issuer.publicKey(), secret: issuer.secret() };
  deployment.distributor = {
    publicKey: distributor.publicKey(),
    secret: distributor.secret(),
  };

  console.log("\nDone. PHPx issued.");
  saveDeployment(deployment);
  console.log(
    "\nNext: `npm run deploy` to wrap the SAC and deploy the fare-escrow contract."
  );
}

main().catch((err) => {
  console.error("\nsetup failed:", err?.response?.data ?? err);
  process.exit(1);
});
