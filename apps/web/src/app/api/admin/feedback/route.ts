/**
 * Admin Feedback API
 *
 * Provides endpoints for admins to view and manage game feedback submissions.
 */

import {
  errorResponse,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { fetchAdminGameFeedbackListBundle } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { FeedbackTypeSchema, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';

/** Valid feedback types for SQL filter validation */
const VALID_FEEDBACK_TYPES = FeedbackTypeSchema.options;

interface FeedbackMetadata {
  feedbackType?: string;
  stepsToReproduce?: string | null;
  screenshotUrl?: string | null;
  rating?: number | null;
  linearIssueId?: string | null;
  linearIssueIdentifier?: string | null;
  linearIssueUrl?: string | null;
}

/**
 * Safely parse an integer from a string, returning a default if invalid.
 */
function safeParseInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && !Number.isNaN(parsed)
    ? parsed
    : defaultValue;
}

/**
 * Validate and parse a date string, returning null if invalid.
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * GET /api/admin/feedback
 *
 * Fetches game feedback submissions with optional filtering.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);

  // Safely parse pagination params with fallbacks
  const rawLimit = safeParseInt(searchParams.get('limit'), 50);
  const limit = Math.min(Math.max(rawLimit, 1), 200); // Clamp between 1-200
  const offset = Math.max(safeParseInt(searchParams.get('offset'), 0), 0);

  const feedbackTypeRaw = searchParams.get('type'); // bug, feature_request, performance
  const hasLinearIssue = searchParams.get('hasLinearIssue'); // true, false
  const search = searchParams.get('search'); // search in comment

  // Validate date params
  const fromDate = parseDate(searchParams.get('fromDate'));
  const toDate = parseDate(searchParams.get('toDate'));

  let feedbackType: string | undefined;
  if (feedbackTypeRaw) {
    if (
      !VALID_FEEDBACK_TYPES.includes(
        feedbackTypeRaw as (typeof VALID_FEEDBACK_TYPES)[number]
      )
    ) {
      return errorResponse(
        'Invalid feedback type',
        'INVALID_FEEDBACK_TYPE',
        400
      );
    }
    feedbackType = feedbackTypeRaw;
  }

  const { feedbackItems, totalCount, statsByType } = await asSystem(
    (tx) =>
      fetchAdminGameFeedbackListBundle(tx, {
        limit,
        offset,
        feedbackType,
        hasLinearIssue:
          hasLinearIssue === 'true' || hasLinearIssue === 'false'
            ? hasLinearIssue
            : undefined,
        search: search ?? undefined,
        fromDate,
        toDate,
      }),
    'admin-feedback-list'
  );

  // Format response
  const formattedFeedback = feedbackItems.map((item) => {
    const metadata = (item.metadata ?? {}) as FeedbackMetadata;
    return {
      id: item.id,
      feedbackType: metadata.feedbackType ?? 'unknown',
      description: item.comment,
      score: item.score,
      rating: metadata.rating,
      stepsToReproduce: metadata.stepsToReproduce,
      screenshotUrl: metadata.screenshotUrl,
      linearIssue: metadata.linearIssueId
        ? {
            id: metadata.linearIssueId,
            identifier: metadata.linearIssueIdentifier,
            url: metadata.linearIssueUrl,
          }
        : null,
      createdAt: toISO(item.createdAt),
      user: item.user
        ? {
            id: item.user.id,
            username: item.user.username,
            displayName: item.user.displayName,
            profileImageUrl: item.user.profileImageUrl,
            email: item.user.email,
          }
        : null,
    };
  });

  return successResponse({
    feedback: formattedFeedback,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + feedbackItems.length < totalCount,
    },
    stats: {
      total: statsByType.reduce((acc, s) => acc + Number(s.count), 0),
      byType: Object.fromEntries(
        statsByType.map((s) => [s.feedbackType ?? 'unknown', Number(s.count)])
      ),
    },
  });
});
