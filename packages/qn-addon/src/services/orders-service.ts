import {
  encryptOrderPayload,
  decryptOrderPayload,
  validateEncryptedPayload,
  OrderPayload,
  EncryptedPayload,
} from '@veil/orders';
import { EncryptionKeypair } from '@veil/crypto';
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

export function validateOrder(encryptedBytes: Uint8Array): boolean {
  return validateEncryptedPayload(encryptedBytes);
}
