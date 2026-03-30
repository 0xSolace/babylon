import {
  and,
  db,
  gte,
  isNull,
  lt,
  posts,
  sql,
} from '@babylon/db';
import { logger } from '@babylon/shared';

const POST_INTERACTION_COUNTS_VIEW = 'mv_post_interaction_counts';

export interface ForYouCandidatePost {
  id: string;
  content: string;
  authorId: string;
  timestamp: Date;
  type: string | null;
  articleTitle: string | null;
  fullContent: string | null;
  category: string | null;
  imageUrl: string | null;
  relatedQuestion: number | null;
  originalPostId: string | null;
}

const forYouCandidatePostSelection = {
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
};

function isMissingPostInteractionCountsViewError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error ?? '');
  const normalizedMessage = message.toLowerCase();
  const code =
    (error as { cause?: { code?: string } } | null)?.cause?.code ??
    (error as { code?: string } | null)?.code;

  return (
    normalizedMessage.includes(POST_INTERACTION_COUNTS_VIEW) &&
    (code === '42P01' || normalizedMessage.includes('does not exist'))
  );
}

const liveEngagementOrder = sql`
  (
    (SELECT COUNT(*)
     FROM "Reaction" r
     WHERE r."postId" = ${posts.id}
       AND r.type = 'like') +
    (SELECT COUNT(*)
     FROM "Comment" c
     WHERE c."postId" = ${posts.id}
       AND c."deletedAt" IS NULL) * 2 +
    (SELECT COUNT(*)
     FROM "Share" s
     WHERE s."postId" = ${posts.id}) * 3
  ) DESC
`;

export async function loadHistoricalForYouBackfillPosts(
  backfillCutoff: Date,
  cutoff: Date,
  backfillCapacity: number
): Promise<ForYouCandidatePost[]> {
  if (backfillCapacity <= 0) {
    return [];
  }

  const backfillWhere = and(
    isNull(posts.deletedAt),
    gte(posts.timestamp, backfillCutoff),
    lt(posts.timestamp, cutoff),
    isNull(posts.commentOnPostId),
    isNull(posts.parentCommentId)
  );

  try {
    return await db
      .select(forYouCandidatePostSelection)
      .from(posts)
      .where(backfillWhere)
      .orderBy(
        sql`(SELECT COALESCE(mic.engagement_score, 0)
             FROM mv_post_interaction_counts mic
             WHERE mic.post_id = ${posts.id}) DESC`
      )
      .limit(backfillCapacity);
  } catch (error) {
    if (!isMissingPostInteractionCountsViewError(error)) {
      throw error;
    }

    logger.warn(
      'mv_post_interaction_counts missing; falling back to live engagement ordering for For You backfill',
      {
        error:
          error instanceof Error
            ? error.message
            : String(
                (error as { message?: unknown } | null)?.message ?? error
              ),
      },
      'ForYouPipeline'
    );

    return db
      .select(forYouCandidatePostSelection)
      .from(posts)
      .where(backfillWhere)
      .orderBy(liveEngagementOrder)
      .limit(backfillCapacity);
  }
}
