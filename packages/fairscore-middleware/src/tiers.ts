import {
  TierLevel,
  TierBenefits,
  MevProtectionLevel,
  OrderType,
  DerivativeType,
  TierDefinition,
} from './types';

/**
 * Tier configuration matching the architecture design
 *
 * | FairScore | Tier    | Fee   | MEV Protection | Order Types        | Derivatives |
 * |-----------|---------|-------|----------------|--------------------| ------------|
 * | < 20      | None    | 0.50% | None           | Market only        | None        |
 * | 20-39     | Bronze  | 0.30% | Basic          | + Limit            | None        |
 * | 40-59     | Silver  | 0.15% | Full           | + TWAP             | Basic perps |
 * | 60-79     | Gold    | 0.08% | Full + Priority| + All advanced     | All         |
 * | 80+       | Diamond | 0.05% | VIP routing    | + Dark pool        | All + exotic|
 */
export const TIER_CONFIG: Record<TierLevel, TierBenefits> = {
  [TierLevel.None]: {
    tier: TierLevel.None,
    tierName: 'None',
    feeBps: 50,
    mevProtection: MevProtectionLevel.None,
    orderTypes: [OrderType.Market],
    derivativesAccess: [],
    maxOrderSize: 10000, // $10k max
  },
  [TierLevel.Bronze]: {
    tier: TierLevel.Bronze,
    tierName: 'Bronze',
    feeBps: 30,
    mevProtection: MevProtectionLevel.Basic,
    orderTypes: [OrderType.Market, OrderType.Limit],
    derivativesAccess: [],
    maxOrderSize: 50000, // $50k max
  },
  [TierLevel.Silver]: {
    tier: TierLevel.Silver,
    tierName: 'Silver',
    feeBps: 15,
    mevProtection: MevProtectionLevel.Full,
    orderTypes: [OrderType.Market, OrderType.Limit, OrderType.Twap],
    derivativesAccess: [DerivativeType.Perpetuals],
    maxOrderSize: 250000, // $250k max
  },
  [TierLevel.Gold]: {
    tier: TierLevel.Gold,
    tierName: 'Gold',
    feeBps: 8,
    mevProtection: MevProtectionLevel.Priority,
    orderTypes: [OrderType.Market, OrderType.Limit, OrderType.Twap, OrderType.Iceberg],
    derivativesAccess: [DerivativeType.Perpetuals, DerivativeType.Variance],
    maxOrderSize: null, // Unlimited
  },
  [TierLevel.Diamond]: {
    tier: TierLevel.Diamond,
    tierName: 'Diamond',
    feeBps: 5,
    mevProtection: MevProtectionLevel.Priority,
    orderTypes: [OrderType.Market, OrderType.Limit, OrderType.Twap, OrderType.Iceberg, OrderType.Dark],
    derivativesAccess: [DerivativeType.Perpetuals, DerivativeType.Variance, DerivativeType.Exotic],
    maxOrderSize: null, // Unlimited
  },
};

/**
 * Score thresholds for each tier
 */
export const TIER_THRESHOLDS: Record<TierLevel, number> = {
  [TierLevel.None]: 0,
  [TierLevel.Bronze]: 20,
  [TierLevel.Silver]: 40,
  [TierLevel.Gold]: 60,
  [TierLevel.Diamond]: 80,
};

/**
 * Tier calculator utility
 */
export class TierCalculator {
  /**
   * Calculate tier from FairScore
   */
  static getTierFromScore(score: number): TierLevel {
    if (score >= 80) return TierLevel.Diamond;
    if (score >= 60) return TierLevel.Gold;
    if (score >= 40) return TierLevel.Silver;
    if (score >= 20) return TierLevel.Bronze;
    return TierLevel.None;
  }

  /**
   * Get tier benefits from score
   */
  static getBenefitsFromScore(score: number): TierBenefits {
    const tier = this.getTierFromScore(score);
    return TIER_CONFIG[tier];
  }

  /**
   * Get fee in basis points for a given score
   */
  static getFeeBps(score: number): number {
    return this.getBenefitsFromScore(score).feeBps;
  }

  /**
   * Get MEV protection level for a given score
   */
  static getMevProtection(score: number): MevProtectionLevel {
    return this.getBenefitsFromScore(score).mevProtection;
  }

  /**
   * Check if an order type is allowed for a given score
   */
  static isOrderTypeAllowed(score: number, orderType: OrderType): boolean {
    const benefits = this.getBenefitsFromScore(score);
    return benefits.orderTypes.includes(orderType);
  }

  /**
   * Check if a derivative type is allowed for a given score
   */
  static isDerivativeAllowed(score: number, derivativeType: DerivativeType): boolean {
    const benefits = this.getBenefitsFromScore(score);
    return benefits.derivativesAccess.includes(derivativeType);
  }

  /**
   * Check if order size is within tier limits
   */
  static isOrderSizeAllowed(score: number, orderSizeUsd: number): boolean {
    const benefits = this.getBenefitsFromScore(score);
    if (benefits.maxOrderSize === null) return true;
    return orderSizeUsd <= benefits.maxOrderSize;
  }

  /**
   * Calculate fee amount for a given order
   */
  static calculateFee(score: number, orderAmount: bigint): bigint {
    const feeBps = this.getFeeBps(score);
    return (orderAmount * BigInt(feeBps)) / BigInt(10000);
  }

  /**
   * Convert tier config to on-chain format
   */
  static toOnChainFormat(): TierDefinition[] {
    return Object.values(TierLevel)
      .filter((v) => typeof v === 'number')
      .map((tier) => {
        const benefits = TIER_CONFIG[tier as TierLevel];
        return {
          minFairscore: TIER_THRESHOLDS[tier as TierLevel],
          feeBps: benefits.feeBps,
          mevProtectionLevel: benefits.mevProtection,
          allowedOrderTypes: this.orderTypesToBitmask(benefits.orderTypes),
          derivativesAccess: this.derivativesToBitmask(benefits.derivativesAccess),
        };
      });
  }

  /**
   * Convert order types array to bitmask
   */
  private static orderTypesToBitmask(orderTypes: OrderType[]): number {
    let mask = 0;
    if (orderTypes.includes(OrderType.Market)) mask |= 1;
    if (orderTypes.includes(OrderType.Limit)) mask |= 2;
    if (orderTypes.includes(OrderType.Twap)) mask |= 4;
    if (orderTypes.includes(OrderType.Iceberg)) mask |= 8;
    if (orderTypes.includes(OrderType.Dark)) mask |= 16;
    return mask;
  }

  /**
   * Convert derivatives array to bitmask
   */
  private static derivativesToBitmask(derivatives: DerivativeType[]): number {
    let mask = 0;
    if (derivatives.includes(DerivativeType.Perpetuals)) mask |= 1;
    if (derivatives.includes(DerivativeType.Variance)) mask |= 2;
    if (derivatives.includes(DerivativeType.Exotic)) mask |= 4;
    return mask;
  }
}
