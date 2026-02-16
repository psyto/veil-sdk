import request from 'supertest';
import { getTestApp } from '../helpers/setup';

describe('Payload API', () => {
  const app = getTestApp();

  describe('POST /v1/payload/serialize', () => {
    it('serializes a SWAP_ORDER payload', async () => {
      const res = await request(app).post('/v1/payload/serialize').send({
        schema: 'SWAP_ORDER',
        data: {
          minOutputAmount: '1000000',
          slippageBps: 50,
          deadline: 1700000000,
          padding: Buffer.alloc(6).toString('base64'),
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bytes.base64).toBeDefined();
      expect(res.body.bytes.hex).toBeDefined();
      expect(res.body.size).toBeGreaterThan(0);
    });

    it('validates missing data field', async () => {
      const res = await request(app).post('/v1/payload/serialize').send({
        schema: 'SWAP_ORDER',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates missing schema field', async () => {
      const res = await request(app).post('/v1/payload/serialize').send({
        data: { minOutputAmount: '1000000' },
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unknown schema name', async () => {
      const res = await request(app).post('/v1/payload/serialize').send({
        schema: 'NONEXISTENT',
        data: { foo: 'bar' },
      });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /v1/payload/deserialize', () => {
    it('roundtrips serialize then deserialize', async () => {
      const original = {
        minOutputAmount: '1000000',
        slippageBps: 50,
        deadline: 1700000000,
        padding: Buffer.alloc(6).toString('base64'),
      };

      const serRes = await request(app).post('/v1/payload/serialize').send({
        schema: 'SWAP_ORDER',
        data: original,
      });
      expect(serRes.status).toBe(200);

      const desRes = await request(app).post('/v1/payload/deserialize').send({
        schema: 'SWAP_ORDER',
        bytes: serRes.body.bytes.base64,
      });
      expect(desRes.status).toBe(200);
      expect(desRes.body.success).toBe(true);
      expect(desRes.body.data).toBeDefined();
    });

    it('validates missing bytes field', async () => {
      const res = await request(app).post('/v1/payload/deserialize').send({
        schema: 'SWAP_ORDER',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates missing schema field', async () => {
      const res = await request(app).post('/v1/payload/deserialize').send({
        bytes: Buffer.from('test').toString('base64'),
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid base64', async () => {
      const res = await request(app).post('/v1/payload/deserialize').send({
        schema: 'SWAP_ORDER',
        bytes: 'not!valid!base64!!',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('valid base64');
    });
  });
});
