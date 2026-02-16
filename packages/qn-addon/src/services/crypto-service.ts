import {
  generateEncryptionKeypair,
  deriveEncryptionKeypair,
  encrypt,
  decrypt,
  encryptForMultiple,
  encryptionKeyToBase58,
  base58ToEncryptionKey,
  validateEncryptedData,
  EncryptionKeypair,
  EncryptedData,
} from '@veil/crypto';

export function generate(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return generateEncryptionKeypair();
}

export function derive(seed: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return deriveEncryptionKeypair(seed);
}

export function encryptData(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderKeypair: EncryptionKeypair,
): EncryptedData {
  return encrypt(plaintext, recipientPublicKey, senderKeypair);
}

export function decryptData(
  encryptedBytes: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientKeypair: EncryptionKeypair,
): Uint8Array {
  return decrypt(encryptedBytes, senderPublicKey, recipientKeypair);
}

export function encryptMultiple(
  plaintext: Uint8Array,
  recipientPublicKeys: Uint8Array[],
  senderKeypair: EncryptionKeypair,
): Map<string, EncryptedData> {
  return encryptForMultiple(plaintext, recipientPublicKeys, senderKeypair);
}

export function validate(
  bytes: Uint8Array,
  minPlaintextSize?: number,
  maxPlaintextSize?: number,
): boolean {
  return validateEncryptedData(bytes, minPlaintextSize, maxPlaintextSize);
}

export function keyToBase58(publicKey: Uint8Array): string {
  return encryptionKeyToBase58(publicKey);
}

export function keyFromBase58(base58: string): Uint8Array {
  return base58ToEncryptionKey(base58);
}
