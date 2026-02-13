import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('Orders API', () => {
  const app = getTestApp();

  it('encrypt → decrypt order roundtrip', async () => {
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
    expect(encRes.status).toBe(200);
    expect(encRes.body.success).toBe(true);

    const decRes = await request(app).post('/v1/orders/decrypt').send({
      bytes: encRes.body.bytes.base64,
      userPublicKey: userRes.body.publicKey.base64,
      solverSecretKey: solverRes.body.secretKey.base64,
      solverPublicKey: solverRes.body.publicKey.base64,
    });
    expect(decRes.status).toBe(200);
    expect(decRes.body.success).toBe(true);
    expect(decRes.body.payload.minOutputAmount).toBe('5000000');
    expect(decRes.body.payload.slippageBps).toBe(50);
    expect(decRes.body.payload.deadline).toBe(1700000000);
  });
});
