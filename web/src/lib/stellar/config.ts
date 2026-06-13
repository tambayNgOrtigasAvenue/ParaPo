// Network + contract configuration, read from NEXT_PUBLIC_* env vars.
export const STELLAR = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org",
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  friendbotUrl: "https://friendbot.stellar.org",
  // Native XLM is settled through its Stellar Asset Contract (SAC).
  xlmSac: process.env.NEXT_PUBLIC_XLM_SAC ?? "",
  fareEscrowId: process.env.NEXT_PUBLIC_FARE_ESCROW_ID ?? "",
  // A funded public key used only to simulate read-only contract calls
  // (e.g. the cooperative dashboard). Holds no custody.
  readerPublicKey: process.env.NEXT_PUBLIC_READER ?? "",
  oracleUrl: process.env.NEXT_PUBLIC_ORACLE_URL ?? "",
} as const;

/** XLM (and Stellar assets generally) use 7 decimal places (stroops). */
export const STROOPS_PER_UNIT = 10_000_000n;

export function isConfigured(): boolean {
  return Boolean(STELLAR.fareEscrowId && STELLAR.xlmSac);
}
