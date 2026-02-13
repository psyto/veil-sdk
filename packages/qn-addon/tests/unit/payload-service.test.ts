import * as payloadService from '../../src/services/payload-service';

describe('payload-service', () => {
  it('lists available schemas', () => {
    const schemas = payloadService.getAvailableSchemas();
    expect(schemas).toContain('SWAP_ORDER');
    expect(schemas).toContain('RWA_ASSET');
    expect(schemas).toContain('RWA_ACCESS_GRANT');
  });

  it('resolves named schemas', () => {
    expect(() => payloadService.resolveSchema('SWAP_ORDER')).not.toThrow();
    expect(() => payloadService.resolveSchema('unknown')).toThrow(/Unknown schema/);
  });

  it('serializes and deserializes SWAP_ORDER roundtrip', () => {
    const data = {
      minOutputAmount: '5000000',
      slippageBps: 100,
      deadline: 1700000000,
      padding: Buffer.alloc(6).toString('base64'),
    };

    const bytes = payloadService.serialize(data, 'SWAP_ORDER');
    expect(bytes.length).toBe(24); // 8 + 2 + 8 + 6

    const recovered = payloadService.deserialize(bytes, 'SWAP_ORDER');
    expect(recovered.slippageBps).toBe(100);
  });
});
