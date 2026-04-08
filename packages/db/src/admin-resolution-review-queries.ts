/**
 * SQL for admin resolution review: GET pending queue, POST approve/reject.
 */

import { and, asc, eq, isNull, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { questions } from './tables/questions';

type ResolutionReviewDb = DrizzleClient | Transaction;

export type AdminPendingResolutionReviewRow = {
  id: string;
  questionNumber: number;
  text: string;
  outcome: boolean;
  resolutionDate: Date;
  resolutionProofUrl: string | null;
  resolutionDescription: string | null;
  resolutionConfidence: number | null;
  resolutionReviewStatus: string | null;
  requiresManualReview: boolean;
  updatedAt: Date;
};

export async function selectAdminPendingResolutionReviews(
  db: ResolutionReviewDb,
  options: { limit?: number } = {}
): Promise<AdminPendingResolutionReviewRow[]> {
  const limit = options.limit ?? 200;
  return db
    .select({
      id: questions.id,
      questionNumber: questions.questionNumber,
      text: questions.text,
      outcome: questions.outcome,
      resolutionDate: questions.resolutionDate,
      resolutionProofUrl: questions.resolutionProofUrl,
      resolutionDescription: questions.resolutionDescription,
      resolutionConfidence: questions.resolutionConfidence,
      resolutionReviewStatus: questions.resolutionReviewStatus,
      requiresManualReview: questions.requiresManualReview,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .where(
      and(
        eq(questions.status, 'active'),
        eq(questions.requiresManualReview, true),
        or(
          isNull(questions.resolutionReviewStatus),
          eq(questions.resolutionReviewStatus, 'pending')
        )
      )
    )
    .orderBy(asc(questions.resolutionDate))
    .limit(limit);
}

export type AdminResolutionReviewOutcome =
  | { kind: 'not_found' }
  | { kind: 'invalid_state' }
  | { kind: 'not_reviewable' }
  | { kind: 'already_approved' }
  | { kind: 'approved'; questionNumber: number }
  | { kind: 'rejected'; questionNumber: number; postponed: Date };

export async function runAdminResolutionReview(
  db: ResolutionReviewDb,
  params: {
    questionId: string;
    adminUserId: string;
    action: 'approve' | 'reject';
    postponeMs: number;
  }
): Promise<AdminResolutionReviewOutcome> {
  const { questionId, adminUserId, action, postponeMs } = params;

  const [existing] = await db
    .select({
      id: questions.id,
      questionNumber: questions.questionNumber,
      status: questions.status,
      requiresManualReview: questions.requiresManualReview,
      resolutionReviewStatus: questions.resolutionReviewStatus,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!existing) {
    return { kind: 'not_found' };
  }

  if (existing.status !== 'active') {
    return { kind: 'invalid_state' };
  }

  if (!existing.requiresManualReview) {
    return { kind: 'not_reviewable' };
  }

  if (existing.resolutionReviewStatus === 'approved') {
    return { kind: 'already_approved' };
  }

  const now = new Date();

  if (action === 'approve') {
    await db
      .update(questions)
      .set({
        resolutionReviewStatus: 'approved',
        resolutionReviewedAt: now,
        resolutionReviewedBy: adminUserId,
        updatedAt: now,
      })
      .where(eq(questions.id, questionId));

    return {
      kind: 'approved',
      questionNumber: existing.questionNumber,
    };
  }

  const postponed = new Date(now.getTime() + postponeMs);

  await db
    .update(questions)
    .set({
      requiresManualReview: false,
      resolutionReviewStatus: 'rejected',
      resolutionReviewedAt: now,
      resolutionReviewedBy: adminUserId,
      resolutionConfidence: null,
      resolutionProofUrl: null,
      resolutionDescription: null,
      resolutionDate: postponed,
      updatedAt: now,
    })
    .where(eq(questions.id, questionId));

  return {
    kind: 'rejected',
    questionNumber: existing.questionNumber,
    postponed,
  };
}
