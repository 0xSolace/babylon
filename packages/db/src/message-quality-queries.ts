/**
 * Recent user content for duplicate detection and quality aggregates.
 *
 * **Why here:** `comments` / `messages` / `UserInteraction` SQL for
 * `MessageQualityChecker` lives in one place.
 */

import { desc, eq } from 'drizzle-orm';
import { asSystem } from './db';
import { comments } from './tables/comments';
import { messages } from './tables/messages';
import { userInteractions } from './tables/user-interactions';

export async function listRecentCommentContentsByAuthor(
  userId: string,
  limit: number
): Promise<string[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({ content: comments.content })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(limit);
    return rows.map((r) => r.content);
  }, 'message-quality-recent-comments');
}

export async function listRecentMessageContentsBySender(
  userId: string,
  limit: number
): Promise<string[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.senderId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.map((r) => r.content);
  }, 'message-quality-recent-chat-messages');
}

export async function listUserInteractionQualityScores(
  userId: string
): Promise<number[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({ qualityScore: userInteractions.qualityScore })
      .from(userInteractions)
      .where(eq(userInteractions.userId, userId));
    return rows.map((r) => r.qualityScore);
  }, 'message-quality-user-stats');
}
