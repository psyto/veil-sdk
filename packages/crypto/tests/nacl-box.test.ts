import {
  generateEncryptionKeypair,
  deriveEncryptionKeypair,
  encrypt,
  decrypt,
  encryptForMultiple,
  encryptionKeyToBase58,
  base58ToEncryptionKey,
  validateEncryptedData,
} from '../src/nacl-box';

describe('nacl-box', () => {
  // ── generateEncryptionKeypair ───────────────────────────────────────

  describe('generateEncryptionKeypair', () => {
    it('returns a keypair with 32-byte publicKey and secretKey', () => {
      const kp = generateEncryptionKeypair();
      expect(kp.publicKey).toBeInstanceOf(Uint8Array);
      expect(kp.secretKey).toBeInstanceOf(Uint8Array);
      expect(kp.publicKey.length).toBe(32);
      expect(kp.secretKey.length).toBe(32);
    });

    it('produces different keypairs on each call', () => {
      const kp1 = generateEncryptionKeypair();
      const kp2 = generateEncryptionKeypair();
      expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
      expect(Buffer.from(kp1.secretKey).equals(Buffer.from(kp2.secretKey))).toBe(false);
    });
  });

  // ── deriveEncryptionKeypair ─────────────────────────────────────────

  describe('deriveEncryptionKeypair', () => {
    it('is deterministic — same seed produces same keypair', () => {
      const seed = new Uint8Array(32).fill(42);
      const kp1 = deriveEncryptionKeypair(seed);
      const kp2 = deriveEncryptionKeypair(seed);
      expect(Buffer.from(kp1.publicKey)).toEqual(Buffer.from(kp2.publicKey));
      expect(Buffer.from(kp1.secretKey)).toEqual(Buffer.from(kp2.secretKey));
    });

    it('ignores extra seed bytes beyond 32', () => {
      const seed32 = new Uint8Array(32).fill(7);
      const seed64 = new Uint8Array(64).fill(7);
      const kp1 = deriveEncryptionKeypair(seed32);
      const kp2 = deriveEncryptionKeypair(seed64);
      expect(Buffer.from(kp1.publicKey)).toEqual(Buffer.from(kp2.publicKey));
      expect(Buffer.from(kp1.secretKey)).toEqual(Buffer.from(kp2.secretKey));
    });

    it('different seeds produce different keypairs', () => {
      const seedA = new Uint8Array(32).fill(1);
      const seedB = new Uint8Array(32).fill(2);
      const kpA = deriveEncryptionKeypair(seedA);
      const kpB = deriveEncryptionKeypair(seedB);
      expect(Buffer.from(kpA.publicKey).equals(Buffer.from(kpB.publicKey))).toBe(false);
    });
  });

  // ── encrypt ─────────────────────────────────────────────────────────

  describe('encrypt', () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

    it('returns nonce (24 bytes), ciphertext, and combined bytes', () => {
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      expect(enc.nonce).toBeInstanceOf(Uint8Array);
      expect(enc.nonce.length).toBe(24);
      expect(enc.ciphertext).toBeInstanceOf(Uint8Array);
      expect(enc.ciphertext.length).toBeGreaterThan(0);
      expect(enc.bytes).toBeInstanceOf(Uint8Array);
    });

    it('combined bytes = nonce || ciphertext', () => {
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      const expected = new Uint8Array([...enc.nonce, ...enc.ciphertext]);
      expect(Buffer.from(enc.bytes)).toEqual(Buffer.from(expected));
    });

    it('bytes length = 24 (nonce) + plaintext.length + 16 (overhead)', () => {
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      expect(enc.bytes.length).toBe(24 + plaintext.length + 16);
    });

    it('produces a different nonce each call', () => {
      const enc1 = encrypt(plaintext, recipient.publicKey, sender);
      const enc2 = encrypt(plaintext, recipient.publicKey, sender);
      expect(Buffer.from(enc1.nonce).equals(Buffer.from(enc2.nonce))).toBe(false);
    });
  });

  // ── decrypt ─────────────────────────────────────────────────────────

  describe('decrypt', () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();

    it('roundtrip: decrypt recovers original plaintext', () => {
      const plaintext = new Uint8Array([10, 20, 30, 40, 50]);
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      const decrypted = decrypt(enc.bytes, sender.publicKey, recipient);
      expect(Buffer.from(decrypted)).toEqual(Buffer.from(plaintext));
    });

    it('throws "Encrypted data too short" for data shorter than nonce + overhead (40 bytes)', () => {
      const tooShort = new Uint8Array(39);
      expect(() => decrypt(tooShort, sender.publicKey, recipient)).toThrow(
        'Encrypted data too short',
      );
    });

    it('throws "Decryption failed" with wrong recipient keys', () => {
      const plaintext = new Uint8Array([1, 2, 3]);
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      const wrongRecipient = generateEncryptionKeypair();
      expect(() => decrypt(enc.bytes, sender.publicKey, wrongRecipient)).toThrow(
        'Decryption failed',
      );
    });

    it('throws "Decryption failed" when ciphertext is tampered', () => {
      const plaintext = new Uint8Array([5, 6, 7]);
      const enc = encrypt(plaintext, recipient.publicKey, sender);
      const tampered = new Uint8Array(enc.bytes);
      tampered[tampered.length - 1] ^= 0xff;
      expect(() => decrypt(tampered, sender.publicKey, recipient)).toThrow(
        'Decryption failed',
      );
    });
  });

  // ── encryptForMultiple ──────────────────────────────────────────────

  describe('encryptForMultiple', () => {
    it('returns a Map with one entry per recipient', () => {
      const sender = generateEncryptionKeypair();
      const r1 = generateEncryptionKeypair();
      const r2 = generateEncryptionKeypair();
      const r3 = generateEncryptionKeypair();
      const plaintext = new Uint8Array([99]);

      const result = encryptForMultiple(
        plaintext,
        [r1.publicKey, r2.publicKey, r3.publicKey],
        sender,
      );
      expect(result.size).toBe(3);
    });

    it('each recipient can decrypt their own copy', () => {
      const sender = generateEncryptionKeypair();
      const r1 = generateEncryptionKeypair();
      const r2 = generateEncryptionKeypair();
      const plaintext = new Uint8Array([11, 22, 33]);

      const result = encryptForMultiple(plaintext, [r1.publicKey, r2.publicKey], sender);

      const r1Hex = Buffer.from(r1.publicKey).toString('hex');
      const r2Hex = Buffer.from(r2.publicKey).toString('hex');

      const dec1 = decrypt(result.get(r1Hex)!.bytes, sender.publicKey, r1);
      const dec2 = decrypt(result.get(r2Hex)!.bytes, sender.publicKey, r2);

      expect(Buffer.from(dec1)).toEqual(Buffer.from(plaintext));
      expect(Buffer.from(dec2)).toEqual(Buffer.from(plaintext));
    });
  });

  // ── base58 conversion ──────────────────────────────────────────────

  describe('encryptionKeyToBase58 / base58ToEncryptionKey', () => {
    it('roundtrip: bytes → base58 → bytes', () => {
      const kp = generateEncryptionKeypair();
      const b58 = encryptionKeyToBase58(kp.publicKey);
      const back = base58ToEncryptionKey(b58);
      expect(Buffer.from(back)).toEqual(Buffer.from(kp.publicKey));
    });

    it('base58 string is non-empty', () => {
      const kp = generateEncryptionKeypair();
      const b58 = encryptionKeyToBase58(kp.publicKey);
      expect(typeof b58).toBe('string');
      expect(b58.length).toBeGreaterThan(0);
    });
  });

  // ── validateEncryptedData ──────────────────────────────────────────

  describe('validateEncryptedData', () => {
    it('returns true for valid encrypted data (default params)', () => {
      const sender = generateEncryptionKeypair();
      const recipient = generateEncryptionKeypair();
      const enc = encrypt(new Uint8Array([1, 2, 3]), recipient.publicKey, sender);
      expect(validateEncryptedData(enc.bytes)).toBe(true);
    });

    it('returns true at minimum boundary (nonce + overhead + minPlaintextSize)', () => {
      // 24 (nonce) + 16 (overhead) + 1 (min) = 41
      const data = new Uint8Array(41);
      expect(validateEncryptedData(data)).toBe(true);
    });

    it('returns false for data below minimum size', () => {
      const data = new Uint8Array(40); // 24 + 16 + 0 < minPlaintext=1
      expect(validateEncryptedData(data)).toBe(false);
    });

    it('returns false for data above maximum size', () => {
      // 24 + 16 + 1024 = 1064 is max; 1065 should fail
      const data = new Uint8Array(1065);
      expect(validateEncryptedData(data)).toBe(false);
    });

    it('respects custom minPlaintextSize and maxPlaintextSize', () => {
      const data = new Uint8Array(50); // nonce(24) + overhead(16) + 10 plaintext
      expect(validateEncryptedData(data, 10, 20)).toBe(true);
      expect(validateEncryptedData(data, 11, 20)).toBe(false); // 10 < 11
    });
  });
});
