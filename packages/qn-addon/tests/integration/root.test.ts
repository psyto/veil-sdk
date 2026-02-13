import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('GET /', () => {
  it('returns addon info and endpoint listing', async () => {
    const res = await request(getTestApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toContain('Veil');
    expect(res.body.version).toBe('0.1.0');
    expect(res.body.endpoints).toBeDefined();
  });
});
