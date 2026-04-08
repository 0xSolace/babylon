/**
 * Enhanced Registry API
 *
 * @route GET /api/registry/all - Get all registry entities
 * @access Public (optional authentication for RLS)
 *
 * @description
 * Fetches ALL entities from the ERC8004 registry and database including users,
 * actors (NPCs), agents (from Agent0 network), and apps (game platforms).
 *
 * **Important:** When searching with type='users', the API also returns actors
 * (AI NPCs from static assets). This merges static actor data with human users
 * for a unified search experience.
 *
 * @openapi
 * /api/registry/all:
 *   get:
 *     tags:
 *       - Registry
 *     summary: Get all registry entities
 *     description: Returns all entities from ERC8004 registry and database (optional auth for RLS)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: Entities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                 actors:
 *                   type: array
 *                 agents:
 *                   type: array
 *                 apps:
 *                   type: array
 *       401:
 *         description: Unauthorized (optional)
 *
 * @example
 * ```typescript
 * const { users, actors, agents } = await fetch('/api/registry/all')
 *   .then(r => r.json());
 * ```
 */

import {
  type AgentSummary,
  getAgent0SDK,
  type SearchFilters,
} from '@babylon/agents';
import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  type DrizzleClient,
  selectActorFollowerCountRowsGroupedByFollowingId,
  selectActorFollowingCountRowsGroupedByFollowerId,
  selectAgentPerformanceMetricsRowsForUserIds,
  selectAllActorStateRows,
  selectCommentCountRowsGroupedByAuthorId,
  selectFollowerCountRowsGroupedByFollowingId,
  selectFollowingCountRowsGroupedByFollowerId,
  selectNpcTradeCountRowsGroupedByNpcActorId,
  selectPoolCountRowsGroupedByNpcActorId,
  selectPositionCountRowsGroupedByUserId,
  selectReactionCountRowsGroupedByUserId,
  selectUsersForRegistryAllList,
} from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { countMap } from '@/lib/db/grouped-count-map';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

function parseAgent0TokenId(agentId: string): number {
  const tokenIdPart = agentId.split(':')[1];
  const parsed = tokenIdPart ? Number.parseInt(tokenIdPart, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapAgent0SummaryToEntity(
  summary: AgentSummary,
  entityType: 'agent' | 'app'
): Record<string, unknown> {
  const tokenId = parseAgent0TokenId(summary.agentId);
  return {
    type: entityType,
    id: `${entityType}-${tokenId}`,
    tokenId,
    name: summary.name,
    description: summary.description,
    imageUrl: summary.image,
    walletAddress: summary.walletAddress,
    metadataCID: summary.agentURI,
    mcpEndpoint: summary.mcp,
    a2aEndpoint: summary.a2a,
    capabilities: {
      supportedTrusts: summary.supportedTrusts,
      a2aSkills: summary.a2aSkills,
      mcpTools: summary.mcpTools,
      mcpPrompts: summary.mcpPrompts,
      mcpResources: summary.mcpResources,
      oasfSkills: summary.oasfSkills,
      oasfDomains: summary.oasfDomains,
      x402support: summary.x402support,
    },
    reputationScore: summary.averageValue,
    totalFeedbackCount: summary.feedbackCount,
  };
}

/**
 * GET /api/registry/all
 * Fetch all registry entities: users, actors, agents, and apps
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('type'); // 'users' | 'actors' | 'agents' | 'apps' | 'all'
  const search = searchParams.get('search') || '';
  const onChainOnly = searchParams.get('onChainOnly') === 'true';

  const {
    error,
    rateLimitInfo,
    user: authUser,
  } = await publicRateLimit(request);
  if (error) return error;

  // Fetch users from database
  const fetchUsers = async () => {
    const dbOperation = async (db: DrizzleClient) => {
      const userRows = await selectUsersForRegistryAllList(db, {
        onChainOnly,
        search,
        limit: 100,
      });

      const userIds = userRows.map((u) => u.id);
      if (userIds.length === 0) {
        return [];
      }

      const [
        metricsResults,
        positionRows,
        commentRows,
        reactionRows,
        followerRows,
        followingRows,
      ] = await Promise.all([
        selectAgentPerformanceMetricsRowsForUserIds(db, userIds),
        selectPositionCountRowsGroupedByUserId(db, userIds),
        selectCommentCountRowsGroupedByAuthorId(db, userIds),
        selectReactionCountRowsGroupedByUserId(db, userIds),
        selectFollowerCountRowsGroupedByFollowingId(db, userIds),
        selectFollowingCountRowsGroupedByFollowerId(db, userIds),
      ]);

      const metricsMap = new Map(metricsResults.map((m) => [m.userId, m]));
      const positionMap = countMap(positionRows, 'userId');
      const commentMap = countMap(commentRows, 'userId');
      const reactionMap = countMap(reactionRows, 'userId');
      const followerMap = countMap(followerRows, 'userId');
      const followingMap = countMap(followingRows, 'userId');

      return userRows.map((user) => {
        const metrics = metricsMap.get(user.id);
        const compositeScore = metrics?.reputationScore ?? 0;
        const averageFeedbackScore = metrics?.averageFeedbackScore ?? 0;
        const totalFeedbackCount = metrics?.totalFeedbackCount ?? 0;

        return {
          type: 'user',
          id: user.id,
          name: user.displayName || user.username || 'Unknown',
          username: user.username,
          bio: user.bio,
          imageUrl: user.profileImageUrl,
          walletAddress: user.walletAddress,
          isActor: user.isActor,
          isBanned: user.isBanned,
          isScammer: user.isScammer,
          isCSAM: user.isCSAM,
          onChainRegistered: user.onChainRegistered,
          nftTokenId: user.nftTokenId,
          agent0TokenId: user.agent0TokenId,
          agent0MetadataCID: user.agent0MetadataCID,
          registrationTxHash: user.registrationTxHash,
          registrationTimestamp: user.registrationTimestamp,
          createdAt: user.createdAt,
          balance: user.virtualBalance.toString(),
          reputationPoints: Math.round(compositeScore),
          reputationScore: compositeScore,
          trustLevel: metrics?.trustLevel ?? 'UNRATED',
          onChainTrustScore: metrics?.onChainTrustScore ?? null,
          onChainAccuracyScore: metrics?.onChainAccuracyScore ?? null,
          averageFeedbackScore,
          totalFeedbackCount,
          stats: {
            positions: positionMap.get(user.id) ?? 0,
            comments: commentMap.get(user.id) ?? 0,
            reactions: reactionMap.get(user.id) ?? 0,
            followers: followerMap.get(user.id) ?? 0,
            following: followingMap.get(user.id) ?? 0,
          },
        };
      });
    };

    return await runWithOptionalUserRls(authUser, dbOperation);
  };

  const fetchActors = async () => {
    const dbOperation = async (db: DrizzleClient) => {
      // Get all static actors
      let actors = StaticDataRegistry.getAllActors();

      // Filter by search if provided
      if (search) {
        const searchLower = search.toLowerCase();
        actors = actors.filter(
          (a) =>
            a.name.toLowerCase().includes(searchLower) ||
            a.description?.toLowerCase().includes(searchLower) ||
            a.role?.toLowerCase().includes(searchLower)
        );
      }

      const actorStates = await selectAllActorStateRows(db);
      const stateMap = new Map(actorStates.map((s) => [s.id, s]));

      // Sort by reputationPoints (from state) and take top 100
      actors = actors
        .sort((a, b) => {
          const stateA = stateMap.get(a.id);
          const stateB = stateMap.get(b.id);
          return (
            (stateB?.reputationPoints ?? 0) - (stateA?.reputationPoints ?? 0)
          );
        })
        .slice(0, 100);

      const actorIds = actors.map((a) => a.id);

      let poolMap = new Map<string, number>();
      let tradeMap = new Map<string, number>();
      let actorFollowersMap = new Map<string, number>();
      let actorFollowingMap = new Map<string, number>();

      if (actorIds.length > 0) {
        const [poolRows, tradeRows, followersRows, followingRows] =
          await Promise.all([
            selectPoolCountRowsGroupedByNpcActorId(db, actorIds),
            selectNpcTradeCountRowsGroupedByNpcActorId(db, actorIds),
            selectActorFollowerCountRowsGroupedByFollowingId(db, actorIds),
            selectActorFollowingCountRowsGroupedByFollowerId(db, actorIds),
          ]);

        poolMap = countMap(poolRows, 'npcActorId');
        tradeMap = countMap(tradeRows, 'npcActorId');
        actorFollowersMap = countMap(followersRows, 'actorId');
        actorFollowingMap = countMap(followingRows, 'actorId');
      }

      return actors.map((actor) => {
        const state = stateMap.get(actor.id);
        return {
          type: 'actor',
          id: actor.id,
          name: actor.name,
          description: actor.description,
          imageUrl: actor.profileImageUrl,
          domain: actor.domain,
          personality: actor.personality,
          tier: actor.tier,
          role: actor.role,
          balance: state?.tradingBalance?.toString() ?? '10000',
          reputationPoints: state?.reputationPoints ?? 10000,
          createdAt: state?.createdAt ?? new Date(),
          stats: {
            pools: poolMap.get(actor.id) ?? 0,
            trades: tradeMap.get(actor.id) ?? 0,
            followers: actorFollowersMap.get(actor.id) ?? 0,
            following: actorFollowingMap.get(actor.id) ?? 0,
          },
        };
      });
    };

    return await runWithOptionalUserRls(authUser, dbOperation);
  };

  const fetchAgents = async () => {
    if (process.env.AGENT0_ENABLED !== 'true') return [];

    const sdk = getAgent0SDK();
    const filters: SearchFilters = {
      keyword: search || undefined,
      metadataValue: { key: 'userType', value: 'agent' },
      active: onChainOnly ? true : undefined,
    };

    const results = await sdk.searchAgents(filters);
    return results
      .slice(0, 100)
      .map((agent: AgentSummary) => mapAgent0SummaryToEntity(agent, 'agent'));
  };

  const fetchApps = async () => {
    if (process.env.AGENT0_ENABLED !== 'true') return [];

    const sdk = getAgent0SDK();
    const filters: SearchFilters = {
      keyword: search || undefined,
      metadataValue: { key: 'type', value: 'game-platform' },
      active: onChainOnly ? true : undefined,
    };

    const results = await sdk.searchAgents(filters);
    return results
      .slice(0, 100)
      .map((app: AgentSummary) => mapAgent0SummaryToEntity(app, 'app'));
  };

  // Fetch based on entity type
  // Note: When searching for 'users', we also include static actors (AI NPCs)
  // since they are no longer in the database but should appear in user searches
  let users: Awaited<ReturnType<typeof fetchUsers>> = [];
  let actors: Awaited<ReturnType<typeof fetchActors>> = [];
  let agents: Awaited<ReturnType<typeof fetchAgents>> = [];
  let apps: Awaited<ReturnType<typeof fetchApps>> = [];

  if (!entityType || entityType === 'all' || entityType === 'users') {
    users = await fetchUsers();
    // Also fetch actors when searching for users - AI NPCs should appear in user searches
    actors = await fetchActors();
  }
  if (entityType === 'actors') {
    // Only fetch actors when explicitly requested
    actors = await fetchActors();
  }
  if (!entityType || entityType === 'all' || entityType === 'agents') {
    agents = await fetchAgents().catch((error) => {
      logger.warn(
        'Agent0 agent search failed',
        { error: error instanceof Error ? error.message : String(error) },
        'GET /api/registry/all'
      );
      return [];
    });
  }
  if (!entityType || entityType === 'all' || entityType === 'apps') {
    apps = await fetchApps().catch((error) => {
      logger.warn(
        'Agent0 app search failed',
        { error: error instanceof Error ? error.message : String(error) },
        'GET /api/registry/all'
      );
      return [];
    });
  }

  const result = {
    users,
    actors,
    agents,
    apps,
    totals: {
      users: users.length,
      actors: actors.length,
      agents: agents.length,
      apps: apps.length,
      total: users.length + actors.length + agents.length + apps.length,
    },
  };

  logger.info(
    'Registry fetched successfully',
    result.totals,
    'GET /api/registry/all'
  );

  const res = successResponse(result);
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
