// Thin, typed wrapper over the Freighter browser-extension API. Keeps all
// extension-specific quirks (error envelopes, network checks) in one place so
// the rest of the app can treat Freighter as a simple async wallet.
import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import { STELLAR } from "./config";

export const FREIGHTER_NETWORK = "TESTNET";

export interface FreighterNetwork {
  network: string;
  networkPassphrase: string;
}

/** True when the Freighter extension is installed and reachable. */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    return Boolean(res.isConnected);
  } catch {
    return false;
  }
}

/** Has the user already granted this dapp access (no popup needed)? */
export async function isFreighterAllowed(): Promise<boolean> {
  try {
    const res = await isAllowed();
    return Boolean(res.isAllowed);
  } catch {
    return false;
  }
}

/**
 * Prompt the user to connect. Combines the allow-list grant and public-key
 * retrieval into one step. Throws a human-readable error on rejection.
 */
export async function connectFreighter(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error(
      "Freighter not detected. Install the Freighter extension to continue."
    );
  }
  const res = await requestAccess();
  if (res.error) throw new Error(res.error.message ?? "Access denied by Freighter.");
  if (!res.address) throw new Error("Freighter did not return an address.");
  return res.address;
}

/**
 * Freighter has no programmatic "disconnect"; the allow-list is owned by the
 * extension. We best-effort revoke the allow flag and let the caller clear its
 * own local state.
 */
export async function disconnectFreighter(): Promise<void> {
  try {
    await setAllowed();
  } catch {
    // Older builds / rejection — local state clearing is what matters.
  }
}

/** Currently selected public key, or null if not connected/allowed. */
export async function getFreighterAddress(): Promise<string | null> {
  try {
    const res = await getAddress();
    if (res.error || !res.address) return null;
    return res.address;
  } catch {
    return null;
  }
}

export async function getFreighterNetwork(): Promise<FreighterNetwork> {
  const res = await getNetwork();
  if (res.error) throw new Error(res.error.message ?? "Could not read Freighter network.");
  return { network: res.network, networkPassphrase: res.networkPassphrase };
}

/** Guard: the extension must be pointed at the same network the app uses. */
export async function assertOnTestnet(): Promise<void> {
  const { networkPassphrase } = await getFreighterNetwork();
  if (networkPassphrase !== STELLAR.networkPassphrase) {
    throw new Error(
      "Freighter is on the wrong network. Switch it to Testnet and try again."
    );
  }
}

/** Sign a transaction XDR with Freighter and return the signed XDR. */
export async function signWithFreighter(xdr: string, address: string): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase: STELLAR.networkPassphrase,
    address,
  });
  if (res.error) throw new Error(res.error.message ?? "Freighter rejected the signature.");
  return res.signedTxXdr;
}
