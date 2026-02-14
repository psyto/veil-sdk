import request from 'supertest';
import { getTestApp, resetTestDb, AUTH_HEADER } from '../helpers/setup';

describe('PUDD lifecycle', () => {
  beforeEach(() => {
    resetTestDb();
  });

  it('rejects unauthenticated provision', async () => {
    const res = await request(getTestApp())
      .post('/provision')
      .send({ 'quicknode-id': 'qn-1', 'endpoint-id': 'ep-1', plan: 'starter' });
    expect(res.status).toBe(401);
  });

  it('provisions, updates, deactivates, deprovisions', async () => {
    const app = getTestApp();

    // Provision
    const provision = await request(app)
      .post('/provision')
      .set('Authorization', AUTH_HEADER)
      .send({
        'quicknode-id': 'qn-1',
        'endpoint-id': 'ep-1',
        plan: 'starter',
        'http-url': 'https://example.solana-mainnet.quiknode.pro/abc',
        chain: 'solana',
        network: 'mainnet-beta',
      });
    expect(provision.status).toBe(200);
    expect(provision.body.status).toBe('success');

    // Duplicate provision is idempotent (succeeds)
    const dup = await request(app)
      .post('/provision')
      .set('Authorization', AUTH_HEADER)
      .send({ 'quicknode-id': 'qn-1', 'endpoint-id': 'ep-1', plan: 'starter' });
    expect(dup.status).toBe(200);
    expect(dup.body.status).toBe('success');

    // Update
    const update = await request(app)
      .put('/update')
      .set('Authorization', AUTH_HEADER)
      .send({ 'endpoint-id': 'ep-1', plan: 'pro' });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe('success');

    // Deactivate
    const deactivate = await request(app)
      .delete('/deactivate_endpoint')
      .set('Authorization', AUTH_HEADER)
      .send({ 'endpoint-id': 'ep-1' });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.status).toBe('success');

    // Deprovision
    const deprovision = await request(app)
      .delete('/deprovision')
      .set('Authorization', AUTH_HEADER)
      .send({ 'quicknode-id': 'qn-1' });
    expect(deprovision.status).toBe(200);
    expect(deprovision.body.status).toBe('success');
  });
});
