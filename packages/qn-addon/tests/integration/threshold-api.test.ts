import request from 'supertest';
import crypto from 'crypto';
import { getTestApp } from '../helpers/setup';

describe('Threshold API', () => {
  const app = getTestApp();

  it('split → combine roundtrip', async () => {
    const secret = crypto.randomBytes(32).toString('base64');

    const splitRes = await request(app)
      .post('/v1/threshold/split')
      .send({ secret, threshold: 3, totalShares: 5 });
    expect(splitRes.status).toBe(200);
    expect(splitRes.body.success).toBe(true);
    expect(splitRes.body.shares).toHaveLength(5);

    // Take 3 shares to combine
    const combineRes = await request(app)
      .post('/v1/threshold/combine')
      .send({ shares: splitRes.body.shares.slice(0, 3) });
    expect(combineRes.status).toBe(200);
    expect(combineRes.body.success).toBe(true);
    expect(combineRes.body.secret.base64).toBe(secret);
  });

  it('validates secret must be 32 bytes', async () => {
    const res = await request(app)
      .post('/v1/threshold/split')
      .send({ secret: Buffer.from('short').toString('base64'), threshold: 2, totalShares: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/32 bytes/);
  });
});
