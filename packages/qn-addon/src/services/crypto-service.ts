import {
  generateEncryptionKeypair,
  deriveEncryptionKeypair,
  encrypt,
  decrypt,
  EncryptionKeypair,
  EncryptedData,
} from '@privacy-suite/crypto';

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
