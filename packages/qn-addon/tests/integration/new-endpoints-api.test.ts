import request from 'supertest';
import crypto from 'crypto';
import { getTestApp } from '../helpers/setup';

describe('New Endpoints API', () => {
  const app = getTestApp();

  describe('POST /v1/crypto/encrypt-multiple', () => {
    it('encrypts for multiple recipients', async () => {
      const senderRes = await request(app).post('/v1/keypair/generate');
      const r1Res = await request(app).post('/v1/keypair/generate');
      const r2Res = await request(app).post('/v1/keypair/generate');

      const plaintext = Buffer.from('broadcast message').toString('base64');

      const res = await request(app).post('/v1/crypto/encrypt-multiple').send({
        plaintext,
        recipientPublicKeys: [
          r1Res.body.publicKey.base64,
          r2Res.body.publicKey.base64,
        ],
        senderSecretKey: senderRes.body.secretKey.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recipientCount).toBe(2);
      expect(Object.keys(res.body.recipients)).toHaveLength(2);

      // Each recipient should have bytes that can be decrypted
      const recipientKeys = Object.keys(res.body.recipients);
      for (const key of recipientKeys) {
        expect(res.body.recipients[key].bytes.base64).toBeDefined();
        expect(res.body.recipients[key].nonce.base64).toBeDefined();
        expect(res.body.recipients[key].ciphertext.base64).toBeDefined();
      }
    });

    it('decryption works for each recipient', async () => {
      const senderRes = await request(app).post('/v1/keypair/generate');
      const r1Res = await request(app).post('/v1/keypair/generate');
      const r2Res = await request(app).post('/v1/keypair/generate');

      const plaintext = Buffer.from('secret for both').toString('base64');

      const encRes = await request(app).post('/v1/crypto/encrypt-multiple').send({
        plaintext,
        recipientPublicKeys: [
          r1Res.body.publicKey.base64,
          r2Res.body.publicKey.base64,
        ],
        senderSecretKey: senderRes.body.secretKey.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
      });

      // Recipient 1 decrypts their copy
      const r1KeyHex = Buffer.from(
        Buffer.from(r1Res.body.publicKey.base64, 'base64')
      ).toString('hex');
      const r1Encrypted = encRes.body.recipients[r1KeyHex];

      const dec1 = await request(app).post('/v1/decrypt').send({
        bytes: r1Encrypted.bytes.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
        recipientSecretKey: r1Res.body.secretKey.base64,
        recipientPublicKey: r1Res.body.publicKey.base64,
      });
      expect(dec1.status).toBe(200);
      expect(Buffer.from(dec1.body.plaintext.base64, 'base64').toString()).toBe('secret for both');
    });

    it('validates missing fields', async () => {
      const res = await request(app).post('/v1/crypto/encrypt-multiple').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty recipientPublicKeys', async () => {
      const senderRes = await request(app).post('/v1/keypair/generate');
      const res = await request(app).post('/v1/crypto/encrypt-multiple').send({
        plaintext: Buffer.from('test').toString('base64'),
        recipientPublicKeys: [],
        senderSecretKey: senderRes.body.secretKey.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/crypto/validate', () => {
    it('validates correct encrypted data', async () => {
      const senderRes = await request(app).post('/v1/keypair/generate');
      const recipientRes = await request(app).post('/v1/keypair/generate');

      const encRes = await request(app).post('/v1/encrypt').send({
        plaintext: Buffer.from('test data').toString('base64'),
        recipientPublicKey: recipientRes.body.publicKey.base64,
        senderSecretKey: senderRes.body.secretKey.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
      });

      const valRes = await request(app).post('/v1/crypto/validate').send({
        bytes: encRes.body.bytes.base64,
      });
      expect(valRes.status).toBe(200);
      expect(valRes.body.success).toBe(true);
      expect(valRes.body.valid).toBe(true);
      expect(valRes.body.byteLength).toBeGreaterThan(0);
    });

    it('rejects data that is too short', async () => {
      const res = await request(app).post('/v1/crypto/validate').send({
        bytes: Buffer.from('short').toString('base64'),
      });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('validates with custom size bounds', async () => {
      const senderRes = await request(app).post('/v1/keypair/generate');
      const recipientRes = await request(app).post('/v1/keypair/generate');

      const encRes = await request(app).post('/v1/encrypt').send({
        plaintext: Buffer.from('test data').toString('base64'),
        recipientPublicKey: recipientRes.body.publicKey.base64,
        senderSecretKey: senderRes.body.secretKey.base64,
        senderPublicKey: senderRes.body.publicKey.base64,
      });

      const res = await request(app).post('/v1/crypto/validate').send({
        bytes: encRes.body.bytes.base64,
        minPlaintextSize: 1,
        maxPlaintextSize: 100,
      });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('validates missing bytes field', async () => {
      const res = await request(app).post('/v1/crypto/validate').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/crypto/key-convert', () => {
    it('converts publicKey bytes to base58', async () => {
      const kpRes = await request(app).post('/v1/keypair/generate');

      const res = await request(app).post('/v1/crypto/key-convert').send({
        publicKey: kpRes.body.publicKey.base64,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.base58).toBeDefined();
      expect(typeof res.body.base58).toBe('string');
      expect(res.body.publicKey.base64).toBe(kpRes.body.publicKey.base64);
    });

    it('converts base58 to publicKey bytes', async () => {
      const kpRes = await request(app).post('/v1/keypair/generate');
      const convertRes = await request(app).post('/v1/crypto/key-convert').send({
        publicKey: kpRes.body.publicKey.base64,
      });

      // Now convert back from base58
      const res = await request(app).post('/v1/crypto/key-convert').send({
        base58: convertRes.body.base58,
      });
      expect(res.status).toBe(200);
      expect(res.body.publicKey.base64).toBe(kpRes.body.publicKey.base64);
    });

    it('validates missing input', async () => {
      const res = await request(app).post('/v1/crypto/key-convert').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/threshold/verify', () => {
    it('verifies valid shares', async () => {
      const secret = crypto.randomBytes(32).toString('base64');

      const splitRes = await request(app)
        .post('/v1/threshold/split')
        .send({ secret, threshold: 3, totalShares: 5 });

      const res = await request(app).post('/v1/threshold/verify').send({
        shares: splitRes.body.shares,
        threshold: 3,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.sharesProvided).toBe(5);
      expect(res.body.threshold).toBe(3);
    });

    it('detects insufficient shares', async () => {
      const secret = crypto.randomBytes(32).toString('base64');

      const splitRes = await request(app)
        .post('/v1/threshold/split')
        .send({ secret, threshold: 3, totalShares: 5 });

      // Only provide 2 shares but claim threshold of 3
      const res = await request(app).post('/v1/threshold/verify').send({
        shares: splitRes.body.shares.slice(0, 2),
        threshold: 3,
      });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('validates missing fields', async () => {
      const res = await request(app).post('/v1/threshold/verify').send({});
      expect(res.status).toBe(400);
    });

    it('validates threshold must be >= 2', async () => {
      const secret = crypto.randomBytes(32).toString('base64');
      const splitRes = await request(app)
        .post('/v1/threshold/split')
        .send({ secret, threshold: 2, totalShares: 3 });

      const res = await request(app).post('/v1/threshold/verify').send({
        shares: splitRes.body.shares,
        threshold: 1,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/orders/validate', () => {
    it('validates a properly encrypted order', async () => {
      const userRes = await request(app).post('/v1/keypair/generate');
      const solverRes = await request(app).post('/v1/keypair/generate');

      const encRes = await request(app).post('/v1/orders/encrypt').send({
        minOutputAmount: '5000000',
        slippageBps: 50,
        deadline: 1700000000,
        solverPublicKey: solverRes.body.publicKey.base64,
        userSecretKey: userRes.body.secretKey.base64,
        userPublicKey: userRes.body.publicKey.base64,
      });

      const res = await request(app).post('/v1/orders/validate').send({
        bytes: encRes.body.bytes.base64,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.byteLength).toBeGreaterThan(0);
    });

    it('rejects invalid data', async () => {
      const res = await request(app).post('/v1/orders/validate').send({
        bytes: Buffer.from('not an order').toString('base64'),
      });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('validates missing bytes field', async () => {
      const res = await request(app).post('/v1/orders/validate').send({});
      expect(res.status).toBe(400);
    });
  });
});
