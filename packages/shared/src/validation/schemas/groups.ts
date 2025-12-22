/**
 * User Group validation schemas
 *
 * Schemas for user-created groups including creation, updates,
 * member management, and invites.
 */

import { z } from 'zod';

// ============================================================================
// Group Member Schemas
// ============================================================================

/**
 * Group member base schema
 */
export const GroupMemberBaseSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActor: z.boolean().optional(),
});
export type GroupMemberBase = z.infer<typeof GroupMemberBaseSchema>;

/**
 * Group member schema (with role info)
 */
export const GroupMemberSchema = GroupMemberBaseSchema.extend({
  isAdmin: z.boolean(),
  joinedAt: z.string().datetime(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

// ============================================================================
// Group Schemas
// ============================================================================

/**
 * Group base schema (common fields)
 */
export const GroupBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupBase = z.infer<typeof GroupBaseSchema>;

/**
 * Group with members schema
 */
export const GroupSchema = GroupBaseSchema.extend({
  members: z.array(GroupMemberSchema),
  admins: z.array(GroupMemberBaseSchema),
  memberCount: z.number().optional(),
});
export type Group = z.infer<typeof GroupSchema>;

/**
 * Group summary schema (for list views)
 */
export const GroupSummarySchema = GroupBaseSchema.extend({
  memberCount: z.number(),
  isAdmin: z.boolean(),
});
export type GroupSummary = z.infer<typeof GroupSummarySchema>;

// ============================================================================
// Group CRUD Schemas
// ============================================================================

/**
 * Create group schema
 */
export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).optional().default([]),
});
export type CreateGroup = z.infer<typeof CreateGroupSchema>;

/**
 * Update group schema
 */
export const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});
export type UpdateGroup = z.infer<typeof UpdateGroupSchema>;

// ============================================================================
// Member Management Schemas
// ============================================================================

/**
 * Add member schema
 */
export const AddMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
export type AddMember = z.infer<typeof AddMemberSchema>;

/**
 * Add admin schema (promote member to admin)
 */
export const AddAdminSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
export type AddAdmin = z.infer<typeof AddAdminSchema>;

/**
 * Promote admin schema (alternative naming)
 */
export const PromoteAdminSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
export type PromoteAdmin = z.infer<typeof PromoteAdminSchema>;

/**
 * Remove member params schema
 */
export const RemoveMemberParamsSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
});
export type RemoveMemberParams = z.infer<typeof RemoveMemberParamsSchema>;

// ============================================================================
// Group Invite Schemas
// ============================================================================

/**
 * Invite status enum
 */
export const GroupInviteStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
]);
export type GroupInviteStatus = z.infer<typeof GroupInviteStatusSchema>;

/**
 * Create invite schema
 */
export const CreateGroupInviteSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  inviteeId: z.string().min(1, 'Invitee ID is required'),
  message: z.string().max(500).optional(),
});
export type CreateGroupInvite = z.infer<typeof CreateGroupInviteSchema>;

/**
 * Group invite schema
 */
export const GroupInviteSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  group: GroupBaseSchema.pick({ id: true, name: true, description: true }),
  inviterId: z.string(),
  inviter: GroupMemberBaseSchema,
  inviteeId: z.string(),
  invitee: GroupMemberBaseSchema.optional(),
  status: GroupInviteStatusSchema,
  message: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  respondedAt: z.string().datetime().nullable(),
});
export type GroupInvite = z.infer<typeof GroupInviteSchema>;

/**
 * Respond to invite schema
 */
export const RespondToInviteSchema = z.object({
  accept: z.boolean(),
});
export type RespondToInvite = z.infer<typeof RespondToInviteSchema>;

// ============================================================================
// Group Query Schemas
// ============================================================================

/**
 * List groups query schema
 */
export const ListGroupsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});
export type ListGroupsQuery = z.infer<typeof ListGroupsQuerySchema>;

/**
 * Group members query schema
 */
export const GroupMembersQuerySchema = z.object({
  groupId: z.string(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type GroupMembersQuery = z.infer<typeof GroupMembersQuerySchema>;

/**
 * List invites query schema
 */
export const ListInvitesQuerySchema = z.object({
  status: GroupInviteStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type ListInvitesQuery = z.infer<typeof ListInvitesQuerySchema>;

// ============================================================================
// Group Response Schemas
// ============================================================================

/**
 * Groups list response schema
 */
export const GroupsListResponseSchema = z.object({
  groups: z.array(GroupSummarySchema),
  total: z.number(),
  hasMore: z.boolean(),
});
export type GroupsListResponse = z.infer<typeof GroupsListResponseSchema>;

/**
 * Group members response schema
 */
export const GroupMembersResponseSchema = z.object({
  members: z.array(GroupMemberSchema),
  total: z.number(),
  hasMore: z.boolean(),
});
export type GroupMembersResponse = z.infer<typeof GroupMembersResponseSchema>;

/**
 * Group invites response schema
 */
export const GroupInvitesResponseSchema = z.object({
  invites: z.array(GroupInviteSchema),
  total: z.number(),
  hasMore: z.boolean(),
});
export type GroupInvitesResponse = z.infer<typeof GroupInvitesResponseSchema>;
