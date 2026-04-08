/**
 * SQL for agent plugin mutations (perp/position reads, comments, config, team providers).
 */

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type {
  NewAgentLog,
  NewAgentTrade,
  NewComment,
  NewMessage,
} from './model-types';
import { agentLogs } from './tables/agent-logs';
import { agentTrades } from './tables/agent-trades';
import { chatParticipants } from './tables/chat-participants';
import { comments } from './tables/comments';
import { type Message, messages } from './tables/messages';
import type { PerpPosition } from './tables/perp-positions';
import { perpPositions } from './tables/perp-positions';
import type { Position } from './tables/positions';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { users } from './tables/user';
import type { PriceAlert } from './tables/user-agent-configs';
import { userAgentConfigs } from './tables/user-agent-configs';

type MutDb = DrizzleClient | Transaction;

export async function selectOpenPerpPositionForUserById(
  db: MutDb,
  positionId: string,
  userId: string
): Promise<PerpPosition | undefined> {
  const [row] = await db
    .select()
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.id, positionId),
        eq(perpPositions.userId, userId),
        isNull(perpPositions.closedAt)
      )
    )
    .limit(1);
  return row;
}

export async function selectActivePredictionPositionForUser(
  db: MutDb,
  positionId: string,
  userId: string
): Promise<Position | undefined> {
  const [row] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, positionId),
        eq(positions.userId, userId),
        eq(positions.status, 'active')
      )
    )
    .limit(1);
  return row;
}

export type ActivePostIdAuthorRow = { id: string; authorId: string };

export async function selectActivePostIdAndAuthorId(
  db: MutDb,
  postId: string
): Promise<ActivePostIdAuthorRow | undefined> {
  const [row] = await db
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  return row;
}

export type ActiveCommentPostLinkRow = { id: string; postId: string };

export async function selectActiveCommentIdAndPostId(
  db: MutDb,
  commentId: string
): Promise<ActiveCommentPostLinkRow | undefined> {
  const [row] = await db
    .select({ id: comments.id, postId: comments.postId })
    .from(comments)
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
    .limit(1);
  return row;
}

export async function insertCommentRow(
  db: MutDb,
  row: NewComment
): Promise<void> {
  await db.insert(comments).values(row);
}

export type UserAgentConfigPriceAlertRow = {
  id: string;
  priceAlerts: PriceAlert[] | null;
};

export async function selectUserAgentConfigPriceAlertRowByUserId(
  db: MutDb,
  userId: string
): Promise<UserAgentConfigPriceAlertRow | undefined> {
  const [row] = await db
    .select({
      id: userAgentConfigs.id,
      priceAlerts: userAgentConfigs.priceAlerts,
    })
    .from(userAgentConfigs)
    .where(eq(userAgentConfigs.userId, userId))
    .limit(1);
  return row;
}

export async function selectUserAgentConfigPriceAlertsOnlyByUserId(
  db: MutDb,
  userId: string
): Promise<{ priceAlerts: PriceAlert[] | null } | undefined> {
  const [row] = await db
    .select({ priceAlerts: userAgentConfigs.priceAlerts })
    .from(userAgentConfigs)
    .where(eq(userAgentConfigs.userId, userId))
    .limit(1);
  return row;
}

export async function updateUserAgentConfigPriceAlertsById(
  db: MutDb,
  configId: string,
  priceAlerts: PriceAlert[],
  updatedAt: Date
): Promise<void> {
  await db
    .update(userAgentConfigs)
    .set({ priceAlerts, updatedAt })
    .where(eq(userAgentConfigs.id, configId));
}

export type UserIdIsAgentRow = { id: string; isAgent: boolean };

export type UserPrincipalRow = {
  id: string;
  isAgent: boolean;
  managedBy: string | null;
};

/** Agent ownership checks (e.g. price alerts API). */
export async function selectUserPrincipalById(
  db: MutDb,
  userId: string
): Promise<UserPrincipalRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      isAgent: users.isAgent,
      managedBy: users.managedBy,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserIdAndIsAgent(
  db: MutDb,
  userId: string
): Promise<UserIdIsAgentRow | undefined> {
  const [row] = await db
    .select({ id: users.id, isAgent: users.isAgent })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type AutonomyConfigPatch = Partial<{
  autonomousTrading: boolean;
  autonomousPosting: boolean;
  autonomousCommenting: boolean;
  autonomousDMs: boolean;
  autonomousGroupChats: boolean;
}>;

export async function upsertUserAgentConfigAutonomyPatch(
  db: MutDb,
  params: {
    userId: string;
    newRowId: string;
    patch: AutonomyConfigPatch;
    now: Date;
  }
): Promise<void> {
  await db
    .insert(userAgentConfigs)
    .values({
      id: params.newRowId,
      userId: params.userId,
      ...params.patch,
      updatedAt: params.now,
    })
    .onConflictDoUpdate({
      target: userAgentConfigs.userId,
      set: { ...params.patch, updatedAt: params.now },
    });
}

export async function insertAgentLogRow(
  db: MutDb,
  row: NewAgentLog
): Promise<void> {
  await db.insert(agentLogs).values(row);
}

export async function insertAgentTradeRow(
  db: MutDb,
  row: NewAgentTrade
): Promise<void> {
  await db.insert(agentTrades).values(row);
}

export async function insertMessageRow(
  db: MutDb,
  row: NewMessage
): Promise<void> {
  await db.insert(messages).values(row);
}

export async function selectUserAgentConfigModelTiersForUserIds(
  db: MutDb,
  userIds: string[]
): Promise<{ userId: string; modelTier: string }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: userAgentConfigs.userId,
      modelTier: userAgentConfigs.modelTier,
    })
    .from(userAgentConfigs)
    .where(inArray(userAgentConfigs.userId, userIds));
}

export async function updateUserAgentConfigLastChatAtByUserId(
  db: MutDb,
  userId: string,
  at: Date
): Promise<void> {
  await db
    .update(userAgentConfigs)
    .set({ lastChatAt: at, updatedAt: at })
    .where(eq(userAgentConfigs.userId, userId));
}

/** Team chat slice: participant’s own sends + owner messages that @ target that participant (agent or coordinator id). */
export async function selectTeamChatMessagesForParticipantContext(
  db: MutDb,
  params: {
    teamChatId: string;
    participantId: string;
    ownerId: string;
    limit: number;
  }
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.chatId, params.teamChatId),
        or(
          eq(messages.senderId, params.participantId),
          and(
            eq(messages.senderId, params.ownerId),
            sql`${messages.targetIds} @> ARRAY[${params.participantId}]::text[]`
          )
        )
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(params.limit);
}

export type TeamChatParticipantMemberRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  isAgent: boolean | null;
};

export async function selectActiveTeamChatParticipantsWithUsers(
  db: MutDb,
  teamChatId: string
): Promise<TeamChatParticipantMemberRow[]> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      isAgent: users.isAgent,
    })
    .from(chatParticipants)
    .innerJoin(users, eq(chatParticipants.userId, users.id))
    .where(
      and(
        eq(chatParticipants.chatId, teamChatId),
        eq(chatParticipants.isActive, true)
      )
    );
}

export type TeamChatAgentDispatchMessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  username: string | null;
  displayName: string | null;
};

/** Recent team-chat rows from senders who are agents (`users.isAgent`). */
export async function selectRecentTeamChatAgentMessagesWithSenders(
  db: MutDb,
  teamChatId: string,
  limit: number
): Promise<TeamChatAgentDispatchMessageRow[]> {
  return db
    .select({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      username: users.username,
      displayName: users.displayName,
    })
    .from(messages)
    .innerJoin(
      users,
      and(eq(messages.senderId, users.id), eq(users.isAgent, true))
    )
    .where(eq(messages.chatId, teamChatId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}
