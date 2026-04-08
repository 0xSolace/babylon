/**
 * Admin Resolution Review Queue API
 *
 * @route GET /api/admin/resolutions - List pending resolution reviews
 * @access Admin
 *
 * Returns prediction questions that were flagged as low-confidence and require
 * manual review before the market can be resolved.
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { selectAdminPendingResolutionReviews } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { toISOOrNull } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const pending = await asSystem(
    (tx) => selectAdminPendingResolutionReviews(tx, { limit: 200 }),
    'admin-resolutions-pending-queue'
  );

  return successResponse({
    success: true,
    items: pending.map((q) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      text: q.text,
      outcome: q.outcome,
      resolutionDate: toISOOrNull(q.resolutionDate),
      resolutionProofUrl: q.resolutionProofUrl ?? null,
      resolutionDescription: q.resolutionDescription ?? null,
      resolutionConfidence:
        typeof q.resolutionConfidence === 'number'
          ? q.resolutionConfidence
          : null,
      resolutionReviewStatus: q.resolutionReviewStatus ?? 'pending',
      requiresManualReview: Boolean(q.requiresManualReview),
      updatedAt: toISOOrNull(q.updatedAt),
    })),
    count: pending.length,
  });
});
