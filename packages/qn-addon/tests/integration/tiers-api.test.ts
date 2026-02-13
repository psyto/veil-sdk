import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('Tiers API', () => {
  const app = getTestApp();

  it('GET /v1/tiers/50 returns Silver', async () => {
    const res = await request(app).get('/v1/tiers/50');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tierName).toBe('Silver');
    expect(res.body.feeBps).toBe(15);
  });

  it('GET /v1/tiers/90 returns Diamond', async () => {
    const res = await request(app).get('/v1/tiers/90');
    expect(res.status).toBe(200);
    expect(res.body.tierName).toBe('Diamond');
  });

  it('validates score range', async () => {
    const res = await request(app).get('/v1/tiers/150');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
