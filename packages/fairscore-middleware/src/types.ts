import { PublicKey } from '@solana/web3.js';

/**
 * Tier levels from lowest to highest
 */
export enum TierLevel {
  None = 0,
  Bronze = 1,
  Silver = 2,
  Gold = 3,
  Diamond = 4,
}

/**
 * MEV protection levels
 */
export enum MevProtectionLevel {
  None = 0,
  Basic = 1,      // Delayed reveal
  Full = 2,       // Full encryption
  Priority = 3,   // Full + priority execution
}

/**
 * FairScore API response structure
 */
export interface FairScoreResponse {
  wallet: string;
  score: number;
  tier: number;
  components: {
    transaction_history: number;
    defi_activity: number;
    nft_holdings: number;
    governance_participation: number;
    account_age: number;
  };
  last_updated: string;
  signature: string;
}

/**
 * FairScore proof for on-chain verification
 */
export interface FairScoreProof {
  wallet: string;
  score: number;
  tier: number;
  timestamp: number;
  signature: Uint8Array;
  message: Uint8Array;
}

/**
 * Benefits associated with each tier
 */
export interface TierBenefits {
  tier: TierLevel;
  tierName: string;
  feeBps: number;
  mevProtection: MevProtectionLevel;
  orderTypes: OrderType[];
  derivativesAccess: DerivativeType[];
  maxOrderSize: number | null; // null = unlimited
}

/**
 * Order types available
 */
export enum OrderType {
  Market = 'market',
  Limit = 'limit',
  Twap = 'twap',
  Iceberg = 'iceberg',
  Dark = 'dark',
}

/**
 * Derivative types available
 */
export enum DerivativeType {
  Perpetuals = 'perpetuals',
  Variance = 'variance',
  Exotic = 'exotic',
}

/**
 * Configuration for FairScore client
 */
export interface FairScoreConfig {
  apiKey: string;
  baseUrl?: string;
  cacheTtlMs?: number;
}

/**
 * Tier configuration for on-chain storage
 */
export interface TierDefinition {
  minFairscore: number;
  feeBps: number;
  mevProtectionLevel: MevProtectionLevel;
  allowedOrderTypes: number; // Bitmask
  derivativesAccess: number; // Bitmask
}

/**
 * On-chain tier config account
 */
export interface TierConfigAccount {
  authority: PublicKey;
  tiers: TierDefinition[];
  feeVault: PublicKey;
  totalVolumeByTier: bigint[];
  totalFeesCollected: bigint;
  bump: number;
}

/**
 * Extended order data with tier information
 */
export interface TieredOrderData {
  owner: PublicKey;
  orderId: bigint;
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputAmount: bigint;
  minOutputAmount: bigint;
  outputAmount: bigint;
  encryptedPayload: Uint8Array;
  status: number;
  createdAt: bigint;
  executedAt: bigint;
  executedBy: PublicKey | null;
  // Tier-specific fields
  userTier: TierLevel;
  feeBpsApplied: number;
  mevProtectionLevel: MevProtectionLevel;
  fairscoreAtCreation: number;
  bump: number;
}
