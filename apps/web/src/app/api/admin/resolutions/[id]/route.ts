/**
 * Admin Resolution Review Action API
 *
 * @route POST /api/admin/resolutions/[id] - Approve or reject a pending resolution
 * @access Admin
 */

import {
  checkRateLimitAndDuplicates,
  errorResponse,
  RATE_LIMIT_CONFIGS,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { runAdminResolutionReview } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

/** Hours to postpone resolution after rejection (default: 24h) */
const POSTPONE_HOURS = (() => {
  const val = Number(process.env.RESOLUTION_POSTPONE_HOURS);
  return Number.isFinite(val) && val > 0 ? val : 24;
})();

const ParamsSchema = z.object({
  id: z.string().min(1),
});

const BodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const admin = await requireAdmin(request);

    // Rate limit admin actions to prevent accidental rapid-fire approvals/rejections
    const rateLimitResponse = checkRateLimitAndDuplicates(
      admin.userId,
      null,
      RATE_LIMIT_CONFIGS.ADMIN_ACTION
    );
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = ParamsSchema.parse(await context.params);
    const { action } = BodySchema.parse(await request.json());

    const outcome = await asSystem(
      (tx) =>
        runAdminResolutionReview(tx, {
          questionId: id,
          adminUserId: admin.userId,
          action,
          postponeMs: POSTPONE_HOURS * 60 * 60 * 1000,
        }),
      'admin-resolution-review'
    );

    if (outcome.kind === 'not_found') {
      return errorResponse('Question not found', 'NOT_FOUND', 404);
    }
    if (outcome.kind === 'invalid_state') {
      return errorResponse(
        'Question is not active and cannot be reviewed',
        'INVALID_STATE',
        400
      );
    }
    if (outcome.kind === 'not_reviewable') {
      return errorResponse(
        'Question does not require manual review',
        'NOT_REVIEWABLE',
        400
      );
    }
    if (outcome.kind === 'already_approved') {
      return errorResponse(
        'Question already approved',
        'ALREADY_APPROVED',
        400
      );
    }

    if (outcome.kind === 'approved') {
      logger.info(
        'Resolution approved',
        {
          questionId: id,
          questionNumber: outcome.questionNumber,
          reviewedBy: admin.userId,
        },
        'AdminResolutions'
      );
      return successResponse({ success: true });
    }

    logger.info(
      'Resolution rejected',
      {
        questionId: id,
        questionNumber: outcome.questionNumber,
        reviewedBy: admin.userId,
        postponedUntil: toISO(outcome.postponed),
      },
      'AdminResolutions'
    );

    return successResponse({
      success: true,
      postponedUntil: toISO(outcome.postponed),
    });
  }
);
