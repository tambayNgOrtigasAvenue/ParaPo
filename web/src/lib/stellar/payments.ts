// Native XLM payments on Stellar testnet, signed by Freighter.
//
// Flow: build an unsigned payment tx with the stellar-sdk -> hand the XDR to
// Freighter for the user to review + sign -> submit the signed XDR to Horizon.
// The secret key never touches the app; only Freighter holds it.
import {
  Asset,
  BASE_FEE,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { STELLAR } from "./config";
import { horizon } from "./client";
import { assertOnTestnet, signWithFreighter } from "./freighter";

export class StellarAccountNotFound extends Error {
  constructor(publicKey: string) {
    super(`Account ${publicKey} is not yet funded on testnet.`);
    this.name = "StellarAccountNotFound";
  }
}

/** Fetch the native XLM balance for an account. Returns "0" if unfunded. */
export async function getXlmBalance(publicKey: string): Promise<string> {
  try {
    const account = await horizon.loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native?.balance ?? "0";
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.name === "NotFoundError") {
      throw new StellarAccountNotFound(publicKey);
    }
    throw e;
  }
}

export interface SendXlmParams {
  source: string;
  destination: string;
  /** Amount in XLM (e.g. "1.5"). */
  amount: string;
  memo?: string;
}

export interface SendXlmResult {
  hash: string;
  /** stellar.expert testnet link for the transaction. */
  explorerUrl: string;
}

/**
 * Build, sign (via Freighter), and submit a native XLM payment.
 * Resolves with the transaction hash once Horizon accepts it.
 */
export async function sendXlm({
  source,
  destination,
  amount,
  memo,
}: SendXlmParams): Promise<SendXlmResult> {
  await assertOnTestnet();

  const sourceAccount = await horizon.loadAccount(source);

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount: String(amount),
      })
    )
    .setTimeout(120);

  if (memo && memo.trim()) {
    builder.addMemo(Memo.text(memo.trim().slice(0, 28)));
  }

  const tx = builder.build();

  const signedXdr = await signWithFreighter(tx.toXDR(), source);
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    STELLAR.networkPassphrase
  );

  const res = await horizon.submitTransaction(signedTx);
  return {
    hash: res.hash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${res.hash}`,
  };
}

/** Turn a Horizon submit error into a readable message. */
export function describeSubmitError(e: any): string {
  const codes = e?.response?.data?.extras?.result_codes;
  if (codes) {
    const op = Array.isArray(codes.operations) ? codes.operations.join(", ") : "";
    if (op.includes("op_no_destination"))
      return "Destination account does not exist on testnet.";
    if (op.includes("op_underfunded")) return "Insufficient XLM balance for this payment.";
    if (codes.transaction === "tx_insufficient_balance")
      return "Insufficient XLM balance for fees + amount.";
    return `Transaction failed: ${codes.transaction ?? ""} ${op}`.trim();
  }
  return e?.message ?? "Transaction failed. Please try again.";
}
