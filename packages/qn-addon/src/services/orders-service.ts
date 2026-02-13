import {
  encryptOrderPayload,
  decryptOrderPayload,
  OrderPayload,
  EncryptedPayload,
} from '@privacy-suite/orders';
import { EncryptionKeypair } from '@privacy-suite/crypto';
import BN from 'bn.js';

export function encryptOrder(
  payload: { minOutputAmount: string; slippageBps: number; deadline: number },
  solverPublicKey: Uint8Array,
  userKeypair: EncryptionKeypair,
): EncryptedPayload {
  const orderPayload: OrderPayload = {
    minOutputAmount: new BN(payload.minOutputAmount),
    slippageBps: payload.slippageBps,
    deadline: payload.deadline,
  };
  return encryptOrderPayload(orderPayload, solverPublicKey, userKeypair);
}

export function decryptOrder(
  encryptedBytes: Uint8Array,
  userPublicKey: Uint8Array,
  solverKeypair: EncryptionKeypair,
): { minOutputAmount: string; slippageBps: number; deadline: number } {
  const payload = decryptOrderPayload(encryptedBytes, userPublicKey, solverKeypair);
  return {
    minOutputAmount: payload.minOutputAmount.toString(),
    slippageBps: payload.slippageBps,
    deadline: payload.deadline,
  };
}
