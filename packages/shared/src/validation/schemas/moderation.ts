/**
 * Moderation-related validation schemas
 */

import { z } from 'zod';

/**
 * Appeal schema for ban appeals
 * Used by: POST /api/moderation/appeal
 */
export const AppealSchema = z.object({
  reason: z.string().min(10).max(2000),
  stakeTxHash: z.string().optional(), // For staked appeals ($10)
});

export type Appeal = z.infer<typeof AppealSchema>;

/**
 * Report type enum
 */
export const ReportTypeSchema = z.enum(['user', 'post', 'comment']);

export type ReportType = z.infer<typeof ReportTypeSchema>;

/**
 * Report category schema for validation
 * Note: The canonical ReportCategory enum is in types/moderation.ts
 */
export const ReportCategorySchema = z.enum([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'self_harm',
  'sexual_content',
  'misinformation',
  'impersonation',
  'other',
]);

/**
 * Report status enum
 */
export const ReportStatusSchema = z.enum([
  'pending',
  'reviewing',
  'resolved',
  'dismissed',
]);

export type ReportStatus = z.infer<typeof ReportStatusSchema>;

/**
 * Create report schema
 * Used by: POST /api/moderation/reports
 */
export const CreateReportSchema = z
  .object({
    reportType: ReportTypeSchema,
    reportedUserId: z.string().min(1).optional(),
    reportedPostId: z.string().min(1).optional(),
    reportedCommentId: z.string().min(1).optional(),
    category: ReportCategorySchema,
    reason: z.string().min(10).max(2000).optional(),
    evidence: z.string().max(5000).optional(),
  })
  .refine(
    (data) => {
      // At least one of reportedUserId, reportedPostId, or reportedCommentId must be provided
      return (
        data.reportedUserId || data.reportedPostId || data.reportedCommentId
      );
    },
    {
      message:
        'At least one of reportedUserId, reportedPostId, or reportedCommentId is required',
      path: ['reportedUserId'],
    }
  );

export type CreateReport = z.infer<typeof CreateReportSchema>;

/**
 * Get reports query schema
 * Used by: GET /api/moderation/reports, GET /api/admin/reports
 */
export const GetReportsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: ReportStatusSchema.optional(),
  category: ReportCategorySchema.optional(),
  reportType: ReportTypeSchema.optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  reporterId: z.string().optional(),
  reportedUserId: z.string().optional(),
  reportedPostId: z.string().optional(),
  sortBy: z.enum(['created', 'updated', 'priority']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type GetReports = z.infer<typeof GetReportsSchema>;

/**
 * Get blocks query schema
 * Used by: GET /api/moderation/blocks
 */
export const GetBlocksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetBlocks = z.infer<typeof GetBlocksSchema>;

/**
 * Get mutes query schema
 * Used by: GET /api/moderation/mutes
 */
export const GetMutesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetMutes = z.infer<typeof GetMutesSchema>;

/**
 * Block user schema
 * Used by: POST /api/moderation/blocks
 */
export const BlockUserSchema = z.object({
  blockedUserId: z.string().min(1, 'blockedUserId is required'),
});

export type BlockUser = z.infer<typeof BlockUserSchema>;

/**
 * Unblock user schema
 * Used by: DELETE /api/moderation/blocks
 */
export const UnblockUserSchema = z.object({
  blockedUserId: z.string().min(1, 'blockedUserId is required'),
});

export type UnblockUser = z.infer<typeof UnblockUserSchema>;

/**
 * Mute user schema
 * Used by: POST /api/moderation/mutes
 */
export const MuteUserSchema = z.object({
  mutedUserId: z.string().min(1, 'mutedUserId is required'),
  duration: z.number().int().min(0).optional(), // Duration in seconds, 0 = permanent
});

export type MuteUser = z.infer<typeof MuteUserSchema>;

/**
 * Unmute user schema
 * Used by: DELETE /api/moderation/mutes
 */
export const UnmuteUserSchema = z.object({
  mutedUserId: z.string().min(1, 'mutedUserId is required'),
});

export type UnmuteUser = z.infer<typeof UnmuteUserSchema>;

/**
 * Appeal status enum
 */
export const AppealStatusSchema = z.enum([
  'strict_review',
  'lenient_review',
  'human_review',
  'approved',
  'denied',
]);

export type AppealStatus = z.infer<typeof AppealStatusSchema>;

/**
 * Report evaluation result (from AI evaluation)
 */
export const ReportEvaluationSchema = z.object({
  outcome: z.enum([
    'valid_report',
    'invalid_report',
    'needs_review',
    'insufficient_evidence',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  recommendedActions: z.array(z.string()),
});

export type ReportEvaluation = z.infer<typeof ReportEvaluationSchema>;
