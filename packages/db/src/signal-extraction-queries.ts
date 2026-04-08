/**
 * Question + posts + authors for internal signal extraction (engine-only).
 *
 * **Why here:** Single `asSystem` transaction with explicit `where` clauses; engine
 * keeps weighting / reliability logic and must not expose this via public API.
 */

import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { users } from './tables/user';

export type SignalExtractionQuestionRow = {
  id: string;
  questionNumber: number;
  text: string;
};

export type SignalExtractionPostRow = {
  id: string;
  content: string;
  authorId: string;
  dayNumber: number | null;
  sentiment: string | null;
  biasScore: number | null;
  type: string;
  createdAt: Date;
};

export type SignalExtractionUserRow = {
  id: string;
  displayName: string | null;
  isActor: boolean;
};

export async function loadSignalExtractionMarketPayload(
  questionNumber: number,
  asOf: Date
): Promise<{
  question: SignalExtractionQuestionRow;
  postsList: SignalExtractionPostRow[];
  usersList: SignalExtractionUserRow[];
} | null> {
  return asSystem(async (c) => {
    const [q] = await c
      .select({
        id: questions.id,
        questionNumber: questions.questionNumber,
        text: questions.text,
      })
      .from(questions)
      .where(eq(questions.questionNumber, questionNumber))
      .limit(1);

    if (!q) {
      return null;
    }

    const plist = await c
      .select({
        id: posts.id,
        content: posts.content,
        authorId: posts.authorId,
        dayNumber: posts.dayNumber,
        sentiment: posts.sentiment,
        biasScore: posts.biasScore,
        type: posts.type,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(
        and(
          eq(posts.gameId, q.id),
          isNull(posts.deletedAt),
          lte(posts.timestamp, asOf)
        )
      )
      .limit(1000);

    const aIds = [...new Set(plist.map((p) => p.authorId))];
    const ulist =
      aIds.length > 0
        ? await c
            .select({
              id: users.id,
              displayName: users.displayName,
              isActor: users.isActor,
            })
            .from(users)
            .where(inArray(users.id, aIds))
        : [];

    return { question: q, postsList: plist, usersList: ulist };
  }, 'signal-extraction-market-load');
}
