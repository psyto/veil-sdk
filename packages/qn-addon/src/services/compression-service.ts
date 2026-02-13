import {
  estimateCompressionSavings,
  createZkRpc,
  compressData,
  decompressData,
  CompressedPayload,
} from '@privacy-suite/crypto';
import { Keypair } from '@solana/web3.js';

export function estimate(dataSize: number): {
  uncompressedCost: bigint;
  compressedCost: bigint;
  savings: bigint;
  savingsPercent: number;
} {
  return estimateCompressionSavings(dataSize);
}

export async function compress(
  rpcUrl: string,
  data: Uint8Array,
  payerSecretKey: Uint8Array,
): Promise<CompressedPayload> {
  const rpc = createZkRpc({ rpcUrl });
  const payer = Keypair.fromSecretKey(payerSecretKey);
  return compressData(rpc, data, payer);
}

export async function decompress(
  rpcUrl: string,
  payload: CompressedPayload,
): Promise<Uint8Array> {
  const rpc = createZkRpc({ rpcUrl });
  return decompressData(rpc, payload);
}
