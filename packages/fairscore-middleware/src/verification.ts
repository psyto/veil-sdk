import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { FairScoreProof } from './types';

/**
 * FairScale signer configuration.
 * Set the actual FairScale Ed25519 public key before using signature verification.
 */
let fairscaleSignerPubkey: PublicKey | null = null;

/**
 * Configure the FairScale signer public key for Ed25519 signature verification.
 * Must be called before proofs with signatures can be verified.
 */
export function setFairScaleSignerPubkey(pubkey: PublicKey | string): void {
  fairscaleSignerPubkey = typeof pubkey === 'string' ? new PublicKey(pubkey) : pubkey;
}

/**
 * Get the currently configured FairScale signer public key, or null if not set.
 */
export function getFairScaleSignerPubkey(): PublicKey | null {
  return fairscaleSignerPubkey;
}

/**
 * Maximum age of a FairScore proof in milliseconds (10 minutes)
 */
export const MAX_PROOF_AGE_MS = 10 * 60 * 1000;

/**
 * Create a message for FairScore proof signing
 * Format: "fairscore:{wallet}:{score}:{tier}:{timestamp}"
 */
export function createProofMessage(
  wallet: string,
  score: number,
  tier: number,
  timestamp: number
): Uint8Array {
  const message = `fairscore:${wallet}:${score}:${tier}:${timestamp}`;
  return new TextEncoder().encode(message);
}

/**
 * Verify a FairScore proof
 *
 * In production, this would verify the Ed25519 signature from FairScale.
 * For the hackathon, we use a simplified verification that checks:
 * 1. Proof is not too old
 * 2. Message format is correct
 * 3. Score and tier are consistent
 */
export function verifyFairScoreProof(
  proof: FairScoreProof,
  maxAgeMs: number = MAX_PROOF_AGE_MS
): { valid: boolean; error?: string } {
  // Check proof age
  const age = Date.now() - proof.timestamp;
  if (age > maxAgeMs) {
    return {
      valid: false,
      error: `Proof expired: age ${age}ms exceeds max ${maxAgeMs}ms`,
    };
  }

  // Check proof is not from the future
  if (proof.timestamp > Date.now() + 60000) { // Allow 1 minute clock skew
    return {
      valid: false,
      error: 'Proof timestamp is in the future',
    };
  }

  // Verify score is within valid range
  if (proof.score < 0 || proof.score > 100) {
    return {
      valid: false,
      error: `Invalid score: ${proof.score}. Must be between 0 and 100`,
    };
  }

  // Verify tier is within valid range
  if (proof.tier < 0 || proof.tier > 5) {
    return {
      valid: false,
      error: `Invalid tier: ${proof.tier}. Must be between 0 and 5`,
    };
  }

  // Verify tier matches score
  const expectedTier = getTierFromScore(proof.score);
  if (proof.tier !== expectedTier) {
    return {
      valid: false,
      error: `Tier mismatch: got ${proof.tier}, expected ${expectedTier} for score ${proof.score}`,
    };
  }

  // Verify wallet is a valid Solana address
  try {
    new PublicKey(proof.wallet);
  } catch {
    return {
      valid: false,
      error: `Invalid wallet address: ${proof.wallet}`,
    };
  }

  // Verify message format
  const expectedMessage = createProofMessage(
    proof.wallet,
    proof.score,
    proof.tier,
    proof.timestamp
  );

  if (!arraysEqual(proof.message, expectedMessage)) {
    return {
      valid: false,
      error: 'Message format mismatch',
    };
  }

  // Verify Ed25519 signature
  if (proof.signature.length === 0) {
    console.warn('Warning: FairScore proof has empty signature — skipping signature check');
  } else if (!fairscaleSignerPubkey) {
    console.warn('Warning: FairScale signer pubkey not configured — skipping signature check. Call setFairScaleSignerPubkey() to enable.');
  } else {
    const valid = nacl.sign.detached.verify(
      proof.message,
      proof.signature,
      fairscaleSignerPubkey.toBytes()
    );
    if (!valid) {
      return {
        valid: false,
        error: 'Ed25519 signature verification failed',
      };
    }
  }

  return { valid: true };
}

/**
 * Verify proof for on-chain submission
 * Returns the data needed for the smart contract
 */
export function prepareProofForOnChain(proof: FairScoreProof): {
  wallet: Uint8Array;
  score: number;
  tier: number;
  timestamp: bigint;
  signature: Uint8Array;
} {
  const verification = verifyFairScoreProof(proof);
  if (!verification.valid) {
    throw new Error(`Invalid proof: ${verification.error}`);
  }

  return {
    wallet: new PublicKey(proof.wallet).toBytes(),
    score: proof.score,
    tier: proof.tier,
    timestamp: BigInt(proof.timestamp),
    signature: proof.signature,
  };
}

/**
 * Get tier from score (matching TierCalculator logic)
 */
function getTierFromScore(score: number): number {
  if (score >= 80) return 4; // Diamond
  if (score >= 60) return 3; // Gold
  if (score >= 40) return 2; // Silver
  if (score >= 20) return 1; // Bronze
  return 0; // None
}

/**
 * Compare two Uint8Arrays for equality
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
