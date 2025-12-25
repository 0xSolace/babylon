// @ts-nocheck - Elysia body type inference issues, needs refactoring
import {
  and,
  db,
  desc,
  eq,
  userGroupAdmins,
  userGroupInvites,
  userGroupMembers,
  userGroups,
  users,
} from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * Groups routes
 * Migrated from: apps/web/app/api/groups/*
 */
const createGroupsRoutes = () =>
  new Elysia({ prefix: '/api/groups' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get group by ID
    // Migrated from: apps/web/app/api/groups/[groupId]/route.ts (GET)
    .get(
      '/:groupId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params

        // Get group
        const [group] = await db
          .select()
          .from(userGroups)
          .where(eq(userGroups.id, groupId))
          .limit(1)

        if (!group) {
          set.status = 404
          return { error: 'Group not found' }
        }

        // Get members
        const members = await db
          .select({
            userId: userGroupMembers.userId,
            joinedAt: userGroupMembers.joinedAt,
          })
          .from(userGroupMembers)
          .where(eq(userGroupMembers.groupId, groupId))

        // Get admins
        const admins = await db
          .select({ userId: userGroupAdmins.userId })
          .from(userGroupAdmins)
          .where(eq(userGroupAdmins.groupId, groupId))

        const adminIds = admins.map((a) => a.userId)
        const isMember = members.some((m) => m.userId === user.userId)
        const isAdmin = adminIds.includes(user.userId)

        if (!isMember && !isAdmin) {
          set.status = 403
          return { error: 'You are not a member of this group' }
        }

        // Get member details
        const memberIds = members.map((m) => m.userId)
        const memberUsers =
          memberIds.length > 0
            ? await db
                .select({
                  id: users.id,
                  displayName: users.displayName,
                  username: users.username,
                  profileImageUrl: users.profileImageUrl,
                })
                .from(users)
                .where(eq(users.id, memberIds[0])) // TODO: proper IN query
            : []

        const memberMap = new Map(memberUsers.map((u) => [u.id, u]))

        const membersWithDetails = members.map((m) => ({
          ...memberMap.get(m.userId),
          joinedAt: m.joinedAt,
          isAdmin: adminIds.includes(m.userId),
        }))

        logger.info(
          'Group details retrieved',
          { userId: user.userId, groupId },
          'GET /api/groups/:groupId',
        )

        return {
          success: true,
          group: {
            id: group.id,
            name: group.name,
            description: group.description,
            createdById: group.createdById,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            members: membersWithDetails,
            isAdmin,
            isCreator: group.createdById === user.userId,
          },
        }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Get group details',
          description: 'Returns group information including members and admins',
        },
      },
    )

    // Update group
    // Migrated from: apps/web/app/api/groups/[groupId]/route.ts (PATCH)
    .patch(
      '/:groupId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params

        // Check if user is admin
        const [isAdmin] = await db
          .select()
          .from(userGroupAdmins)
          .where(
            and(
              eq(userGroupAdmins.groupId, groupId),
              eq(userGroupAdmins.userId, user.userId),
            ),
          )
          .limit(1)

        if (!isAdmin) {
          set.status = 403
          return { error: 'Only group admins can update group details' }
        }

        // Update group
        const updates: Record<string, unknown> = { updatedAt: new Date() }
        if (body.name !== undefined) updates.name = body.name
        if (body.description !== undefined)
          updates.description = body.description

        await db
          .update(userGroups)
          .set(updates)
          .where(eq(userGroups.id, groupId))

        logger.info(
          'Group updated',
          { userId: user.userId, groupId },
          'PATCH /api/groups/:groupId',
        )

        return { success: true }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Update group',
          description: 'Updates group name and description (admin only)',
        },
      },
    )

    // Delete group
    // Migrated from: apps/web/app/api/groups/[groupId]/route.ts (DELETE)
    .delete(
      '/:groupId',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params

        // Check if user is admin
        const [isAdmin] = await db
          .select()
          .from(userGroupAdmins)
          .where(
            and(
              eq(userGroupAdmins.groupId, groupId),
              eq(userGroupAdmins.userId, user.userId),
            ),
          )
          .limit(1)

        if (!isAdmin) {
          set.status = 403
          return { error: 'Only group admins can delete the group' }
        }

        // Delete group (cascades to members and admins)
        await db.delete(userGroups).where(eq(userGroups.id, groupId))

        logger.info(
          'Group deleted',
          { userId: user.userId, groupId },
          'DELETE /api/groups/:groupId',
        )

        return { success: true }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Delete group',
          description: 'Permanently deletes group (admin only)',
        },
      },
    )

    // Get group members
    // Migrated from: apps/web/app/api/groups/[groupId]/members/route.ts
    .get(
      '/:groupId/members',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params

        // Check membership
        const [isMember] = await db
          .select()
          .from(userGroupMembers)
          .where(
            and(
              eq(userGroupMembers.groupId, groupId),
              eq(userGroupMembers.userId, user.userId),
            ),
          )
          .limit(1)

        if (!isMember) {
          set.status = 403
          return { error: 'Not a member of this group' }
        }

        const members = await db
          .select()
          .from(userGroupMembers)
          .where(eq(userGroupMembers.groupId, groupId))
          .orderBy(desc(userGroupMembers.joinedAt))

        return {
          success: true,
          members,
          count: members.length,
        }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Get group members',
          description: 'Returns list of group members',
        },
      },
    )

    // Add member to group
    // Migrated from: apps/web/app/api/groups/[groupId]/members/route.ts (POST)
    .post(
      '/:groupId/members',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params
        const { userId: newUserId } = body

        // Check if requesting user is admin
        const [isAdmin] = await db
          .select()
          .from(userGroupAdmins)
          .where(
            and(
              eq(userGroupAdmins.groupId, groupId),
              eq(userGroupAdmins.userId, user.userId),
            ),
          )
          .limit(1)

        if (!isAdmin) {
          set.status = 403
          return { error: 'Only admins can add members' }
        }

        // Check if already a member
        const [existingMember] = await db
          .select()
          .from(userGroupMembers)
          .where(
            and(
              eq(userGroupMembers.groupId, groupId),
              eq(userGroupMembers.userId, newUserId),
            ),
          )
          .limit(1)

        if (existingMember) {
          return { success: true, message: 'User is already a member' }
        }

        const memberId = await generateSnowflakeId()
        await db.insert(userGroupMembers).values({
          id: memberId,
          groupId,
          userId: newUserId,
          joinedAt: new Date(),
        })

        logger.info(
          'Member added to group',
          { groupId, newUserId, addedBy: user.userId },
          'POST /api/groups/:groupId/members',
        )

        return { success: true }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        body: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Add member to group',
          description: 'Adds a user to the group (admin only)',
        },
      },
    )

    // Get group admins
    // Migrated from: apps/web/app/api/groups/[groupId]/admins/route.ts
    .get(
      '/:groupId/admins',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params

        const admins = await db
          .select()
          .from(userGroupAdmins)
          .where(eq(userGroupAdmins.groupId, groupId))

        return {
          success: true,
          admins,
          count: admins.length,
        }
      },
      {
        params: t.Object({
          groupId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Get group admins',
          description: 'Returns list of group admins',
        },
      },
    )

    // Get pending invites
    // Migrated from: apps/web/app/api/groups/invites/route.ts
    .get(
      '/invites',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const invites = await db
          .select()
          .from(userGroupInvites)
          .where(
            and(
              eq(userGroupInvites.invitedUserId, user.userId),
              eq(userGroupInvites.status, 'pending'),
            ),
          )
          .orderBy(desc(userGroupInvites.invitedAt))

        return {
          success: true,
          invites,
          count: invites.length,
        }
      },
      {
        detail: {
          tags: ['Groups'],
          summary: 'Get pending invites',
          description: 'Returns pending group invites for current user',
        },
      },
    )

    // Accept invite
    // Migrated from: apps/web/app/api/groups/invites/[inviteId]/accept/route.ts
    .post(
      '/invites/:inviteId/accept',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { inviteId } = params

        // Get invite
        const [invite] = await db
          .select()
          .from(userGroupInvites)
          .where(eq(userGroupInvites.id, inviteId))
          .limit(1)

        if (!invite) {
          set.status = 404
          return { error: 'Invite not found' }
        }

        if (invite.invitedUserId !== user.userId) {
          set.status = 403
          return { error: 'This invite is not for you' }
        }

        if (invite.status !== 'pending') {
          set.status = 400
          return { error: 'Invite has already been processed' }
        }

        // Add user to group
        const memberId = await generateSnowflakeId()
        await db.insert(userGroupMembers).values({
          id: memberId,
          groupId: invite.groupId,
          userId: user.userId,
          joinedAt: new Date(),
        })

        // Update invite status
        await db
          .update(userGroupInvites)
          .set({ status: 'accepted' })
          .where(eq(userGroupInvites.id, inviteId))

        logger.info(
          'Invite accepted',
          { userId: user.userId, inviteId, groupId: invite.groupId },
          'POST /api/groups/invites/:inviteId/accept',
        )

        return { success: true }
      },
      {
        params: t.Object({
          inviteId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Accept invite',
          description: 'Accepts a group invite',
        },
      },
    )

    // Decline invite
    // Migrated from: apps/web/app/api/groups/invites/[inviteId]/decline/route.ts
    .post(
      '/invites/:inviteId/decline',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { inviteId } = params

        // Get invite
        const [invite] = await db
          .select()
          .from(userGroupInvites)
          .where(eq(userGroupInvites.id, inviteId))
          .limit(1)

        if (!invite) {
          set.status = 404
          return { error: 'Invite not found' }
        }

        if (invite.invitedUserId !== user.userId) {
          set.status = 403
          return { error: 'This invite is not for you' }
        }

        // Update invite status
        await db
          .update(userGroupInvites)
          .set({ status: 'declined' })
          .where(eq(userGroupInvites.id, inviteId))

        logger.info(
          'Invite declined',
          { userId: user.userId, inviteId },
          'POST /api/groups/invites/:inviteId/decline',
        )

        return { success: true }
      },
      {
        params: t.Object({
          inviteId: t.String(),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Decline invite',
          description: 'Declines a group invite',
        },
      },
    )

export const groupsRoutes = createGroupsRoutes()
