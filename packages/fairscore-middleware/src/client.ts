import { PublicKey } from '@solana/web3.js';
import {
  FairScoreConfig,
  FairScoreResponse,
  FairScoreProof,
  TierBenefits,
} from './types';
import { TierCalculator } from './tiers';
import { createProofMessage } from './verification';

const DEFAULT_BASE_URL = 'https://api.fairscale.xyz';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: FairScoreResponse;
  expiry: number;
}

/**
 * FairScale API client for fetching and caching FairScores
 */
export class FairScoreClient {
  private apiKey: string;
  private baseUrl: string;
  private cacheTtlMs: number;
  private cache: Map<string, CacheEntry>;

  constructor(config: FairScoreConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.cacheTtlMs = config.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    this.cache = new Map();
  }

  /**
   * Fetch FairScore for a wallet address
   */
  async getFairScore(wallet: PublicKey | string): Promise<FairScoreResponse> {
    const walletStr = typeof wallet === 'string' ? wallet : wallet.toString();

    // Check cache first
    const cached = this.cache.get(walletStr);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Fetch from API
    const response = await fetch(
      `${this.baseUrl}/v1/score/${walletStr}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Wallet not found - return default score of 0
        return this.getDefaultScore(walletStr);
      }
      throw new Error(`FairScale API error: ${response.status} ${response.statusText}`);
    }

    const data: FairScoreResponse = await response.json();

    // Cache the result
    this.cache.set(walletStr, {
      data,
      expiry: Date.now() + this.cacheTtlMs,
    });

    return data;
  }

  /**
   * Get tier benefits for a wallet
   */
  async getTierBenefits(wallet: PublicKey | string): Promise<TierBenefits> {
    const score = await this.getFairScore(wallet);
    return TierCalculator.getBenefitsFromScore(score.score);
  }

  /**
   * Create a proof for on-chain verification
   */
  async createProof(wallet: PublicKey | string): Promise<FairScoreProof> {
    const walletStr = typeof wallet === 'string' ? wallet : wallet.toString();
    const score = await this.getFairScore(walletStr);

    const timestamp = Date.now();
    const message = createProofMessage(walletStr, score.score, score.tier, timestamp);

    // The signature comes from FairScale API
    // In production, this would be verified against FairScale's public key
    const signatureBytes = this.hexToBytes(score.signature);

    return {
      wallet: walletStr,
      score: score.score,
      tier: score.tier,
      timestamp,
      signature: signatureBytes,
      message,
    };
  }

  /**
   * Check if a wallet meets minimum tier requirements
   */
  async meetsMinimumTier(wallet: PublicKey | string, minTier: number): Promise<boolean> {
    const score = await this.getFairScore(wallet);
    return score.tier >= minTier;
  }

  /**
   * Get fee in basis points for a wallet
   */
  async getFeeBps(wallet: PublicKey | string): Promise<number> {
    const score = await this.getFairScore(wallet);
    return TierCalculator.getFeeBps(score.score);
  }

  /**
   * Batch fetch FairScores for multiple wallets
   */
  async getBatchFairScores(wallets: (PublicKey | string)[]): Promise<Map<string, FairScoreResponse>> {
    const results = new Map<string, FairScoreResponse>();

    // Fetch all in parallel
    const promises = wallets.map(async (wallet) => {
      const walletStr = typeof wallet === 'string' ? wallet : wallet.toString();
      const score = await this.getFairScore(walletStr);
      return { wallet: walletStr, score };
    });

    const resolved = await Promise.all(promises);

    for (const { wallet, score } of resolved) {
      results.set(wallet, score);
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific wallet
   */
  clearCacheForWallet(wallet: PublicKey | string): void {
    const walletStr = typeof wallet === 'string' ? wallet : wallet.toString();
    this.cache.delete(walletStr);
  }

  /**
   * Get default score for unknown wallets
   */
  private getDefaultScore(wallet: string): FairScoreResponse {
    return {
      wallet,
      score: 0,
      tier: 0,
      components: {
        transaction_history: 0,
        defi_activity: 0,
        nft_holdings: 0,
        governance_participation: 0,
        account_age: 0,
      },
      last_updated: new Date().toISOString(),
      signature: '',
    };
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    if (!hex || hex.length === 0) {
      return new Uint8Array(0);
    }
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
}

/**
 * Create a FairScore client instance
 */
export function createFairScoreClient(config: FairScoreConfig): FairScoreClient {
  return new FairScoreClient(config);
}
