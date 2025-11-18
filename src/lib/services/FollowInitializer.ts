/**
 * Follow Initializer Service
 *
 * Initializes all NPC-to-NPC follow relationships from relationship data.
 * Ensures all actors have appropriate follower counts based on their tier.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { shuffleArray } from '@/lib/utils/randomization';
import { existsSync, readFileSync } from 'node:fs';
import { RelationshipManager } from './RelationshipManager';

export type RelationshipData = {
  actor1Id: string;
  actor2Id: string;
  relationshipType: string;
  strength: number;
  sentiment: number;
  history: string;
  actor1FollowsActor2: boolean;
  actor2FollowsActor1: boolean;
};

export type VerificationReport = {
  totalActors: number;
  actorsWithFollowers: number;
  actorsWithoutFollowers: number;
  actorsMissingFollowers: string[];
  followerCountByTier: Record<string, { min: number; max: number; avg: number }>;
};

export class FollowInitializer {
  /**
   * Initialize all actor follows from relationships
   */
  static async initializeActorFollows(): Promise<void> {
    logger.info('Initializing actor follow relationships...', undefined, 'FollowInitializer');

    // Check if follows already exist
    const existingCount = await prisma.actorFollow.count();

    if (existingCount > 0) {
      logger.info(
        `${existingCount} follow relationships already exist`,
        { count: existingCount },
        'FollowInitializer'
      );
      return;
    }

    // Load relationships from database
    logger.info('Loading relationships from database...', undefined, 'FollowInitializer');
    const relationships = await prisma.actorRelationship.findMany();

    logger.info(
      `Found ${relationships.length} relationships to process`,
      { count: relationships.length },
      'FollowInitializer'
    );

    // Create follows based on relationship type and sentiment
    let followsCreated = 0;
    const total = relationships.length;

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      if (!rel) continue;

      // Log progress every 10 relationships
      if (i > 0 && i % 10 === 0) {
        logger.info(
          `Progress: ${i}/${total} relationships processed`,
          { progress: i, total },
          'FollowInitializer'
        );
      }

      const shouldFollowEachOther = FollowInitializer.determineFollowDirection(
        rel.relationshipType,
        rel.sentiment,
        rel.strength
      );

      if (shouldFollowEachOther.actor1FollowsActor2) {
        await FollowInitializer.createFollow(
          rel.actor1Id,
          rel.actor2Id,
          shouldFollowEachOther.isMutual
        );
        followsCreated++;
      }

      if (shouldFollowEachOther.actor2FollowsActor1) {
        await FollowInitializer.createFollow(
          rel.actor2Id,
          rel.actor1Id,
          shouldFollowEachOther.isMutual
        );
        followsCreated++;
      }
    }

    logger.info(
      `✅ Created ${followsCreated} follow relationships`,
      { count: followsCreated },
      'FollowInitializer'
    );

    // Verify and fix actors with no followers
    logger.info('Verifying all actors have followers...', undefined, 'FollowInitializer');
    await FollowInitializer.ensureMinimumFollowers(2);
  }

  /**
   * Load relationships from JSON file and initialize
   */
  static async loadAndInitialize(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Relationship file not found: ${filePath}`);
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    let relationships: RelationshipData[];
    try {
      relationships = JSON.parse(fileContent) as RelationshipData[];
    } catch (error) {
      logger.error('Failed to parse relationships JSON', { error, filePath }, 'FollowInitializer');
      throw new Error(`Invalid JSON in relationships file: ${filePath}`);
    }

    logger.info(
      `Loaded ${relationships.length} relationships from ${filePath}`,
      { count: relationships.length, filePath },
      'FollowInitializer'
    );

    // Import relationships to database first
    await FollowInitializer.importRelationships(relationships);

    // Create follow relationships
    await FollowInitializer.createFollows(relationships);

    // Verify
    const verification = await FollowInitializer.verifyFollowerCounts();
    logger.info('Follower verification complete', verification, 'FollowInitializer');
  }

  /**
   * Import relationships to database
   */
  static async importRelationships(relationships: RelationshipData[]): Promise<void> {
    logger.info('Importing relationships to database...', undefined, 'FollowInitializer');

    const total = relationships.length;
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      if (!rel) continue;

      // Log progress every 20 relationships
      if (i > 0 && i % 20 === 0) {
        logger.info(`Import progress: ${i}/${total}`, { progress: i, total }, 'FollowInitializer');
      }

      await prisma.actorRelationship.upsert({
        where: {
          actor1Id_actor2Id: {
            actor1Id: rel.actor1Id,
            actor2Id: rel.actor2Id,
          },
        },
        update: {},
        create: {
          id: await generateSnowflakeId(),
          actor1Id: rel.actor1Id,
          actor2Id: rel.actor2Id,
          relationshipType: rel.relationshipType,
          strength: rel.strength,
          sentiment: rel.sentiment,
          history: rel.history,
          isPublic: true,
          updatedAt: new Date(),
        },
      });
    }

    logger.info(
      `✅ Imported ${relationships.length} relationships`,
      { count: relationships.length },
      'FollowInitializer'
    );
  }

  /**
   * Create ActorFollow records from relationship data
   */
  static async createFollows(relationships: RelationshipData[]): Promise<void> {
    logger.info('Creating follow relationships...', undefined, 'FollowInitializer');

    let followCount = 0;
    const total = relationships.length;

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      if (!rel) continue;

      // Log progress every 20 relationships
      if (i > 0 && i % 20 === 0) {
        logger.info(
          `Follow creation progress: ${i}/${total}`,
          { progress: i, total },
          'FollowInitializer'
        );
      }

      if (rel.actor1FollowsActor2) {
        await FollowInitializer.createFollow(rel.actor1Id, rel.actor2Id, rel.actor2FollowsActor1);
        followCount++;
      }

      if (rel.actor2FollowsActor1) {
        await FollowInitializer.createFollow(rel.actor2Id, rel.actor1Id, rel.actor1FollowsActor2);
        followCount++;
      }
    }

    logger.info(
      `✅ Created ${followCount} follow relationships`,
      { count: followCount },
      'FollowInitializer'
    );
  }

  /**
   * Verify all actors have minimum follower count
   */
  static async verifyFollowerCounts(): Promise<VerificationReport> {
    const actors = await prisma.actor.findMany({
      include: {
        ActorFollow_ActorFollow_followingIdToActor: true,
      },
    });

    const actorsWithoutFollowers = actors.filter(
      (a) => a.ActorFollow_ActorFollow_followingIdToActor.length === 0
    );

    // Calculate stats by tier
    const tierStats: Record<string, { counts: number[]; min: number; max: number; avg: number }> =
      {};

    actors.forEach((actor) => {
      const tier = actor.tier || 'UNKNOWN';
      if (!tierStats[tier]) {
        tierStats[tier] = { counts: [], min: 0, max: 0, avg: 0 };
      }
      tierStats[tier].counts.push(actor.ActorFollow_ActorFollow_followingIdToActor.length);
    });

    Object.keys(tierStats).forEach((tier) => {
      const stats = tierStats[tier];
      if (!stats) return;

      const counts = stats.counts;
      stats.min = Math.min(...counts);
      stats.max = Math.max(...counts);
      stats.avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    });

    const followerCountByTier: Record<string, { min: number; max: number; avg: number }> = {};
    Object.keys(tierStats).forEach((tier) => {
      const stats = tierStats[tier];
      if (!stats) return;

      followerCountByTier[tier] = {
        min: stats.min,
        max: stats.max,
        avg: Math.round(stats.avg * 10) / 10,
      };
    });

    return {
      totalActors: actors.length,
      actorsWithFollowers: actors.length - actorsWithoutFollowers.length,
      actorsWithoutFollowers: actorsWithoutFollowers.length,
      actorsMissingFollowers: actorsWithoutFollowers.map((a) => a.name),
      followerCountByTier,
    };
  }

  /**
   * Ensure all actors have at least minimum followers
   */
  static async ensureMinimumFollowers(minFollowers: number): Promise<void> {
    logger.info('Checking for actors with no followers...', undefined, 'FollowInitializer');

    const actorsWithNoFollowers = await RelationshipManager.getActorsWithNoFollowers();

    if (actorsWithNoFollowers.length === 0) {
      logger.info('✅ All actors have followers', undefined, 'FollowInitializer');
      return;
    }

    logger.info(
      `Found ${actorsWithNoFollowers.length} actors with no followers, fixing...`,
      { count: actorsWithNoFollowers.length },
      'FollowInitializer'
    );

    // Get all C_TIER actors as potential followers
    const allActors = await prisma.actor.findMany();
    const cTierActors = allActors.filter((a) => a.tier === 'C_TIER');

    if (cTierActors.length === 0) {
      logger.warn('No C_TIER actors found to use as followers', undefined, 'FollowInitializer');
      return;
    }

    let followsAdded = 0;
    for (const actor of actorsWithNoFollowers) {
      logger.info(`Processing ${actor.name}...`, { actorId: actor.id }, 'FollowInitializer');

      // Select random followers
      const randomFollowers = shuffleArray(cTierActors)
        .filter((f) => f.id !== actor.id)
        .slice(0, minFollowers);

      for (const follower of randomFollowers) {
        try {
          await FollowInitializer.createFollow(follower.id, actor.id, false);
          followsAdded++;
        } catch (error) {
          logger.error(
            `Failed to create follow: ${follower.id} -> ${actor.id}`,
            { error },
            'FollowInitializer'
          );
        }
      }

      logger.info(
        `✅ Added ${randomFollowers.length} followers for ${actor.name}`,
        { actorName: actor.name, count: randomFollowers.length },
        'FollowInitializer'
      );
    }

    logger.info(
      `Total follows added: ${followsAdded}`,
      { count: followsAdded },
      'FollowInitializer'
    );
  }
}
