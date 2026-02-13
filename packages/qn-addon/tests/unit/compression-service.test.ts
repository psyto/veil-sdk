import * as compressionService from '../../src/services/compression-service';

describe('compression-service', () => {
  it('estimates compression savings', () => {
    const result = compressionService.estimate(1024);
    expect(result.savingsPercent).toBeGreaterThan(0);
    expect(result.savings).toBeGreaterThan(BigInt(0));
    expect(result.uncompressedCost).toBeGreaterThan(result.compressedCost);
  });

  it('returns higher savings for larger data', () => {
    const small = compressionService.estimate(100);
    const large = compressionService.estimate(10000);
    expect(large.savings).toBeGreaterThan(small.savings);
  });
});
