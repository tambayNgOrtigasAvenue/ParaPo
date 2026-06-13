"use client";
// Connection + balance state for the Freighter wallet, kept separate from the
// in-browser PUV wallet session so the two flows never interfere.
import { create } from "zustand";
import {
  connectFreighter,
  disconnectFreighter,
  getFreighterAddress,
  getFreighterNetwork,
  isFreighterAllowed,
  isFreighterInstalled,
} from "./stellar/freighter";
import { getXlmBalance, StellarAccountNotFound } from "./stellar/payments";

interface FreighterState {
  installed: boolean | null; // null = not yet checked
  address: string | null;
  network: string | null;
  xlm: string | null;
  funded: boolean;
  connecting: boolean;
  loadingBalance: boolean;
  error: string | null;

  /** Silently restore the session if the dapp is already on the allow-list. */
  init: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export const useFreighter = create<FreighterState>((set, get) => ({
  installed: null,
  address: null,
  network: null,
  xlm: null,
  funded: false,
  connecting: false,
  loadingBalance: false,
  error: null,

  init: async () => {
    const installed = await isFreighterInstalled();
    set({ installed });
    if (!installed) return;
    if (await isFreighterAllowed()) {
      const address = await getFreighterAddress();
      if (address) {
        const { network } = await getFreighterNetwork().catch(() => ({ network: null }));
        set({ address, network });
        await get().refreshBalance();
      }
    }
  },

  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const address = await connectFreighter();
      const { network } = await getFreighterNetwork().catch(() => ({ network: null }));
      set({ address, network });
      await get().refreshBalance();
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to connect Freighter." });
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: async () => {
    await disconnectFreighter();
    set({ address: null, network: null, xlm: null, funded: false, error: null });
  },

  refreshBalance: async () => {
    const { address } = get();
    if (!address) return;
    set({ loadingBalance: true });
    try {
      const xlm = await getXlmBalance(address);
      set({ xlm, funded: true });
    } catch (e) {
      if (e instanceof StellarAccountNotFound) {
        set({ xlm: "0", funded: false });
      } else {
        set({ xlm: null });
      }
    } finally {
      set({ loadingBalance: false });
    }
  },
}));
