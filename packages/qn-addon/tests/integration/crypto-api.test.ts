import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('Crypto API', () => {
  const app = getTestApp();

  it('POST /v1/keypair/generate returns base64+hex keys', async () => {
    const res = await request(app).post('/v1/keypair/generate');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.publicKey.base64).toBeDefined();
    expect(res.body.publicKey.hex).toBeDefined();
    expect(res.body.secretKey.base64).toBeDefined();
  });

  it('POST /v1/keypair/derive produces deterministic result', async () => {
    const seed = Buffer.alloc(32, 99).toString('base64');

    const res1 = await request(app).post('/v1/keypair/derive').send({ seed });
    const res2 = await request(app).post('/v1/keypair/derive').send({ seed });
    expect(res1.body.publicKey.base64).toBe(res2.body.publicKey.base64);
  });

  it('encrypt → decrypt roundtrip', async () => {
    // Generate sender and recipient keypairs
    const senderRes = await request(app).post('/v1/keypair/generate');
    const recipientRes = await request(app).post('/v1/keypair/generate');

    const plaintext = Buffer.from('hello from quicknode').toString('base64');

    // Encrypt
    const encRes = await request(app).post('/v1/encrypt').send({
      plaintext,
      recipientPublicKey: recipientRes.body.publicKey.base64,
      senderSecretKey: senderRes.body.secretKey.base64,
      senderPublicKey: senderRes.body.publicKey.base64,
    });
    expect(encRes.status).toBe(200);
    expect(encRes.body.success).toBe(true);
    expect(encRes.body.bytes.base64).toBeDefined();

    // Decrypt
    const decRes = await request(app).post('/v1/decrypt').send({
      bytes: encRes.body.bytes.base64,
      senderPublicKey: senderRes.body.publicKey.base64,
      recipientSecretKey: recipientRes.body.secretKey.base64,
      recipientPublicKey: recipientRes.body.publicKey.base64,
    });
    expect(decRes.status).toBe(200);
    expect(decRes.body.success).toBe(true);
    expect(Buffer.from(decRes.body.plaintext.base64, 'base64').toString()).toBe('hello from quicknode');
  });

  it('validates missing fields', async () => {
    const res = await request(app).post('/v1/encrypt').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
