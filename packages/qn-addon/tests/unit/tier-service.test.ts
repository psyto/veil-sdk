import * as tierService from '../../src/services/tier-service';

describe('tier-service', () => {
  it('returns None tier for score < 20', () => {
    const benefits = tierService.getBenefits(10);
    expect(benefits.tierName).toBe('None');
    expect(benefits.feeBps).toBe(50);
  });

  it('returns Bronze tier for score 20-39', () => {
    const benefits = tierService.getBenefits(25);
    expect(benefits.tierName).toBe('Bronze');
    expect(benefits.feeBps).toBe(30);
  });

  it('returns Silver tier for score 40-59', () => {
    const benefits = tierService.getBenefits(50);
    expect(benefits.tierName).toBe('Silver');
    expect(benefits.feeBps).toBe(15);
  });

  it('returns Gold tier for score 60-79', () => {
    const benefits = tierService.getBenefits(70);
    expect(benefits.tierName).toBe('Gold');
    expect(benefits.feeBps).toBe(8);
  });

  it('returns Diamond tier for score >= 80', () => {
    const benefits = tierService.getBenefits(90);
    expect(benefits.tierName).toBe('Diamond');
    expect(benefits.feeBps).toBe(5);
  });
});
