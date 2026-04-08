/**
 * Reads/writes for `AlphaGroupInviteService` (decay, limits, stats, decline recording).
 *
 * **Why here:** `GroupInvite` / `GroupMember` / `UserInteraction` SQL under `asSystem`.
 * Thresholds, probabilities, and `TieredGroupService` stay in engine.
 */

import { and, count, desc, eq, gte, or } from 'drizzle-orm';
import { asSystem } from './db';
import { groupInvites } from './tables/group-invites';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { userInteractions } from './tables/user-interactions';

export type AlphaInviteDecayRow = {
  declineCount: number;
  lastDeclinedAt: Date | null;
  nextEligibleAt: Date | null;
};

export async function fetchAlphaInviteLatestDeclinedForNpc(params: {
  userId: string;
  npcId: string;
}): Promise<AlphaInviteDecayRow[]> {
  const { userId, npcId } = params;

  return asSystem(
    async (c) =>
      c
        .select({
          declineCount: groupInvites.declineCount,
          lastDeclinedAt: groupInvites.lastDeclinedAt,
          nextEligibleAt: groupInvites.nextEligibleAt,
        })
        .from(groupInvites)
        .innerJoin(groups, eq(groupInvites.groupId, groups.id))
        .where(
          and(
            eq(groupInvites.invitedUserId, userId),
            eq(groups.ownerId, npcId),
            eq(groupInvites.status, 'declined')
          )
        )
        .orderBy(desc(groupInvites.lastDeclinedAt))
        .limit(1),
    'alpha-invite-decay-check'
  );
}

export async function fetchAlphaInviteExistingMembershipForNpc(params: {
  userId: string;
  npcId: string;
}): Promise<{ id: string } | undefined> {
  const { userId, npcId } = params;

  const [row] = await asSystem(
    async (c) =>
      c
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            eq(groupMembers.userId, userId),
            eq(groupMembers.isActive, true),
            eq(groups.ownerId, npcId)
          )
        )
        .limit(1),
    'alpha-invite-existing-membership'
  );

  return row;
}

export async function countAlphaInviteActiveNpcGroupsForUser(
  userId: string
): Promise<number> {
  const [result] = await asSystem(
    async (c) =>
      c
        .select({ count: count() })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            eq(groupMembers.userId, userId),
            eq(groupMembers.isActive, true),
            eq(groups.type, 'npc')
          )
        ),
    'alpha-invite-group-limit'
  );

  return Number(result?.count ?? 0);
}

export async function fetchAlphaInviteLatestNpcMembershipJoinedAt(
  userId: string
): Promise<{ joinedAt: Date } | undefined> {
  const [row] = await asSystem(
    async (c) =>
      c
        .select({ joinedAt: groupMembers.joinedAt })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            eq(groupMembers.userId, userId),
            eq(groupMembers.isActive, true),
            eq(groups.type, 'npc')
          )
        )
        .orderBy(desc(groupMembers.joinedAt))
        .limit(1),
    'alpha-invite-cooldown'
  );

  return row;
}

export async function countAlphaInviteWeeklyPendingOrAccepted(params: {
  userId: string;
  since: Date;
}): Promise<number> {
  const { userId, since } = params;

  const [result] = await asSystem(
    async (c) =>
      c
        .select({ count: count() })
        .from(groupInvites)
        .where(
          and(
            eq(groupInvites.invitedUserId, userId),
            gte(groupInvites.invitedAt, since),
            or(
              eq(groupInvites.status, 'pending'),
              eq(groupInvites.status, 'accepted')
            )
          )
        ),
    'alpha-invite-weekly-limit'
  );

  return Number(result?.count ?? 0);
}

export async function countAlphaInviteUserInteractionsSince(params: {
  userId: string;
  since: Date;
}): Promise<number> {
  const { userId, since } = params;

  const [result] = await asSystem(
    async (c) =>
      c
        .select({ count: count() })
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.userId, userId),
            gte(userInteractions.timestamp, since)
          )
        ),
    'alpha-invite-recent-activity'
  );

  return Number(result?.count ?? 0);
}

export async function runAlphaGroupInviteRecordDecline(params: {
  inviteId: string;
  nextEligibleForDeclineCount: (newDeclineCount: number) => Date;
}): Promise<{ newDeclineCount: number; nextEligibleAt: Date } | null> {
  const { inviteId, nextEligibleForDeclineCount } = params;

  return asSystem(async (c) => {
    const [invite] = await c
      .select({
        declineCount: groupInvites.declineCount,
      })
      .from(groupInvites)
      .where(eq(groupInvites.id, inviteId))
      .limit(1);

    if (!invite) return null;

    const newDeclineCount = (invite.declineCount ?? 0) + 1;
    const nextEligibleAt = nextEligibleForDeclineCount(newDeclineCount);

    await c
      .update(groupInvites)
      .set({
        status: 'declined',
        respondedAt: new Date(),
        declineCount: newDeclineCount,
        lastDeclinedAt: new Date(),
        nextEligibleAt,
      })
      .where(eq(groupInvites.id, inviteId));

    return { newDeclineCount, nextEligibleAt };
  }, 'alpha-invite-record-decline');
}

export type AlphaInviteStatsRow = {
  totalMembers: number;
  activeMembers: number;
  joinedLast24h: number;
  tierCounts: Array<{ tier: number | null; count: number }>;
};

export async function fetchAlphaInviteAggregateStats(params: {
  joinedSince: Date;
}): Promise<AlphaInviteStatsRow> {
  const { joinedSince } = params;

  return asSystem(async (c) => {
    const [[totalResult], [activeResult], [recentResult], tierCounts] =
      await Promise.all([
        c.select({ count: count() }).from(groupMembers),
        c
          .select({ count: count() })
          .from(groupMembers)
          .where(eq(groupMembers.isActive, true)),
        c
          .select({ count: count() })
          .from(groupMembers)
          .where(gte(groupMembers.joinedAt, joinedSince)),
        c
          .select({
            tier: groupMembers.tier,
            count: count(),
          })
          .from(groupMembers)
          .where(eq(groupMembers.isActive, true))
          .groupBy(groupMembers.tier),
      ]);

    return {
      totalMembers: Number(totalResult?.count ?? 0),
      activeMembers: Number(activeResult?.count ?? 0),
      joinedLast24h: Number(recentResult?.count ?? 0),
      tierCounts: tierCounts.map((tc) => ({
        tier: tc.tier,
        count: Number(tc.count),
      })),
    };
  }, 'alpha-invite-stats');
}

export async function fetchAlphaInviteDeclineAnalytics(params: {
  inviteDecayMaxDeclines: number;
}): Promise<{
  totalDeclined: number;
  usersAtMaxDeclines: number;
}> {
  const { inviteDecayMaxDeclines } = params;

  return asSystem(async (c) => {
    const [dr] = await c
      .select({
        count: count(),
      })
      .from(groupInvites)
      .where(eq(groupInvites.status, 'declined'));

    const [mdr] = await c
      .select({ count: count() })
      .from(groupInvites)
      .where(
        and(
          eq(groupInvites.status, 'declined'),
          gte(groupInvites.declineCount, inviteDecayMaxDeclines)
        )
      );

    return {
      totalDeclined: Number(dr?.count ?? 0),
      usersAtMaxDeclines: Number(mdr?.count ?? 0),
    };
  }, 'alpha-invite-decline-analytics');
}
