/**
 * Admin Content Moderation Action API
 *
 * @route POST /api/admin/content-queue/[contentId] - Moderate content
 * @access Admin
 *
 * @description
 * Performs moderation actions on flagged content (approve, hide, delete).
 * Uses soft delete (deletedAt) for hiding content.
 */

import {
  checkRateLimitAndDuplicates,
  logAdminModify,
  RATE_LIMIT_CONFIGS,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  dismissReportsForReportedCommentAdmin,
  dismissReportsForReportedPostAdmin,
  selectAdminContentQueueCommentLookup,
  selectAdminContentQueuePostLookup,
  softDeleteCommentAndResolveReportsAdmin,
  softDeletePostAndResolveReportsAdmin,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Moderation action types:
 * - approve: Mark content as reviewed and acceptable, dismiss associated reports
 * - hide: Soft delete content (set deletedAt), keeps data for potential recovery
 *
 * NOTE: "delete" was removed as it was redundant with "hide". Both performed
 * soft deletes. If hard delete is needed in the future, it should be a
 * separate, more privileged action with additional safeguards.
 */
const ModerateRequestSchema = z.object({
  action: z.enum(['approve', 'hide']),
  contentType: z.enum(['post', 'comment']),
  reason: z.string().max(500).optional(), // Max 500 chars for reason
});

/**
 * Get real client IP address from x-forwarded-for header
 * Takes the last IP in the chain which is the most reliable (added by our proxy)
 */
function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return undefined;
  // Take the last IP (most reliable - added by our reverse proxy)
  return forwardedFor
    .split(',')
    .map((s) => s.trim())
    .pop();
}

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ contentId: string }> }
  ) => {
    const admin = await requireAdmin(request);

    // Rate limit admin actions to prevent abuse
    const rateLimitResponse = checkRateLimitAndDuplicates(
      admin.userId,
      null,
      RATE_LIMIT_CONFIGS.ADMIN_ACTION
    );
    if (rateLimitResponse) return rateLimitResponse;

    const { contentId } = await params;

    // Validate request body with Zod schema
    const parseResult = ModerateRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return successResponse(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        400
      );
    }
    const { action, contentType, reason } = parseResult.data;

    logger.info(
      'Content moderation action',
      { contentId, action, contentType, adminId: admin.userId },
      'POST /api/admin/content-queue/[contentId]'
    );

    if (contentType === 'post') {
      const existingPost = await asSystem(
        (tx) => selectAdminContentQueuePostLookup(tx, contentId),
        'admin-content-queue-post-lookup'
      );

      if (!existingPost) {
        return successResponse({ error: 'Post not found' }, 404);
      }

      const clientIp = getClientIp(request);
      const userAgent = request.headers.get('user-agent') ?? undefined;

      if (action === 'approve') {
        const now = new Date();
        await asSystem(
          (tx) =>
            dismissReportsForReportedPostAdmin(tx, {
              contentId,
              adminId: admin.userId,
              resolution: 'Content approved by admin',
              now,
            }),
          'admin-content-queue-post-approve'
        );

        await logAdminModify({
          adminId: admin.userId,
          resourceType: 'post',
          resourceId: contentId,
          previousValue: { status: 'pending' },
          newValue: { status: 'approved' },
          ipAddress: clientIp,
          userAgent,
          metadata: { action: 'approve' },
        });
      } else if (action === 'hide') {
        await asSystem(async (tx) => {
          const now = new Date();
          await softDeletePostAndResolveReportsAdmin(tx, {
            contentId,
            adminId: admin.userId,
            resolution: reason || 'Content hidden by admin',
            now,
          });
        }, 'admin-content-queue-post-hide');

        await logAdminModify({
          adminId: admin.userId,
          resourceType: 'post',
          resourceId: contentId,
          previousValue: { deletedAt: null },
          newValue: {
            deletedAt: new Date().toISOString(),
            reason: reason ?? null,
          },
          ipAddress: clientIp,
          userAgent,
          metadata: { action: 'hide' },
        });
      }
    } else if (contentType === 'comment') {
      const existingComment = await asSystem(
        (tx) => selectAdminContentQueueCommentLookup(tx, contentId),
        'admin-content-queue-comment-lookup'
      );

      if (!existingComment) {
        return successResponse({ error: 'Comment not found' }, 404);
      }

      const clientIp = getClientIp(request);
      const userAgent = request.headers.get('user-agent') ?? undefined;

      if (action === 'approve') {
        const now = new Date();
        await asSystem(
          (tx) =>
            dismissReportsForReportedCommentAdmin(tx, {
              contentId,
              adminId: admin.userId,
              resolution: 'Comment approved by admin',
              now,
            }),
          'admin-content-queue-comment-approve'
        );

        await logAdminModify({
          adminId: admin.userId,
          resourceType: 'comment',
          resourceId: contentId,
          previousValue: { status: 'pending' },
          newValue: { status: 'approved' },
          ipAddress: clientIp,
          userAgent,
          metadata: { action: 'approve' },
        });
      } else if (action === 'hide') {
        await asSystem(async (tx) => {
          const now = new Date();
          await softDeleteCommentAndResolveReportsAdmin(tx, {
            contentId,
            adminId: admin.userId,
            resolution: reason || 'Comment hidden by admin',
            now,
          });
        }, 'admin-content-queue-comment-hide');

        await logAdminModify({
          adminId: admin.userId,
          resourceType: 'comment',
          resourceId: contentId,
          previousValue: { deletedAt: null },
          newValue: {
            deletedAt: new Date().toISOString(),
            reason: reason ?? null,
          },
          ipAddress: clientIp,
          userAgent,
          metadata: { action: 'hide' },
        });
      }
    }

    return successResponse({
      success: true,
      action,
      contentId,
      contentType,
    });
  }
);
