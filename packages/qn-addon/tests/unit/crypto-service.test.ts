import * as cryptoService from '../../src/services/crypto-service';

describe('crypto-service', () => {
  it('generates a keypair with 32-byte keys', () => {
    const kp = cryptoService.generate();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);
  });

  it('derives deterministic keypair from seed', () => {
    const seed = new Uint8Array(32).fill(42);
    const kp1 = cryptoService.derive(seed);
    const kp2 = cryptoService.derive(seed);
    expect(Buffer.from(kp1.publicKey)).toEqual(Buffer.from(kp2.publicKey));
    expect(Buffer.from(kp1.secretKey)).toEqual(Buffer.from(kp2.secretKey));
  });

  it('encrypts and decrypts roundtrip', () => {
    const sender = cryptoService.generate();
    const recipient = cryptoService.generate();
    const plaintext = new Uint8Array(Buffer.from('hello veil'));

    const encrypted = cryptoService.encryptData(plaintext, recipient.publicKey, sender);
    expect(encrypted.bytes.length).toBeGreaterThan(plaintext.length);

    const decrypted = cryptoService.decryptData(encrypted.bytes, sender.publicKey, recipient);
    expect(Buffer.from(decrypted).toString()).toBe('hello veil');
  });
});
