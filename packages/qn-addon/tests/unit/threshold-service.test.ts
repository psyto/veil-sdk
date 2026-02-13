import * as thresholdService from '../../src/services/threshold-service';
import crypto from 'crypto';

describe('threshold-service', () => {
  it('splits and combines a 32-byte secret', () => {
    const secret = crypto.randomBytes(32);
    const shares = thresholdService.split(new Uint8Array(secret), 3, 5);

    expect(shares).toHaveLength(5);
    shares.forEach((s) => {
      expect(s.index).toBeGreaterThanOrEqual(1);
      expect(s.value).toBeInstanceOf(Uint8Array);
    });

    // Combine with threshold (3) shares
    const recovered = thresholdService.combine(shares.slice(0, 3));
    expect(Buffer.from(recovered)).toEqual(secret);
  });

  it('recovers from any M-of-N subset', () => {
    const secret = crypto.randomBytes(32);
    const shares = thresholdService.split(new Uint8Array(secret), 2, 4);

    // Use shares at index 1 and 3 (skip 0 and 2)
    const subset = [shares[1], shares[3]];
    const recovered = thresholdService.combine(subset);
    expect(Buffer.from(recovered)).toEqual(secret);
  });
});
