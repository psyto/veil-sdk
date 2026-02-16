const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Validates that a string is valid base64 and decodes it to a Uint8Array.
 * Returns null if the input is not valid base64.
 */
export function decodeBase64(input: string): Uint8Array | null {
  if (typeof input !== 'string' || input.length === 0) {
    return null;
  }
  if (!BASE64_REGEX.test(input)) {
    return null;
  }
  return new Uint8Array(Buffer.from(input, 'base64'));
}

/**
 * Validates and decodes base64, requiring exactly `expectedLength` bytes.
 * Returns null if invalid base64 or wrong length.
 */
export function decodeBase64Exact(input: string, expectedLength: number): Uint8Array | null {
  const bytes = decodeBase64(input);
  if (!bytes || bytes.length !== expectedLength) {
    return null;
  }
  return bytes;
}
