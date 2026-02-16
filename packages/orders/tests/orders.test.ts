import BN from 'bn.js';
import {
  serializeOrderPayload,
  deserializeOrderPayload,
  encryptOrderPayload,
  decryptOrderPayload,
  createEncryptedOrder,
  validateEncryptedPayload,
  generateEncryptionKeypair,
} from '../src/index';

describe('orders', () => {
  // ── serializeOrderPayload / deserializeOrderPayload ─────────────────

  describe('serializeOrderPayload / deserializeOrderPayload', () => {
    it('roundtrip preserves all fields', () => {
      const payload = {
        minOutputAmount: new BN('1000000000'),
        slippageBps: 50,
        deadline: 1700000000,
      };
      const serialized = serializeOrderPayload(payload);
      const deserialized = deserializeOrderPayload(serialized);
      expect(deserialized.minOutputAmount.toString()).toBe('1000000000');
      expect(deserialized.slippageBps).toBe(50);
      expect(deserialized.deadline).toBe(1700000000);
    });

    it('serialized output is 24 bytes', () => {
      const payload = {
        minOutputAmount: new BN('500'),
        slippageBps: 100,
        deadline: 0,
      };
      const serialized = serializeOrderPayload(payload);
      expect(serialized.length).toBe(24);
    });
  });

  // ── encryptOrderPayload / decryptOrderPayload ───────────────────────

  describe('encryptOrderPayload / decryptOrderPayload', () => {
    const user = generateEncryptionKeypair();
    const solver = generateEncryptionKeypair();

    it('roundtrip preserves minOutputAmount, slippageBps, deadline', () => {
      const payload = {
        minOutputAmount: new BN('999999999'),
        slippageBps: 200,
        deadline: 1710000000,
      };
      const encrypted = encryptOrderPayload(payload, solver.publicKey, user);
      const decrypted = decryptOrderPayload(encrypted.bytes, user.publicKey, solver);
      expect(decrypted.minOutputAmount.toString()).toBe('999999999');
      expect(decrypted.slippageBps).toBe(200);
      expect(decrypted.deadline).toBe(1710000000);
    });

    it('encrypted payload has nonce (24 bytes), ciphertext, and combined bytes', () => {
      const payload = {
        minOutputAmount: new BN('100'),
        slippageBps: 10,
        deadline: 0,
      };
      const encrypted = encryptOrderPayload(payload, solver.publicKey, user);
      expect(encrypted.nonce.length).toBe(24);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
      expect(encrypted.bytes.length).toBe(encrypted.nonce.length + encrypted.ciphertext.length);
    });
  });

  // ── createEncryptedOrder ────────────────────────────────────────────

  describe('createEncryptedOrder', () => {
    it('returns a Uint8Array', () => {
      const user = generateEncryptionKeypair();
      const solver = generateEncryptionKeypair();
      const result = createEncryptedOrder(
        '1000000',
        50,
        1700000000,
        solver.publicKey,
        user,
      );
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('output length is in valid range (64–128 bytes)', () => {
      const user = generateEncryptionKeypair();
      const solver = generateEncryptionKeypair();
      const result = createEncryptedOrder(
        new BN('5000000'),
        100,
        1700000000,
        solver.publicKey,
        user,
      );
      // 24 (nonce) + 16 (overhead) + 24 (payload) = 64
      expect(result.length).toBe(64);
    });
  });

  // ── validateEncryptedPayload ────────────────────────────────────────

  describe('validateEncryptedPayload', () => {
    it('returns true for a valid encrypted order', () => {
      const user = generateEncryptionKeypair();
      const solver = generateEncryptionKeypair();
      const encrypted = createEncryptedOrder(
        '1000000',
        50,
        1700000000,
        solver.publicKey,
        user,
      );
      expect(validateEncryptedPayload(encrypted)).toBe(true);
    });

    it('returns false for too-short bytes', () => {
      expect(validateEncryptedPayload(new Uint8Array(63))).toBe(false);
    });

    it('returns false for too-long bytes', () => {
      expect(validateEncryptedPayload(new Uint8Array(129))).toBe(false);
    });
  });
});
