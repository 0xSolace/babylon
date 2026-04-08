/**
 * SQL for `game-service`, `price-update-service`, `game-tick` widget caches,
 * `post-generation-helpers`, and `initial-investment-service` batch reads.
 *
 * **Why here:** wraps table helpers (`posts`, `questions`, `games`, `actorState`,
 * `stockPrices`, counts) with **`asSystem`** so engine paths avoid **`getDbInstance()`**.
 */

import { asSystem } from './db';
import {
  countAllActorStates,
  getActorStateById,
  listAllActorStates,
} from './tables/actor-state';
import {
  getContinuousGameState,
  listAllGamesByCreatedDesc,
} from './tables/games';
import { countAllOrganizationStates } from './tables/organization-state';
import {
  countAllPosts,
  createPostWithAllFields,
  getPostsByActor,
  getRecentPosts,
} from './tables/posts';
import {
  countActiveQuestions,
  countAllQuestions,
  getActiveQuestionsWithTimeframe,
} from './tables/questions';
import {
  getStockPriceHistory,
  recordStockPriceUpdate,
} from './tables/stock-prices';

export async function fetchRecentPostsForGameService(
  limit = 100,
  cursorOrOffset?: string | number
) {
  return asSystem(
    async (c) => getRecentPosts(c, limit, cursorOrOffset),
    'game-svc-recent-posts'
  );
}

export async function fetchPostsByActorForGameService(
  authorId: string,
  limit = 100,
  cursorOrOffset?: string | number
) {
  return asSystem(
    async (c) => getPostsByActor(c, authorId, limit, cursorOrOffset),
    'game-svc-posts-by-actor'
  );
}

export async function fetchActiveQuestionsForGameService(timeframe?: string) {
  return asSystem(
    async (c) => getActiveQuestionsWithTimeframe(c, timeframe),
    'game-svc-active-questions'
  );
}

export async function fetchGameServiceStats() {
  return asSystem(async (c) => {
    const [
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      gameState,
    ] = await Promise.all([
      countAllPosts(c),
      countAllQuestions(c),
      countActiveQuestions(c),
      countAllOrganizationStates(c),
      countAllActorStates(c),
      getContinuousGameState(c),
    ]);

    return {
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      currentDay: gameState?.currentDay ?? 1,
      isRunning: gameState?.isRunning || false,
    };
  }, 'game-svc-stats');
}

export async function listAllGamesForGameService() {
  return asSystem(
    async (c) => listAllGamesByCreatedDesc(c),
    'game-svc-all-games'
  );
}

export async function fetchContinuousGameStateForGameService() {
  return asSystem(
    async (c) => getContinuousGameState(c),
    'game-svc-continuous-state'
  );
}

export async function recordStockPriceUpdateAsSystem(
  organizationId: string,
  price: number,
  change: number,
  changePercent: number
) {
  return asSystem(
    async (c) =>
      recordStockPriceUpdate(c, organizationId, price, change, changePercent),
    'game-svc-stock-price-insert'
  );
}

export async function listAllActorStatesAsSystem() {
  return asSystem(
    async (c) => listAllActorStates(c),
    'game-svc-all-actor-states'
  );
}

export async function fetchActorStateRowAsSystem(actorId: string) {
  return asSystem(
    async (c) => getActorStateById(c, actorId),
    'game-svc-actor-state-by-id'
  );
}

export type CreatePostWithAllFieldsInput = Parameters<
  typeof createPostWithAllFields
>[1];

export async function createPostWithAllFieldsAsSystem(
  data: CreatePostWithAllFieldsInput
) {
  return asSystem(
    async (c) => createPostWithAllFields(c, data),
    'game-svc-create-post-full'
  );
}

export async function fetchStockPriceHistoryAsSystem(
  organizationId: string,
  limit = 1440
) {
  return asSystem(
    async (c) => getStockPriceHistory(c, organizationId, limit),
    'game-svc-stock-price-history'
  );
}
