import { splitSecret, combineShares, verifyShares, SecretShare } from '@veil/crypto';

export function split(secret: Uint8Array, threshold: number, totalShares: number): SecretShare[] {
  return splitSecret(secret, threshold, totalShares);
}

export function combine(shares: SecretShare[]): Uint8Array {
  return combineShares(shares);
}

export function verify(shares: SecretShare[], expectedThreshold: number): boolean {
  return verifyShares(shares, expectedThreshold);
}
