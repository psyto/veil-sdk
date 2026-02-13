import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('GET /healthcheck', () => {
  it('returns ok', async () => {
    const res = await request(getTestApp()).get('/healthcheck');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
