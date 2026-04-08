/**
 * Count queries for GET /api/admin/alpha-groups/stats (system RLS `DrizzleClient`).
 */

import { and, count, eq, gte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { groupInvites } from './tables/group-invites';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';

type AlphaStatsDb = DrizzleClient | Transaction;

/** Parallel counts in the same order as the former route `Promise.all`. */
export async function fetchAdminAlphaGroupStatsCountTuple(
  db: AlphaStatsDb,
  params: {
    oneDayAgo: Date;
    oneWeekAgo: Date;
    inviteDecayMaxDeclines: number;
  }
): Promise<
  [
    pendingInvites: number,
    acceptedInvites: number,
    declinedInvites: number,
    grandfatheredMembers: number,
    usersWithDeclines: number,
    usersAtMaxDeclines: number,
    tier1Members: number,
    tier2Members: number,
    tier3Members: number,
    invitesLast24h: number,
    invitesLastWeek: number,
    joinsLast24h: number,
    joinsLastWeek: number,
  ]
> {
  const { oneDayAgo, oneWeekAgo, inviteDecayMaxDeclines } = params;

  return Promise.all([
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(eq(groupInvites.status, 'pending'))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(eq(groupInvites.status, 'accepted'))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(eq(groupInvites.status, 'declined'))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.isActive, true),
          eq(groupMembers.isGrandfathered, true)
        )
      )
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(gte(groupInvites.declineCount, 1))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(gte(groupInvites.declineCount, inviteDecayMaxDeclines))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc'),
          eq(groupMembers.tier, 1)
        )
      )
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc'),
          eq(groupMembers.tier, 2)
        )
      )
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc'),
          eq(groupMembers.tier, 3)
        )
      )
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(gte(groupInvites.invitedAt, oneDayAgo))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupInvites)
      .where(gte(groupInvites.invitedAt, oneWeekAgo))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groups.type, 'npc'), gte(groupMembers.joinedAt, oneDayAgo)))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(eq(groups.type, 'npc'), gte(groupMembers.joinedAt, oneWeekAgo))
      )
      .then((r) => r[0]?.count ?? 0),
  ]);
}
