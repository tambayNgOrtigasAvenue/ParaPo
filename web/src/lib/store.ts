"use client";
import { create } from "zustand";
import { Keypair } from "@stellar/stellar-sdk";
import {
  WalletRecord,
  getActiveWallet,
  getWallet,
  unlock as unlockWallet,
} from "./stellar/wallet";
import { getBalances, Balances } from "./stellar/xlm";

interface SessionState {
  record: WalletRecord | null;
  keypair: Keypair | null; // decrypted, in memory only
  balances: Balances | null;
  loading: boolean;
  /** Load the active wallet record (locked — no secret yet). */
  hydrate: () => Promise<void>;
  /** Decrypt the active wallet's secret with a PIN. */
  unlock: (pin: string) => Promise<void>;
  /** Set the active wallet right after create/import (secret already known). */
  adopt: (record: WalletRecord, secret: string) => void;
  lock: () => void;
  refreshBalances: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  record: null,
  keypair: null,
  balances: null,
  loading: false,

  hydrate: async () => {
    const active = await getActiveWallet();
    if (!active) {
      set({ record: null, keypair: null });
      return;
    }
    const record = (await getWallet(active)) ?? null;
    set({ record });
  },

  unlock: async (pin: string) => {
    const { record } = get();
    if (!record) throw new Error("No active wallet");
    const secret = await unlockWallet(record.publicKey, pin);
    set({ keypair: Keypair.fromSecret(secret) });
    await get().refreshBalances();
  },

  adopt: (record, secret) => {
    set({ record, keypair: Keypair.fromSecret(secret) });
    void get().refreshBalances();
  },

  lock: () => set({ keypair: null, balances: null }),

  refreshBalances: async () => {
    const { record } = get();
    if (!record) return;
    set({ loading: true });
    try {
      const balances = await getBalances(record.publicKey);
      set({ balances });
    } catch {
      set({ balances: { xlm: "0" } });
    } finally {
      set({ loading: false });
    }
  },
}));
