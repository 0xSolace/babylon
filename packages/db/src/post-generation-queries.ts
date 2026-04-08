/**
 * Reads/writes for `post-generation-helpers` (shared feed slice, discourse, pool positions).
 *
 * **Why here:** game tick / lookahead share one pre-fetch; SQL runs under **`asSystem`**.
 */

import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { asSystem } from './db';
import { npcInteractions } from './tables/npc-interactions';
import { poolPositions } from './tables/pool-positions';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export type PostGenerationSharedPostRow = typeof posts.$inferSelect;
export type PostGenerationSharedWorldEventRow = typeof worldEvents.$inferSelect;

export async function fetchSharedPostGenerationContextAsSystem(
  asOf: Date
): Promise<{
  recentPostsRaw: PostGenerationSharedPostRow[];
  recentEventsRaw: PostGenerationSharedWorldEventRow[];
}> {
  const twelveHoursAgo = new Date(asOf.getTime() - 12 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(asOf.getTime() - 3 * 24 * 60 * 60 * 1000);

  return asSystem(async (c) => {
    const [recentPostsRaw, recentEventsRaw] = await Promise.all([
      c
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.type, 'post'),
            gte(posts.timestamp, twelveHoursAgo),
            lte(posts.timestamp, asOf),
            isNull(posts.deletedAt)
          )
        )
        .orderBy(desc(posts.timestamp))
        .limit(50),
      c
        .select()
        .from(worldEvents)
        .where(
          and(
            gte(worldEvents.timestamp, threeDaysAgo),
            lte(worldEvents.timestamp, asOf),
            eq(worldEvents.visibility, 'public')
          )
        )
        .orderBy(desc(worldEvents.timestamp))
        .limit(100),
    ]);
    return { recentPostsRaw, recentEventsRaw };
  }, 'post-gen-shared-context');
}

export type PostGenPoolPositionSlice = {
  ticker: string | null;
  side: string;
  unrealizedPnL: number;
};

export async function listOpenPoolPositionSlicesForPostGenNpcAsSystem(
  npcId: string,
  limit: number
): Promise<PostGenPoolPositionSlice[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          ticker: poolPositions.ticker,
          side: poolPositions.side,
          unrealizedPnL: poolPositions.unrealizedPnL,
        })
        .from(poolPositions)
        .where(
          and(eq(poolPositions.poolId, npcId), isNull(poolPositions.closedAt))
        )
        .limit(limit),
    'post-gen-npc-positions'
  );
}

/** Recent posts from NPC authors for threaded discourse (reply/quote generation). */
export type PostGenDiscourseCandidatePostRow = {
  id: string;
  content: string;
  authorId: string;
  timestamp: Date;
  commentOnPostId: string | null;
  originalPostId: string | null;
  relatedQuestion: number | null;
  type: string;
};

export async function listRecentPostsByNpcAuthorsForDiscourseAsSystem(
  authorIds: string[],
  take: number
): Promise<PostGenDiscourseCandidatePostRow[]> {
  if (authorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: posts.id,
          content: posts.content,
          authorId: posts.authorId,
          timestamp: posts.timestamp,
          commentOnPostId: posts.commentOnPostId,
          originalPostId: posts.originalPostId,
          relatedQuestion: posts.relatedQuestion,
          type: posts.type,
        })
        .from(posts)
        .where(and(inArray(posts.authorId, authorIds), isNull(posts.deletedAt)))
        .orderBy(desc(posts.timestamp))
        .limit(take),
    'post-gen-discourse-recent-posts'
  );
}

export type PostGenPairInteractionRow = {
  actor1Id: string;
  actor2Id: string;
  interactionType: string;
  context: string;
  timestamp: Date;
};

export async function listRecentNpcInteractionsBetweenActorsForPostGenAsSystem(
  actorId: string,
  otherActorId: string,
  since: Date,
  take: number
): Promise<PostGenPairInteractionRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          actor1Id: npcInteractions.actor1Id,
          actor2Id: npcInteractions.actor2Id,
          interactionType: npcInteractions.interactionType,
          context: npcInteractions.context,
          timestamp: npcInteractions.timestamp,
        })
        .from(npcInteractions)
        .where(
          and(
            gte(npcInteractions.timestamp, since),
            or(
              and(
                eq(npcInteractions.actor1Id, actorId),
                eq(npcInteractions.actor2Id, otherActorId)
              ),
              and(
                eq(npcInteractions.actor1Id, otherActorId),
                eq(npcInteractions.actor2Id, actorId)
              )
            )
          )
        )
        .orderBy(desc(npcInteractions.timestamp))
        .limit(take),
    'post-gen-discourse-pair-interactions'
  );
}

export type PostGenQuestionArcRow = {
  id: string;
  text: string;
  outcome: boolean;
};

export async function fetchQuestionByNumberForPostGenDiscourseAsSystem(
  questionNumber: number
): Promise<PostGenQuestionArcRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: questions.id,
        text: questions.text,
        outcome: questions.outcome,
      })
      .from(questions)
      .where(eq(questions.questionNumber, questionNumber))
      .limit(1);
    return row;
  }, 'post-gen-discourse-question');
}
