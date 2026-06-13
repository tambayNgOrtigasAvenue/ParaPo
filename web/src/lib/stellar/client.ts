// Thin wrappers over Soroban RPC + Horizon for the browser.
import {
  rpc,
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  Keypair,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { STELLAR } from "./config";

export const rpcServer = new rpc.Server(STELLAR.rpcUrl, {
  allowHttp: STELLAR.rpcUrl.startsWith("http://"),
});

export const horizon = new Horizon.Server(STELLAR.horizonUrl, {
  allowHttp: STELLAR.horizonUrl.startsWith("http://"),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulate (read-only) a contract method and return the decoded native value. */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  readerPublicKey: string
): Promise<T> {
  const account = await rpcServer.getAccount(readerPublicKey);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed for ${method}: ${sim.error}`);
  }
  const retval = sim.result?.retval;
  if (!retval) throw new Error(`No return value from ${method}`);
  return scValToNative(retval) as T;
}

/**
 * Invoke a state-changing contract method. The `signer` is both the transaction
 * source and the authorizer, so `require_auth(signer)` calls inside the contract
 * are satisfied by the source signature.
 */
export async function invokeContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  signer: Keypair
): Promise<{ value: T; hash: string }> {
  const account = await rpcServer.getAccount(signer.publicKey());
  const contract = new Contract(contractId);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // prepareTransaction simulates, applies the soroban footprint + auth, and
  // bumps the resource fee.
  const prepared = await rpcServer.prepareTransaction(built);
  prepared.sign(signer);

  const sent = await rpcServer.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`Send failed: ${JSON.stringify(sent.errorResult)}`);
  }

  let result = await rpcServer.getTransaction(sent.hash);
  let tries = 0;
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND && tries < 30) {
    await sleep(1000);
    result = await rpcServer.getTransaction(sent.hash);
    tries++;
  }
  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sent.hash} did not succeed: ${result.status}`);
  }
  const value = result.returnValue
    ? (scValToNative(result.returnValue) as T)
    : (undefined as T);
  return { value, hash: sent.hash };
}

export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(
    `${STELLAR.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
  );
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot failed: ${res.status}`);
  }
}

export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await rpcServer.getAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}
