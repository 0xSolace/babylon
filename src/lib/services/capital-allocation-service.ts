/**
 * Capital Allocation Service
 *
 * Assigns realistic starting capital to NPCs based on:
 * - Tier (S/A/B/C)
 * - Role (CEO, VC, influencer, etc.)
 * - Domain (finance, tech, media, etc.)
 *
 * This creates a natural market hierarchy where whales have more influence.
 */

import type { Actor } from '@/shared/types';

type CapitalAllocation = {
  tradingBalance: number;
  initialPoolBalance: number;
  reputationPoints: number;
  reasoning: string;
};

export class CapitalAllocationService {
  /**
   * Calculate starting capital for an NPC based on their profile
   */
  static calculateCapital(actor: Actor): CapitalAllocation {
    // Base capital by tier
    const tierCapital = CapitalAllocationService.getTierCapital(actor.tier || 'C_TIER');

    // Role multiplier
    const roleMultiplier = CapitalAllocationService.getRoleMultiplier(actor.description || '');

    // Domain multiplier
    const domainMultiplier = CapitalAllocationService.getDomainMultiplier(actor.domain || []);

    // Calculate final amount
    const tradingBalance = Math.round(tierCapital * roleMultiplier * domainMultiplier);

    // Pool starts with same amount as personal balance
    const initialPoolBalance = tradingBalance;

    // Reputation points scale with capital (but not 1:1)
    // Formula: sqrt(capital) * 10 gives reasonable scaling
    // $10k → 1,000 points
    // $100k → 3,162 points
    // $500k → 7,071 points
    const reputationPoints = Math.round(Math.sqrt(tradingBalance) * 10);

    const reasoning = CapitalAllocationService.generateReasoning(
      actor,
      tierCapital,
      roleMultiplier,
      domainMultiplier
    );

    return {
      tradingBalance,
      initialPoolBalance,
      reputationPoints,
      reasoning,
    };
  }

  /**
   * Get example allocations for common actor types
   */
  static getExampleAllocations(): Array<{
    description: string;
    capital: number;
    reputation: number;
  }> {
    return [
      {
        description: 'S-tier Tech CEO (AIlon)',
        capital: 500000,
        reputation: 7071,
      },
      {
        description: 'S-tier VC Founder (Peter ThAIl)',
        capital: 450000,
        reputation: 6708,
      },
      {
        description: 'A-tier VC (Marc AIndreessen)',
        capital: 135000,
        reputation: 3674,
      },
      {
        description: 'A-tier CEO (Jeff BAIzos)',
        capital: 150000,
        reputation: 3873,
      },
      {
        description: 'B-tier Investor (CathAI Wood)',
        capital: 27500,
        reputation: 1658,
      },
      {
        description: 'B-tier Media Host (Tucker)',
        capital: 20000,
        reputation: 1414,
      },
      { description: 'C-tier Influencer', capital: 8000, reputation: 894 },
      { description: 'C-tier Journalist', capital: 8000, reputation: 894 },
      { description: 'User (starting)', capital: 1000, reputation: 1000 },
    ];
  }

  /**
   * Validate capital allocation makes sense
   */
  static validateAllocation(actor: Actor, allocation: CapitalAllocation): boolean {
    // Minimum: $5,000
    if (allocation.tradingBalance < 5000) return false;

    // Maximum: $1,000,000
    if (allocation.tradingBalance > 1000000) return false;

    // S-tier should have at least $100k
    if (actor.tier === 'S_TIER' && allocation.tradingBalance < 100000) return false;

    // C-tier should have less than $50k
    if (actor.tier === 'C_TIER' && allocation.tradingBalance > 50000) return false;

    return true;
  }
}
