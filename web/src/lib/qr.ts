// Rotating, signed QR session tokens.
//
// When a driver starts a biyahe, a session id is created. The QR encodes a
// payload signed by the driver's key that rotates (new nonce + timestamp) every
// few seconds. A commuter verifies the signature against the driver's public key
// and rejects stale tokens, so screenshots cannot be replayed by a third party.
import { Keypair } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export const QR_ROTATE_MS = 15_000;
export const QR_MAX_AGE_MS = 45_000; // accept tokens up to 3 rotations old

export interface SessionPayload {
  v: 1;
  driver: string; // driver public key
  route: string; // route id
  sid: string; // session id
  ts: number; // issued-at (ms)
  nonce: string;
  sig: string; // base64 ed25519 signature over the signing message
}

export function newSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function randomNonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function signingMessage(driver: string, route: string, sid: string, ts: number, nonce: string) {
  return `${driver}|${route}|${sid}|${ts}|${nonce}`;
}

/** Build a fresh signed QR token string (call on each rotation). */
export function buildQrToken(
  driverKeypair: Keypair,
  route: string,
  sid: string
): string {
  const ts = Date.now();
  const nonce = randomNonce();
  const driver = driverKeypair.publicKey();
  const msg = signingMessage(driver, route, sid, ts, nonce);
  const sig = driverKeypair.sign(Buffer.from(msg, "utf8")).toString("base64");
  const payload: SessionPayload = { v: 1, driver, route, sid, ts, nonce, sig };
  return JSON.stringify(payload);
}

export function parseQrToken(raw: string): SessionPayload | null {
  try {
    const p = JSON.parse(raw);
    if (p && p.v === 1 && p.driver && p.route && p.sid && p.sig) return p as SessionPayload;
    return null;
  } catch {
    return null;
  }
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/** Verify a scanned token's signature + freshness. */
export function verifyQrToken(p: SessionPayload, now = Date.now()): VerifyResult {
  if (now - p.ts > QR_MAX_AGE_MS) return { ok: false, reason: "QR expired — ask the driver to refresh." };
  try {
    const kp = Keypair.fromPublicKey(p.driver);
    const msg = signingMessage(p.driver, p.route, p.sid, p.ts, p.nonce);
    const valid = kp.verify(Buffer.from(msg, "utf8"), Buffer.from(p.sig, "base64"));
    return valid ? { ok: true } : { ok: false, reason: "Invalid QR signature." };
  } catch {
    return { ok: false, reason: "Malformed QR." };
  }
}
