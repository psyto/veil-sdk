/**
 * Shamir's Secret Sharing implementation
 * Used for M-of-N threshold decryption schemes
 */

// Prime for finite field arithmetic (256-bit prime)
const PRIME = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'
);

/**
 * Secret share containing index and value
 */
export interface SecretShare {
  index: number;
  value: Uint8Array;
}

/**
 * Threshold configuration
 */
export interface ThresholdConfig {
  /** Minimum shares required to reconstruct */
  threshold: number;
  /** Total number of shares */
  totalShares: number;
}

/**
 * Generate random coefficients for polynomial
 */
function generateCoefficients(secret: bigint, degree: number): bigint[] {
  const coefficients = [secret];
  for (let i = 1; i <= degree; i++) {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const coef = bytesToBigInt(randomBytes) % PRIME;
    coefficients.push(coef);
  }
  return coefficients;
}

/**
 * Evaluate polynomial at point x
 */
function evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
  let result = BigInt(0);
  let xPower = BigInt(1);

  for (const coef of coefficients) {
    result = (result + coef * xPower) % PRIME;
    xPower = (xPower * x) % PRIME;
  }

  return result;
}

/**
 * Modular inverse using extended Euclidean algorithm
 */
function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [BigInt(1), BigInt(0)];

  while (r !== BigInt(0)) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return ((old_s % m) + m) % m;
}

/**
 * Lagrange interpolation to reconstruct secret
 */
function lagrangeInterpolate(shares: { x: bigint; y: bigint }[]): bigint {
  let secret = BigInt(0);

  for (let i = 0; i < shares.length; i++) {
    let numerator = BigInt(1);
    let denominator = BigInt(1);

    for (let j = 0; j < shares.length; j++) {
      if (i !== j) {
        numerator = (numerator * (PRIME - shares[j].x)) % PRIME;
        denominator =
          (denominator * ((shares[i].x - shares[j].x + PRIME) % PRIME)) % PRIME;
      }
    }

    const lagrangeCoef =
      (numerator * modInverse(denominator, PRIME)) % PRIME;
    secret = (secret + shares[i].y * lagrangeCoef) % PRIME;
  }

  return secret;
}

/**
 * Convert bytes to BigInt
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (const byte of bytes) {
    result = (result << BigInt(8)) + BigInt(byte);
  }
  return result;
}

/**
 * Convert BigInt to bytes (32 bytes)
 */
function bigIntToBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return bytes;
}

/**
 * Split a secret into M-of-N shares using Shamir's Secret Sharing
 *
 * @param secret - The secret to split (32 bytes)
 * @param threshold - Minimum shares required to reconstruct (M)
 * @param totalShares - Total number of shares to generate (N)
 * @returns Array of secret shares
 */
export function splitSecret(
  secret: Uint8Array,
  threshold: number,
  totalShares: number
): SecretShare[] {
  if (secret.length !== 32) {
    throw new Error('Secret must be 32 bytes');
  }
  if (threshold < 2) {
    throw new Error('Threshold must be at least 2');
  }
  if (totalShares < threshold) {
    throw new Error('Total shares must be >= threshold');
  }
  if (totalShares > 255) {
    throw new Error('Maximum 255 shares supported');
  }

  const secretBigInt = bytesToBigInt(secret);
  const coefficients = generateCoefficients(secretBigInt, threshold - 1);

  const shares: SecretShare[] = [];
  for (let i = 1; i <= totalShares; i++) {
    const x = BigInt(i);
    const y = evaluatePolynomial(coefficients, x);
    shares.push({
      index: i,
      value: bigIntToBytes(y),
    });
  }

  return shares;
}

/**
 * Combine shares to reconstruct the secret
 *
 * @param shares - Array of secret shares (at least threshold shares required)
 * @returns Reconstructed secret (32 bytes)
 */
export function combineShares(shares: SecretShare[]): Uint8Array {
  if (shares.length < 2) {
    throw new Error('At least 2 shares required');
  }

  const points = shares.map((share) => ({
    x: BigInt(share.index),
    y: bytesToBigInt(share.value),
  }));

  const secretBigInt = lagrangeInterpolate(points);
  return bigIntToBytes(secretBigInt);
}

/**
 * Verify that shares are valid by attempting partial reconstruction
 */
export function verifyShares(
  shares: SecretShare[],
  expectedThreshold: number
): boolean {
  if (shares.length < expectedThreshold) {
    return false;
  }

  try {
    // Take threshold number of shares and verify they produce consistent result
    const subset1 = shares.slice(0, expectedThreshold);
    const result1 = combineShares(subset1);

    if (shares.length > expectedThreshold) {
      // Try different subset
      const subset2 = shares.slice(1, expectedThreshold + 1);
      const result2 = combineShares(subset2);

      // Results should match
      return result1.every((byte, i) => byte === result2[i]);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create a threshold encryption scheme
 * Encrypts a secret with a random key, then splits the key using Shamir's
 */
export function createThresholdEncryption(
  secret: Uint8Array,
  threshold: number,
  totalShares: number
): {
  encryptedSecret: Uint8Array;
  keyShares: SecretShare[];
} {
  // Generate random encryption key
  const encryptionKey = new Uint8Array(32);
  crypto.getRandomValues(encryptionKey);

  // XOR encrypt the secret with the key
  const encryptedSecret = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i++) {
    encryptedSecret[i] = secret[i] ^ encryptionKey[i % 32];
  }

  // Split the key into shares
  const keyShares = splitSecret(encryptionKey, threshold, totalShares);

  return { encryptedSecret, keyShares };
}

/**
 * Decrypt using threshold shares
 */
export function decryptWithThreshold(
  encryptedSecret: Uint8Array,
  keyShares: SecretShare[]
): Uint8Array {
  // Reconstruct the key
  const encryptionKey = combineShares(keyShares);

  // XOR decrypt
  const secret = new Uint8Array(encryptedSecret.length);
  for (let i = 0; i < encryptedSecret.length; i++) {
    secret[i] = encryptedSecret[i] ^ encryptionKey[i % 32];
  }

  return secret;
}
