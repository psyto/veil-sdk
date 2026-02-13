import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('Compression API', () => {
  const app = getTestApp();

  it('GET /v1/compression/estimate returns savings', async () => {
    const res = await request(app).get('/v1/compression/estimate?size=1024');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dataSize).toBe(1024);
    expect(parseFloat(res.body.savingsPercent)).toBeGreaterThan(0);
  });

  it('validates size parameter', async () => {
    const res = await request(app).get('/v1/compression/estimate');
    expect(res.status).toBe(400);
  });

  it('compress requires instance with http_url', async () => {
    const res = await request(app)
      .post('/v1/compression/compress')
      .send({ data: 'AAAA', payerSecretKey: 'BBBB' });
    // Missing X-INSTANCE-ID header
    expect(res.status).toBe(400);
  });
});
