import { splitSecret, combineShares, SecretShare } from '@privacy-suite/crypto';

export function split(secret: Uint8Array, threshold: number, totalShares: number): SecretShare[] {
  return splitSecret(secret, threshold, totalShares);
}

export function combine(shares: SecretShare[]): Uint8Array {
  return combineShares(shares);
}
