/**
 * SQL for narrative and stories feeds (optional-user RLS `db` client).
 */

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { arcStates } from './tables/arc-states';
import { markets } from './tables/markets';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';

type NarrativeFeedDb = DrizzleClient | Transaction;

export type NarrativeFeedRecentPostSlice = {
  id: string;
  content: string;
  authorId: string;
  timestamp: Date;
  type: string;
  articleTitle: string | null;
  fullContent: string | null;
  category: string | null;
  imageUrl: string | null;
  relatedQuestion: number | null;
  originalPostId: string | null;
};

export async function selectNarrativeFeedRecentPostSlices(
  db: NarrativeFeedDb,
  params: { cutoff: Date; now: Date; limit: number }
): Promise<NarrativeFeedRecentPostSlice[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      type: posts.type,
      articleTitle: posts.articleTitle,
      fullContent: posts.fullContent,
      category: posts.category,
      imageUrl: posts.imageUrl,
      relatedQuestion: posts.relatedQuestion,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.cutoff),
        lte(posts.timestamp, params.now),
        isNull(posts.commentOnPostId),
        isNull(posts.parentCommentId)
      )
    )
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export async function executeNarrativeFeedEngagementCounts(
  db: NarrativeFeedDb,
  postIds: string[]
): Promise<{
  reactionMap: Map<string, number>;
  commentMap: Map<string, number>;
  shareMap: Map<string, number>;
}> {
  const empty = {
    reactionMap: new Map<string, number>(),
    commentMap: new Map<string, number>(),
    shareMap: new Map<string, number>(),
  };
  if (postIds.length === 0) {
    return empty;
  }

  const postIdsArray = sql`ARRAY[${sql.join(
    postIds.map((id) => sql`${id}`),
    sql`, `
  )}]::text[]`;

  const engagementRows = await db.execute(sql`
        WITH
        target_posts AS (
          SELECT unnest(${postIdsArray}) AS post_id
        ),
        reaction_counts AS (
          SELECT r."postId" AS post_id, COUNT(*) AS count
          FROM "Reaction" r
          INNER JOIN target_posts tp ON r."postId" = tp.post_id
          WHERE r.type = 'like'
          GROUP BY r."postId"
        ),
        comment_counts AS (
          SELECT c."postId" AS post_id, COUNT(*) AS count
          FROM "Comment" c
          INNER JOIN target_posts tp ON c."postId" = tp.post_id
          WHERE c."deletedAt" IS NULL
          GROUP BY c."postId"
        ),
        share_counts AS (
          SELECT s."postId" AS post_id, COUNT(*) AS count
          FROM "Share" s
          INNER JOIN target_posts tp ON s."postId" = tp.post_id
          GROUP BY s."postId"
        )
        SELECT
          tp.post_id,
          COALESCE(rc.count, 0) AS like_count,
          COALESCE(cc.count, 0) AS comment_count,
          COALESCE(sc.count, 0) AS share_count
        FROM target_posts tp
        LEFT JOIN reaction_counts rc ON tp.post_id = rc.post_id
        LEFT JOIN comment_counts cc ON tp.post_id = cc.post_id
        LEFT JOIN share_counts sc ON tp.post_id = sc.post_id
      `);

  const reactionMap = new Map<string, number>();
  const commentMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  const engagementResultRows = Array.isArray(engagementRows)
    ? (engagementRows as Record<string, unknown>[])
    : [];
  for (const row of engagementResultRows) {
    const postId = String(row['post_id'] ?? '');
    if (!postId) continue;
    reactionMap.set(postId, Number(row['like_count'] ?? 0));
    commentMap.set(postId, Number(row['comment_count'] ?? 0));
    shareMap.set(postId, Number(row['share_count'] ?? 0));
  }

  return { reactionMap, commentMap, shareMap };
}

export type NarrativeFeedAuthorUserSlice = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectNarrativeFeedAuthorUsersByIds(
  db: NarrativeFeedDb,
  authorIds: string[]
): Promise<NarrativeFeedAuthorUserSlice[]> {
  if (authorIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(inArray(users.id, authorIds));
}

export type NarrativeOriginalPostRow = {
  id: string;
  content: string;
  authorId: string;
  timestamp: Date;
};

export async function selectNarrativeOriginalPostsByIds(
  db: NarrativeFeedDb,
  ids: string[]
): Promise<NarrativeOriginalPostRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(inArray(posts.id, ids));
}

export type NarrativeQuestionMetaRow = {
  questionNumber: number;
  text: string;
  status: string | null;
  arcState: string | null;
  resolutionDate: Date;
  topicKey: string | null;
  topicLabel: string | null;
};

export async function selectNarrativeQuestionMetaWithArc(
  db: NarrativeFeedDb,
  questionNumbers: number[]
): Promise<NarrativeQuestionMetaRow[]> {
  if (questionNumbers.length === 0) {
    return [];
  }
  return db
    .select({
      questionNumber: questions.questionNumber,
      text: questions.text,
      status: questions.status,
      arcState: arcStates.currentState,
      resolutionDate: questions.resolutionDate,
      topicKey: questions.topicKey,
      topicLabel: questions.topicLabel,
    })
    .from(questions)
    .leftJoin(arcStates, eq(arcStates.questionId, questions.id))
    .where(inArray(questions.questionNumber, questionNumbers));
}

export type NarrativeQuestionMarketRow = {
  questionNumber: number;
  marketId: string;
};

export async function selectNarrativeQuestionMarketIdsInnerJoin(
  db: NarrativeFeedDb,
  questionNumbers: number[]
): Promise<NarrativeQuestionMarketRow[]> {
  if (questionNumbers.length === 0) {
    return [];
  }
  return db
    .select({
      questionNumber: questions.questionNumber,
      marketId: markets.id,
    })
    .from(questions)
    .innerJoin(
      markets,
      sql`lower(trim(${markets.question})) = lower(trim(${questions.text}))`
    )
    .where(inArray(questions.questionNumber, questionNumbers));
}

export type NarrativeQuestionMarketWithSharesRow = {
  questionNumber: number;
  marketId: string;
  yesShares: string | null;
  noShares: string | null;
};

export async function selectNarrativeQuestionMarketRowsWithSharesInnerJoin(
  db: NarrativeFeedDb,
  questionNumbers: number[]
): Promise<NarrativeQuestionMarketWithSharesRow[]> {
  if (questionNumbers.length === 0) {
    return [];
  }
  return db
    .select({
      questionNumber: questions.questionNumber,
      marketId: markets.id,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(questions)
    .innerJoin(
      markets,
      sql`lower(trim(${markets.question})) = lower(trim(${questions.text}))`
    )
    .where(inArray(questions.questionNumber, questionNumbers));
}

export type NarrativeNewMarketCardRow = {
  questionNumber: number;
  text: string;
  resolutionDate: Date;
  createdAt: Date;
  arcState: string | null;
  marketId: string | null;
  yesShares: string | null;
  noShares: string | null;
  topicKey: string | null;
  topicLabel: string | null;
};

export async function selectNarrativeNewMarketCardRows(
  db: NarrativeFeedDb,
  params: {
    newMarketCutoff: Date;
    resolutionHorizon: Date;
    existingQuestionNumbers: number[];
    limit: number;
  }
): Promise<NarrativeNewMarketCardRow[]> {
  const notInNumbers =
    params.existingQuestionNumbers.length > 0
      ? params.existingQuestionNumbers
      : [-1];

  return db
    .select({
      questionNumber: questions.questionNumber,
      text: questions.text,
      resolutionDate: questions.resolutionDate,
      createdAt: questions.createdAt,
      arcState: arcStates.currentState,
      marketId: markets.id,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
      topicKey: questions.topicKey,
      topicLabel: questions.topicLabel,
    })
    .from(questions)
    .leftJoin(arcStates, eq(arcStates.questionId, questions.id))
    .leftJoin(
      markets,
      sql`lower(trim(${markets.question})) = lower(trim(${questions.text}))`
    )
    .where(
      and(
        eq(questions.status, 'active'),
        gte(questions.createdAt, params.newMarketCutoff),
        lt(questions.resolutionDate, params.resolutionHorizon),
        not(inArray(questions.questionNumber, notInNumbers))
      )
    )
    .orderBy(desc(questions.createdAt))
    .limit(params.limit);
}

/** Posts linked to questions with a given topicKey in [backfillCutoff, primaryCutoff). */
export async function selectStoriesTopicLinkedBackfillPosts(
  db: NarrativeFeedDb,
  params: {
    backfillCutoff: Date;
    primaryCutoff: Date;
    topicKey: string;
    limit: number;
  }
): Promise<NarrativeFeedRecentPostSlice[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      type: posts.type,
      articleTitle: posts.articleTitle,
      fullContent: posts.fullContent,
      category: posts.category,
      imageUrl: posts.imageUrl,
      relatedQuestion: posts.relatedQuestion,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .innerJoin(questions, eq(posts.relatedQuestion, questions.questionNumber))
    .where(
      and(
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.backfillCutoff),
        lt(posts.timestamp, params.primaryCutoff),
        isNull(posts.commentOnPostId),
        isNull(posts.parentCommentId),
        eq(questions.topicKey, params.topicKey)
      )
    )
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

/** Standalone posts (no relatedQuestion) in [backfillCutoff, primaryCutoff) for topic text filtering. */
export async function selectStoriesStandaloneBackfillCandidates(
  db: NarrativeFeedDb,
  params: {
    backfillCutoff: Date;
    primaryCutoff: Date;
    limit: number;
  }
): Promise<NarrativeFeedRecentPostSlice[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      type: posts.type,
      articleTitle: posts.articleTitle,
      fullContent: posts.fullContent,
      category: posts.category,
      imageUrl: posts.imageUrl,
      relatedQuestion: posts.relatedQuestion,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.backfillCutoff),
        lt(posts.timestamp, params.primaryCutoff),
        isNull(posts.commentOnPostId),
        isNull(posts.parentCommentId),
        isNull(posts.relatedQuestion)
      )
    )
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export async function selectNarrativeUserLikedPostIds(
  db: NarrativeFeedDb,
  params: { userId: string; postIds: string[] }
): Promise<{ postId: string | null }[]> {
  if (params.postIds.length === 0) {
    return [];
  }
  return db
    .select({ postId: reactions.postId })
    .from(reactions)
    .where(
      and(
        inArray(reactions.postId, params.postIds),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    );
}

export async function selectNarrativeUserSharedPostIds(
  db: NarrativeFeedDb,
  params: { userId: string; postIds: string[] }
): Promise<{ postId: string | null }[]> {
  if (params.postIds.length === 0) {
    return [];
  }
  return db
    .select({ postId: shares.postId })
    .from(shares)
    .where(
      and(
        inArray(shares.postId, params.postIds),
        eq(shares.userId, params.userId)
      )
    );
}

export async function selectNarrativeUserActivePositionQuestionIds(
  db: NarrativeFeedDb,
  params: { userId: string; questionNumbers: number[] }
): Promise<{ questionId: number | null }[]> {
  if (params.questionNumbers.length === 0) {
    return [];
  }
  return db
    .select({ questionId: positions.questionId })
    .from(positions)
    .where(
      and(
        eq(positions.userId, params.userId),
        eq(positions.status, 'active'),
        isNotNull(positions.questionId),
        inArray(positions.questionId, params.questionNumbers)
      )
    );
}
