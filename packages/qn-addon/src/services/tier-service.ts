import { TierCalculator } from '@umbra/fairscore-middleware';
import type { TierBenefits } from '@umbra/fairscore-middleware';

export function getBenefits(score: number): TierBenefits {
  return TierCalculator.getBenefitsFromScore(score);
}
