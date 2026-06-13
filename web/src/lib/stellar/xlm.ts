// Native XLM balance + payment helpers for the in-app (Keypair) wallet.
// XLM is the native asset, so there are no trustlines to manage.
import {
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Keypair,
} from "@stellar/stellar-sdk";
import { STELLAR, STROOPS_PER_UNIT } from "./config";
import { horizon } from "./client";

export interface Balances {
  xlm: string;
}

export async function getBalances(publicKey: string): Promise<Balances> {
  const account = await horizon.loadAccount(publicKey);
  const native = account.balances.find((b) => b.asset_type === "native");
  return { xlm: native?.balance ?? "0" };
}

/** Send native XLM to another account (used for driver cash-out / transfers). */
export async function sendXlm(
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
      Operation.payment({ destination, asset: Asset.native(), amount: String(amount) })
    )
    .setTimeout(60)
    .build();
  tx.sign(signer);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/** Convert a display amount (e.g. "13.50") to i128 stroops. */
export function toStroops(amountUnits: number | string): bigint {
  const [whole, frac = ""] = String(amountUnits).split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS_PER_UNIT + BigInt(fracPadded || "0");
}

/** Convert i128 stroops to a display string (trimmed). */
export function fromStroops(stroops: bigint | string | number): string {
  const v = BigInt(stroops);
  const whole = v / STROOPS_PER_UNIT;
  const frac = (v % STROOPS_PER_UNIT).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
