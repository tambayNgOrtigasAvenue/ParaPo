// Non-custodial wallet: keypairs are generated in the browser and the secret is
// encrypted at rest (AES-GCM with a PIN-derived key) in IndexedDB. The secret
// never leaves the device and is only decrypted in memory after the user unlocks.
import { Keypair } from "@stellar/stellar-sdk";

export type Role = "driver" | "commuter";

export interface EncryptedBlob {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

export interface WalletRecord {
  publicKey: string;
  role: Role;
  label: string;
  enc: EncryptedBlob;
  createdAt: number;
}

const DB_NAME = "parapo";
const STORE = "wallets";
const META = "meta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "publicKey" });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

// --- Crypto ---------------------------------------------------------------
const b64 = {
  enc: (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptSecret(secret: string, pin: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret)
  );
  return { ciphertext: b64.enc(ct), iv: b64.enc(iv.buffer), salt: b64.enc(salt.buffer) };
}

async function decryptSecret(blob: EncryptedBlob, pin: string): Promise<string> {
  const key = await deriveKey(pin, b64.dec(blob.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64.dec(blob.iv) as BufferSource },
    key,
    b64.dec(blob.ciphertext) as BufferSource
  );
  return new TextDecoder().decode(pt);
}

// --- Public API -----------------------------------------------------------
export async function createWallet(role: Role, pin: string, label?: string) {
  const kp = Keypair.random();
  const enc = await encryptSecret(kp.secret(), pin);
  const record: WalletRecord = {
    publicKey: kp.publicKey(),
    role,
    label: label ?? defaultLabel(role),
    enc,
    createdAt: Date.now(),
  };
  await tx(STORE, "readwrite", (s) => s.put(record));
  await setActiveWallet(kp.publicKey());
  return { publicKey: kp.publicKey(), secret: kp.secret(), record };
}

export async function importWallet(secret: string, role: Role, pin: string, label?: string) {
  const kp = Keypair.fromSecret(secret.trim());
  const enc = await encryptSecret(kp.secret(), pin);
  const record: WalletRecord = {
    publicKey: kp.publicKey(),
    role,
    label: label ?? defaultLabel(role),
    enc,
    createdAt: Date.now(),
  };
  await tx(STORE, "readwrite", (s) => s.put(record));
  await setActiveWallet(kp.publicKey());
  return { publicKey: kp.publicKey(), secret: kp.secret(), record };
}

export async function unlock(publicKey: string, pin: string): Promise<string> {
  const record = await getWallet(publicKey);
  if (!record) throw new Error("Wallet not found");
  return decryptSecret(record.enc, pin);
}

export async function getWallet(publicKey: string): Promise<WalletRecord | undefined> {
  return tx<WalletRecord | undefined>(STORE, "readonly", (s) => s.get(publicKey));
}

export async function listWallets(): Promise<WalletRecord[]> {
  return tx<WalletRecord[]>(STORE, "readonly", (s) => s.getAll());
}

export async function deleteWallet(publicKey: string): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.delete(publicKey));
}

export async function setActiveWallet(publicKey: string): Promise<void> {
  await tx(META, "readwrite", (s) => s.put({ key: "active", value: publicKey }));
}

export async function getActiveWallet(): Promise<string | undefined> {
  const row = await tx<{ key: string; value: string } | undefined>(META, "readonly", (s) =>
    s.get("active")
  );
  return row?.value;
}

function defaultLabel(role: Role): string {
  return role === "driver" ? "Driver wallet" : "Commuter wallet";
}
