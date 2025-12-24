/**
 * Participation Service
 *
 * @description Tracks off-chain user participation metrics including posts,
 * comments, shares, reactions, and market participation. Calculates total
 * activity scores and tracks last activity timestamps.
 */

import {
  and,
  comments,
  db,
  desc,
  eq,
  isNull,
  positions,
  posts,
  reactions,
  shares,
} from '@babylon/db'

/**
 * Participation statistics for a user
 *
 * @description Contains aggregated participation metrics including counts
 * for various activity types and last activity timestamp.
 */
export interface ParticipationStats {
  postsCreated: number
  commentsMade: number
  sharesMade: number
  reactionsGiven: number
  marketsParticipated: number
  totalActivity: number
  lastActivityAt: Date
}

/**
 * Get participation statistics for a user
 *
 * @description Retrieves comprehensive participation statistics for a user
 * including posts, comments, shares, reactions, and market participation.
 * Calculates total activity score and last activity timestamp.
 *
 * @param {string} userId - User ID to get stats for
 * @returns {Promise<ParticipationStats | null>} Participation stats or null if user not found
 */
export async function getParticipationStats(
  userId: string,
): Promise<ParticipationStats | null> {
  // Get all counts in parallel
  const [
    postsCountResults,
    commentsCountResults,
    sharesCountResults,
    reactionsCountResults,
    positionsCountResults,
    lastPostResults,
    lastCommentResults,
    lastShareResults,
    lastReactionResults,
    lastPositionResults,
  ] = await Promise.all([
    db.select().from(posts).where(eq(posts.authorId, userId)),
    db.select().from(comments).where(eq(comments.authorId, userId)),
    db.select().from(shares).where(eq(shares.userId, userId)),
    db.select().from(reactions).where(eq(reactions.userId, userId)),
    db.select().from(positions).where(eq(positions.userId, userId)),
    db
      .select({ createdAt: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(1),
    db
      .select({ createdAt: comments.createdAt })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(1),
    db
      .select({ createdAt: shares.createdAt })
      .from(shares)
      .where(eq(shares.userId, userId))
      .orderBy(desc(shares.createdAt))
      .limit(1),
    db
      .select({ createdAt: reactions.createdAt })
      .from(reactions)
      .where(eq(reactions.userId, userId))
      .orderBy(desc(reactions.createdAt))
      .limit(1),
    db
      .select({ createdAt: positions.createdAt })
      .from(positions)
      .where(eq(positions.userId, userId))
      .orderBy(desc(positions.createdAt))
      .limit(1),
  ])

  // Extract counts
  const postsCreated = postsCountResults.length
  const commentsMade = commentsCountResults.length
  const sharesMade = sharesCountResults.length
  const reactionsGiven = reactionsCountResults.length
  const marketsParticipated = positionsCountResults.length

  // Get last activity timestamps - query builder infers types from selected columns
  const lastPost = lastPostResults[0]
  const lastComment = lastCommentResults[0]
  const lastShare = lastShareResults[0]
  const lastReaction = lastReactionResults[0]
  const lastPosition = lastPositionResults[0]

  // Calculate total activity score
  // Weighted scoring: posts=10, comments=5, shares=3, reactions=1, markets=5
  const totalActivity =
    postsCreated * 10 +
    commentsMade * 5 +
    sharesMade * 3 +
    reactionsGiven * 1 +
    marketsParticipated * 5

  // Find the most recent activity timestamp
  const activityTimestamps = [
    lastPost?.createdAt,
    lastComment?.createdAt,
    lastShare?.createdAt,
    lastReaction?.createdAt,
    lastPosition?.createdAt,
  ].filter((date): date is Date => date !== null && date !== undefined)

  const lastActivityAt =
    activityTimestamps.length > 0
      ? new Date(Math.max(...activityTimestamps.map((d) => d.getTime())))
      : new Date() // Default to now if no activity

  return {
    postsCreated,
    commentsMade,
    sharesMade,
    reactionsGiven,
    marketsParticipated,
    totalActivity,
    lastActivityAt,
  }
}
