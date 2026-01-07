import type { JsonValue } from '@babylon/db'
import {
  and,
  db,
  desc,
  eq,
  inArray,
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

// Local type for userGroups select result
interface UserGroup {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: Date | null
  updatedAt: Date | null
  isPrivate: boolean | null
  imageUrl: string | null
  memberCount: number | null
  metadata: JsonValue | null
}

// Local type for userGroupInvites select result
interface UserGroupInvite {
  id: string
  groupId: string
  inviterId: string
  inviteeId: string | null
  invitedUserId: string | null
  invitedBy: string | null
  code: string | null
  createdAt: Date | null
  expiresAt: Date | null
  usedAt: Date | null
  status: string
  invitedAt: Date | null
  respondedAt: Date | null
}

/**
 * Groups routes
 * Migrated from: apps/web/app/api/groups/*
 */
const createGroupsRoutes = () =>
  new Elysia({ prefix: '/api/groups' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Create new group
    .post(
      '/',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { name, description, memberIds } = body as {
          name: string
          description?: string
          memberIds?: string[]
        }

        if (!name || name.trim().length === 0) {
          set.status = 400
          return { error: 'Group name is required' }
        }

        // Create group
        const groupId = await generateSnowflakeId()
        await db.insert(userGroups).values({
          id: groupId,
          name: name.trim(),
          description: description?.trim() ?? null,
          ownerId: user.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Add creator as member and admin
        const creatorMemberId = await generateSnowflakeId()
        await db.insert(userGroupMembers).values({
          id: creatorMemberId,
          groupId,
          userId: user.userId,
          joinedAt: new Date(),
        })

        const creatorAdminId = await generateSnowflakeId()
        await db.insert(userGroupAdmins).values({
          id: creatorAdminId,
          groupId,
          userId: user.userId,
        })

        // Send invites to initial members
        const inviteResults: Array<{ userId: string; inviteId: string }> = []
        if (memberIds && memberIds.length > 0) {
          for (const memberId of memberIds) {
            if (memberId === user.userId) continue // Skip creator

            const inviteId = await generateSnowflakeId()
            await db.insert(userGroupInvites).values({
              id: inviteId,
              groupId,
              invitedUserId: memberId,
              invitedBy: user.userId,
              status: 'pending',
              invitedAt: new Date(),
            })
            inviteResults.push({ userId: memberId, inviteId })
          }
        }

        logger.info(
          'Group created',
          {
            groupId,
            name,
            creatorId: user.userId,
            inviteCount: inviteResults.length,
          },
          'POST /api/groups',
        )

        return {
          success: true,
          group: {
            id: groupId,
            name: name.trim(),
            description: description?.trim() ?? null,
            ownerId: user.userId,
          },
          invites: inviteResults,
        }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          memberIds: t.Optional(t.Array(t.String())),
        }),
        detail: {
          tags: ['Groups'],
          summary: 'Create new group',
          description:
            'Creates a new user group and optionally invites members',
        },
      },
    )

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
        const [group] = (await db
          .select()
          .from(userGroups)
          .where(eq(userGroups.id, groupId))
          .limit(1)) as unknown as UserGroup[]

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
                .where(inArray(users.id, memberIds))
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
            ownerId: group.ownerId,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            members: membersWithDetails,
            isAdmin,
            isCreator: group.ownerId === user.userId,
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
        const { name, description } = body as {
          name?: string
          description?: string
        }
        const updates: Record<string, unknown> = { updatedAt: new Date() }
        if (name !== undefined) updates.name = name
        if (description !== undefined) updates.description = description

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
        const { userId: newUserId } = body as { userId: string }

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

    // Invite user to group
    .post(
      '/:groupId/invites',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { groupId } = params
        const { userId: inviteeUserId } = body as { userId: string }

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
          return { error: 'Only admins can send invites' }
        }

        // Check if user is already a member
        const [existingMember] = await db
          .select()
          .from(userGroupMembers)
          .where(
            and(
              eq(userGroupMembers.groupId, groupId),
              eq(userGroupMembers.userId, inviteeUserId),
            ),
          )
          .limit(1)

        if (existingMember) {
          return { success: true, message: 'User is already a member' }
        }

        // Check if invite already exists
        const [existingInvite] = (await db
          .select()
          .from(userGroupInvites)
          .where(
            and(
              eq(userGroupInvites.groupId, groupId),
              eq(userGroupInvites.invitedUserId, inviteeUserId),
              eq(userGroupInvites.status, 'pending'),
            ),
          )
          .limit(1)) as unknown as UserGroupInvite[]

        if (existingInvite) {
          return {
            success: true,
            message: 'Invite already pending',
            inviteId: existingInvite.id,
          }
        }

        // Create invite
        const inviteId = await generateSnowflakeId()
        await db.insert(userGroupInvites).values({
          id: inviteId,
          groupId,
          invitedUserId: inviteeUserId,
          invitedBy: user.userId,
          status: 'pending',
          invitedAt: new Date(),
        })

        logger.info(
          'Group invite sent',
          { groupId, inviteeUserId, invitedBy: user.userId, inviteId },
          'POST /api/groups/:groupId/invites',
        )

        return { success: true, inviteId }
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
          summary: 'Invite user to group',
          description:
            'Sends an invite to a user to join the group (admin only)',
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
        const [invite] = (await db
          .select()
          .from(userGroupInvites)
          .where(eq(userGroupInvites.id, inviteId))
          .limit(1)) as unknown as UserGroupInvite[]

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
        const [invite] = (await db
          .select()
          .from(userGroupInvites)
          .where(eq(userGroupInvites.id, inviteId))
          .limit(1)) as unknown as UserGroupInvite[]

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
