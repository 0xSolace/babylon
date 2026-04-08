/**
 * Public resolution audit slice for prediction markets (markets + questions + frames + reviewer).
 */

import { desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { markets } from './tables/markets';
import { questions } from './tables/questions';
import { timeframedMarkets } from './tables/timeframed-markets';
import { users } from './tables/user';

type ResolutionAuditDb = DrizzleClient | Transaction;

export type PublicResolutionAudit = {
  resolution: boolean | null;
  resolvedAt: string | null;
  reviewStatus: string | null;
  confidence: number | null;
  description: string | null;
  proofUrl: string | null;
  onChainResolutionTxHash: string | null;
  resolvedBy: {
    id: string;
    displayName: string | null;
    username: string | null;
    kind: 'admin' | 'system';
  } | null;
};

export async function getPublicResolutionAudit(
  marketId: string,
  client: ResolutionAuditDb
): Promise<PublicResolutionAudit | null> {
  const [[market], [question], [latestResolvedFrame]] = await Promise.all([
    client.select().from(markets).where(eq(markets.id, marketId)).limit(1),
    client.select().from(questions).where(eq(questions.id, marketId)).limit(1),
    client
      .select({ resolvedAt: timeframedMarkets.resolvedAt })
      .from(timeframedMarkets)
      .where(eq(timeframedMarkets.questionId, marketId))
      .orderBy(desc(timeframedMarkets.resolvedAt))
      .limit(1),
  ]);

  if (!market) {
    return null;
  }

  const reviewerId = question?.resolutionReviewedBy ?? null;
  const reviewedAt = question?.resolutionReviewedAt ?? null;
  const frameResolvedAt = latestResolvedFrame?.resolvedAt ?? null;
  const resolvedAt =
    reviewedAt ??
    frameResolvedAt ??
    (market.resolved ? market.updatedAt : null) ??
    null;

  let resolvedBy: PublicResolutionAudit['resolvedBy'] = null;

  if (reviewerId === 'system') {
    resolvedBy = {
      id: 'system',
      displayName: 'Babylon Resolution Engine',
      username: null,
      kind: 'system',
    };
  } else if (reviewerId) {
    const [reviewer] = await client
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, reviewerId))
      .limit(1);

    if (reviewer) {
      resolvedBy = {
        id: reviewer.id,
        displayName: reviewer.displayName,
        username: reviewer.username,
        kind: 'admin',
      };
    }
  }

  return {
    resolution: market.resolution ?? null,
    resolvedAt: resolvedAt?.toISOString() ?? null,
    reviewStatus: question?.resolutionReviewStatus ?? null,
    confidence:
      typeof question?.resolutionConfidence === 'number'
        ? question.resolutionConfidence
        : null,
    description:
      question?.resolutionDescription ?? market.resolutionDescription ?? null,
    proofUrl: question?.resolutionProofUrl ?? market.resolutionProofUrl ?? null,
    onChainResolutionTxHash: market.onChainResolutionTxHash ?? null,
    resolvedBy,
  };
}
