/**
 * Game Bootstrap Service
 *
 * Ensures all game data is properly seeded and synced at tick start.
 * Replaces the need for manual seeding scripts.
 */

import {
  ensureGameBootstrapContinuousGameRow,
  ensureGameBootstrapNpcUserRows,
  ensureGameBootstrapPerpMarketSnapshots,
  fetchGameBootstrapExistingStateIds,
  fetchGameBootstrapStatsCounts,
  insertGameBootstrapActorStateRow,
  insertGameBootstrapOrganizationStateRow,
  runGameBootstrapEnsureActorPoolsTransaction,
  runGameBootstrapEnsureMinimumBalancesTransaction,
  runGameBootstrapSyncActorTransaction,
  runGameBootstrapSyncOrganizationTransaction,
  seedGameBootstrapRssFeedRows,
} from '@babylon/db';
import type { ActorTier } from '@babylon/shared';
import { logger } from '@babylon/shared';
import { DEFAULT_RSS_SOURCES } from '../config/rss-sources';
import { CapitalAllocationService } from './capital-allocation-service';
import { StaticDataRegistry } from './static-data-registry';

// Minimum balance thresholds by tier
const MINIMUM_BALANCE_BY_TIER: Record<string, number> = {
  S_TIER: 50000,
  A_TIER: 25000,
  B_TIER: 10000,
  C_TIER: 5000,
};

const DEFAULT_MINIMUM_BALANCE = 5000;
const MAX_TOP_UP_AMOUNT = 100000;

/** Funding interval in hours for perpetual markets */
const FUNDING_INTERVAL_HOURS = 8;
/** Funding interval in milliseconds */
const FUNDING_INTERVAL_MS = FUNDING_INTERVAL_HOURS * 60 * 60 * 1000;

export interface GameBootstrapResult {
  actorsCreated: number;
  actorsUpdated: number;
  actorsToppedUp: number;
  npcUsersCreated: number;
  organizationsCreated: number;
  organizationsUpdated: number;
  poolsCreated: number;
  rssFeedsCreated: number;
  perpMarketsCreated: number;
  gameStateInitialized: boolean;
  totalTopUpAmount: number;
}

export class GameBootstrapService {
  private static lastBootstrapTime = 0;
  private static BOOTSTRAP_COOLDOWN_MS = 60000;
  private static isBootstrapping = false;

  static async bootstrapIfNeeded(): Promise<GameBootstrapResult | null> {
    const now = Date.now();

    // Check if we've bootstrapped recently
    if (now - this.lastBootstrapTime < this.BOOTSTRAP_COOLDOWN_MS) {
      return null;
    }

    // Prevent concurrent bootstrapping
    if (this.isBootstrapping) {
      return null;
    }

    this.isBootstrapping = true;
    this.lastBootstrapTime = now;

    const result: GameBootstrapResult = {
      actorsCreated: 0,
      actorsUpdated: 0,
      actorsToppedUp: 0,
      npcUsersCreated: 0,
      organizationsCreated: 0,
      organizationsUpdated: 0,
      poolsCreated: 0,
      rssFeedsCreated: 0,
      perpMarketsCreated: 0,
      gameStateInitialized: false,
      totalTopUpAmount: 0,
    };

    try {
      // Get static data from registry (no file loading needed)
      const staticActors = StaticDataRegistry.getAllActors();
      const staticOrgs = StaticDataRegistry.getAllOrganizations();

      // Get existing database state from state tables
      const { actorIds: existingActorStates, orgIds: existingOrgStates } =
        await fetchGameBootstrapExistingStateIds();
      const existingActorIds = new Set(existingActorStates.map((a) => a.id));
      const existingOrgIds = new Set(existingOrgStates.map((o) => o.id));

      // 1. Sync actor states (only dynamic data)
      for (const actor of staticActors) {
        if (!existingActorIds.has(actor.id)) {
          await this.seedActorState(actor);
          result.actorsCreated++;
        }
      }

      // 2. Sync organization states (only dynamic data)
      for (const org of staticOrgs) {
        if (!existingOrgIds.has(org.id)) {
          await this.seedOrganizationState(org);
          result.organizationsCreated++;
        }
      }

      // 3. Ensure minimum balances
      const topUpResult = await this.ensureMinimumBalances();
      result.actorsToppedUp = topUpResult.count;
      result.totalTopUpAmount = topUpResult.totalAmount;

      // 4. Ensure pools exist
      result.poolsCreated = await this.ensureActorPools();

      // 4b. Ensure NPC User records exist (for wallet/payout operations)
      result.npcUsersCreated = await this.ensureNpcUsers(staticActors);

      // 5. Ensure game state exists
      result.gameStateInitialized = await this.ensureGameState();

      // 6. Ensure RSS feeds
      result.rssFeedsCreated = await this.ensureRSSFeeds();

      // 7. Ensure perp market snapshots exist for all tradeable organizations
      result.perpMarketsCreated = await this.ensurePerpMarketSnapshots();

      // Log summary if anything changed
      const hasChanges =
        result.actorsCreated > 0 ||
        result.actorsToppedUp > 0 ||
        result.npcUsersCreated > 0 ||
        result.organizationsCreated > 0 ||
        result.poolsCreated > 0 ||
        result.rssFeedsCreated > 0 ||
        result.perpMarketsCreated > 0 ||
        result.gameStateInitialized;

      if (hasChanges) {
        logger.info('Game bootstrap complete', result, 'GameBootstrapService');
      }

      return result;
    } catch (error) {
      logger.error(
        'Game bootstrap failed',
        { error: String(error) },
        'GameBootstrapService'
      );
      throw error;
    } finally {
      this.isBootstrapping = false;
    }
  }

  static async forceFullSync(): Promise<GameBootstrapResult> {
    this.lastBootstrapTime = 0;
    this.isBootstrapping = false;

    const result: GameBootstrapResult = {
      actorsCreated: 0,
      actorsUpdated: 0,
      actorsToppedUp: 0,
      npcUsersCreated: 0,
      organizationsCreated: 0,
      organizationsUpdated: 0,
      poolsCreated: 0,
      rssFeedsCreated: 0,
      perpMarketsCreated: 0,
      gameStateInitialized: false,
      totalTopUpAmount: 0,
    };

    // Get static data from registry
    const staticActors = StaticDataRegistry.getAllActors();
    const staticOrgs = StaticDataRegistry.getAllOrganizations();

    // Sync all actor states (update existing, create missing)
    for (const actor of staticActors) {
      const syncResult = await this.syncActorState(actor);
      if (syncResult.created) result.actorsCreated++;
      if (syncResult.updated) result.actorsUpdated++;
    }

    // Sync all organization states
    for (const org of staticOrgs) {
      const syncResult = await this.syncOrganizationState(org);
      if (syncResult.created) result.organizationsCreated++;
      if (syncResult.updated) result.organizationsUpdated++;
    }

    // Ensure minimum balances
    const topUpResult = await this.ensureMinimumBalances();
    result.actorsToppedUp = topUpResult.count;
    result.totalTopUpAmount = topUpResult.totalAmount;

    result.poolsCreated = await this.ensureActorPools();

    // Ensure NPC User records exist (for wallet/payout operations)
    result.npcUsersCreated = await this.ensureNpcUsers(staticActors);

    result.gameStateInitialized = await this.ensureGameState();
    result.rssFeedsCreated = await this.ensureRSSFeeds();
    result.perpMarketsCreated = await this.ensurePerpMarketSnapshots();

    logger.info('Force full sync complete', result, 'GameBootstrapService');
    return result;
  }

  private static async seedActorState(actor: {
    id: string;
    name: string;
    tier: ActorTier | null;
    domain: string[];
  }): Promise<void> {
    const capital = CapitalAllocationService.calculateCapital({
      id: actor.id,
      name: actor.name,
      description: undefined,
      domain: actor.domain,
      tier: actor.tier ?? undefined,
    });

    await insertGameBootstrapActorStateRow({
      id: actor.id,
      tradingBalance: capital.tradingBalance.toString(),
      reputationPoints: capital.reputationPoints,
    });

    logger.debug(
      `Seeded actor state ${actor.name} with $${capital.tradingBalance}`,
      { actorId: actor.id },
      'GameBootstrapService'
    );
  }

  private static async syncActorState(actor: {
    id: string;
    name: string;
    tier: ActorTier | null;
    domain: string[];
  }): Promise<{ created: boolean; updated: boolean }> {
    const capital = CapitalAllocationService.calculateCapital({
      id: actor.id,
      name: actor.name,
      description: undefined,
      domain: actor.domain,
      tier: actor.tier ?? undefined,
    });

    const tier = actor.tier || 'C_TIER';
    const minimumBalance =
      MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE;

    const outcome = await runGameBootstrapSyncActorTransaction({
      actorId: actor.id,
      insertIfMissing: {
        tradingBalance: capital.tradingBalance.toString(),
        reputationPoints: capital.reputationPoints,
      },
      minimumBalanceWhenExists: minimumBalance,
    });

    if (outcome.created) {
      logger.debug(
        `Seeded actor state ${actor.name} with $${capital.tradingBalance}`,
        { actorId: actor.id },
        'GameBootstrapService'
      );
    }

    return outcome;
  }

  private static async seedOrganizationState(org: {
    id: string;
    name: string;
    initialPrice: number | null;
  }): Promise<void> {
    await insertGameBootstrapOrganizationStateRow({
      id: org.id,
      currentPrice: org.initialPrice,
      basePrice: org.initialPrice ?? 100.0,
    });

    logger.debug(
      `Seeded organization state ${org.name}`,
      { orgId: org.id },
      'GameBootstrapService'
    );
  }

  private static async syncOrganizationState(org: {
    id: string;
    name: string;
    initialPrice: number | null;
  }): Promise<{ created: boolean; updated: boolean }> {
    const outcome = await runGameBootstrapSyncOrganizationTransaction({
      orgId: org.id,
      insertIfMissing: {
        currentPrice: org.initialPrice,
        basePrice: org.initialPrice ?? 100.0,
      },
    });

    if (outcome.created) {
      logger.debug(
        `Seeded organization state ${org.name}`,
        { orgId: org.id },
        'GameBootstrapService'
      );
    }

    return outcome;
  }

  private static async ensureMinimumBalances(): Promise<{
    count: number;
    totalAmount: number;
  }> {
    const { count, totalAmount, events } =
      await runGameBootstrapEnsureMinimumBalancesTransaction({
        resolveMinimumBalance: (actorId) => {
          const staticActor = StaticDataRegistry.getActor(actorId);
          const tier = staticActor?.tier || 'C_TIER';
          return MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE;
        },
        maxTopUpAmount: MAX_TOP_UP_AMOUNT,
      });

    for (const ev of events) {
      const staticActor = StaticDataRegistry.getActor(ev.actorId);
      logger.debug(
        `Topped up ${staticActor?.name ?? ev.actorId}: $${ev.previousBalance} → $${ev.newBalance}`,
        { actorId: ev.actorId, topUpAmount: ev.topUpAmount },
        'GameBootstrapService'
      );
    }

    return { count, totalAmount };
  }

  private static async ensureActorPools(): Promise<number> {
    return runGameBootstrapEnsureActorPoolsTransaction({
      resolvePoolDisplayName: (actorId) =>
        StaticDataRegistry.getActor(actorId)?.name ?? actorId,
    });
  }

  /**
   * Ensure User records exist for NPC actors
   * This allows NPCs to receive wallet credits during payouts
   */
  private static async ensureNpcUsers(
    staticActors: Array<{ id: string; name: string }>
  ): Promise<number> {
    const created = await ensureGameBootstrapNpcUserRows(staticActors);

    if (created > 0) {
      logger.info(
        `Created ${created} NPC User records`,
        { created },
        'GameBootstrapService'
      );
    }

    return created;
  }

  private static async ensureGameState(): Promise<boolean> {
    const outcome = await ensureGameBootstrapContinuousGameRow();

    if (outcome.changed && outcome.reason === 'inserted') {
      logger.info('Game state initialized', undefined, 'GameBootstrapService');
    }

    return outcome.changed;
  }

  /** Seeds rssFeedSources from DEFAULT_RSS_SOURCES (config). WHY config: single place to add/edit feed URLs; runtime enable/disable remains in DB. */
  private static async ensureRSSFeeds(): Promise<number> {
    return seedGameBootstrapRssFeedRows(DEFAULT_RSS_SOURCES);
  }

  /**
   * Ensure perp market snapshots exist for all organizations with tickers.
   * This is required for the perpetual markets to be tradeable.
   */
  private static async ensurePerpMarketSnapshots(): Promise<number> {
    const staticOrgs = StaticDataRegistry.getAllOrganizations();
    const tradeableOrgs = staticOrgs
      .filter((o) => o.ticker)
      .map((o) => ({
        id: o.id,
        ticker: o.ticker!,
        name: o.name,
        initialPrice: o.initialPrice,
      }));

    const created = await ensureGameBootstrapPerpMarketSnapshots({
      tradeableOrgs,
      fundingIntervalMs: FUNDING_INTERVAL_MS,
    });

    if (created > 0) {
      logger.info(
        `Created ${created} perp market snapshots`,
        { created },
        'GameBootstrapService'
      );
    }

    return created;
  }

  static getMinimumBalance(tier: string): number {
    return MINIMUM_BALANCE_BY_TIER[tier] || DEFAULT_MINIMUM_BALANCE;
  }

  static async getStats(): Promise<{
    actors: number;
    organizations: number;
    pools: number;
    characterMappings: number;
    organizationMappings: number;
    rssFeedSources: number;
    perpMarkets: number;
  }> {
    const counts = await fetchGameBootstrapStatsCounts();

    return {
      actors: counts.actors,
      organizations: counts.organizations,
      pools: counts.pools,
      characterMappings: StaticDataRegistry.getAllCharacterMappings().length,
      organizationMappings:
        StaticDataRegistry.getAllOrganizationMappings().length,
      rssFeedSources: counts.rssFeedSources,
      perpMarkets: counts.perpMarkets,
    };
  }
}

// Export convenience function for game tick
export async function bootstrapGameIfNeeded(): Promise<GameBootstrapResult | null> {
  return GameBootstrapService.bootstrapIfNeeded();
}
