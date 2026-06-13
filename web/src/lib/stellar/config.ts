// Network + contract configuration, read from NEXT_PUBLIC_* env vars.
export const STELLAR = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org",
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  friendbotUrl: "https://friendbot.stellar.org",
  phpxCode: process.env.NEXT_PUBLIC_PHPX_CODE ?? "PHPx",
  phpxIssuer: process.env.NEXT_PUBLIC_PHPX_ISSUER ?? "",
  phpxSac: process.env.NEXT_PUBLIC_PHPX_SAC ?? "",
  fareEscrowId: process.env.NEXT_PUBLIC_FARE_ESCROW_ID ?? "",
  oracleUrl: process.env.NEXT_PUBLIC_ORACLE_URL ?? "",
} as const;

/** PHPx (and Stellar assets generally) use 7 decimal places. */
export const STROOPS_PER_UNIT = 10_000_000n;

export function isConfigured(): boolean {
  return Boolean(STELLAR.fareEscrowId && STELLAR.phpxSac && STELLAR.phpxIssuer);
}
