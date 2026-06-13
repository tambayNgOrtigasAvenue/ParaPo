// PHPx balance + trustline helpers (classic Horizon side). PHPx is a classic
// Stellar asset wrapped as a SAC, so balances are unified across both views.
import {
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Keypair,
} from "@stellar/stellar-sdk";
import { STELLAR, STROOPS_PER_UNIT } from "./config";
import { horizon } from "./client";

export const PHPX = () => new Asset(STELLAR.phpxCode, STELLAR.phpxIssuer);

export interface Balances {
  xlm: string;
  phpx: string;
  hasTrustline: boolean;
}

export async function getBalances(publicKey: string): Promise<Balances> {
  const account = await horizon.loadAccount(publicKey);
  let xlm = "0";
  let phpx = "0";
  let hasTrustline = false;
  for (const b of account.balances) {
    if (b.asset_type === "native") {
      xlm = b.balance;
    } else if (
      "asset_code" in b &&
      b.asset_code === STELLAR.phpxCode &&
      "asset_issuer" in b &&
      b.asset_issuer === STELLAR.phpxIssuer
    ) {
      phpx = b.balance;
      hasTrustline = true;
    }
  }
  return { xlm, phpx, hasTrustline };
}

export async function establishTrustline(signer: Keypair): Promise<string> {
  const account = await horizon.loadAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: PHPX() }))
    .setTimeout(60)
    .build();
  tx.sign(signer);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/** Send PHPx to another account (used for driver cash-out / transfers). */
export async function sendPHPx(
  signer: Keypair,
  destination: string,
  amount: string
): Promise<string> {
  const account = await horizon.loadAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(
      Operation.payment({ destination, asset: PHPX(), amount: String(amount) })
    )
    .setTimeout(60)
    .build();
  tx.sign(signer);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/** Convert a PHP display amount (e.g. "13.50") to i128 stroops. */
export function toStroops(amountUnits: number | string): bigint {
  const [whole, frac = ""] = String(amountUnits).split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS_PER_UNIT + BigInt(fracPadded || "0");
}

/** Convert i128 stroops to a PHP display string (trimmed). */
export function fromStroops(stroops: bigint | string | number): string {
  const v = BigInt(stroops);
  const whole = v / STROOPS_PER_UNIT;
  const frac = (v % STROOPS_PER_UNIT).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
