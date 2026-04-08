/**
 * SQL for `packages/agents` autonomous `DirectExecutors` (social, DM, perp slice).
 */

import { aliasedTable, and, eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NewFollow } from './model-types';
import { actorState } from './tables/actor-state';
import type { NewChatParticipant } from './tables/chat-participants';
import { chatParticipants } from './tables/chat-participants';
import type { NewChat } from './tables/chats';
import { chats } from './tables/chats';
import type { NewComment } from './tables/comments';
import { comments } from './tables/comments';
import type { NewDMAcceptance } from './tables/dm-acceptances';
import { dmAcceptances } from './tables/dm-acceptances';
import { follows } from './tables/follows';
import type { PerpPosition } from './tables/perp-positions';
import { perpPositions } from './tables/perp-positions';
import type { NewPost } from './tables/posts';
import { posts } from './tables/posts';
import type { NewReaction } from './tables/reactions';
import { reactions } from './tables/reactions';
import type { NewShare } from './tables/shares';
import { shares } from './tables/shares';
import { users } from './tables/user';

type ExecDb = DrizzleClient | Transaction;

export async function selectOpenPerpPositionByUserIdTicker(
  db: ExecDb,
  userId: string,
  ticker: string
): Promise<PerpPosition | undefined> {
  const [row] = await db
    .select()
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.userId, userId),
        eq(perpPositions.ticker, ticker),
        isNull(perpPositions.closedAt)
      )
    )
    .limit(1);
  return row;
}

export async function insertPostRowForDirectExecutor(
  db: ExecDb,
  row: NewPost
): Promise<void> {
  await db.insert(posts).values(row);
}

export async function selectPostIdById(
  db: ExecDb,
  postId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function selectExistingDirectCommentReply(
  db: ExecDb,
  postId: string,
  authorId: string,
  parentCommentId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        eq(comments.authorId, authorId),
        eq(comments.parentCommentId, parentCommentId)
      )
    )
    .limit(1);
  return row;
}

export async function selectCommentIdById(
  db: ExecDb,
  commentId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export async function selectExistingDirectTopLevelComment(
  db: ExecDb,
  postId: string,
  authorId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        eq(comments.authorId, authorId),
        isNull(comments.parentCommentId)
      )
    )
    .limit(1);
  return row;
}

export async function insertCommentRowForDirectExecutor(
  db: ExecDb,
  row: NewComment
): Promise<void> {
  await db.insert(comments).values(row);
}

export async function selectUserManagedByById(
  db: ExecDb,
  userId: string
): Promise<{ managedBy: string | null } | undefined> {
  const [row] = await db
    .select({ managedBy: users.managedBy })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserIdOnlyById(
  db: ExecDb,
  userId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectActorStateIdOnlyById(
  db: ExecDb,
  id: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: actorState.id })
    .from(actorState)
    .where(eq(actorState.id, id))
    .limit(1);
  return row;
}

export async function selectDmChatIdBetweenUsers(
  db: ExecDb,
  agentUserId: string,
  recipientId: string
): Promise<{ chatId: string } | undefined> {
  const recipientSide = aliasedTable(chatParticipants, 'cp_dm_recipient');
  const [row] = await db
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
    .innerJoin(recipientSide, eq(chatParticipants.chatId, recipientSide.chatId))
    .where(
      and(
        eq(chatParticipants.userId, agentUserId),
        eq(chats.isGroup, false),
        eq(recipientSide.userId, recipientId)
      )
    )
    .limit(1);
  return row;
}

export async function insertDirectExecutorDmChatBundle(
  tx: Transaction,
  params: {
    chat: NewChat;
    participants: [NewChatParticipant, NewChatParticipant];
    dmAcceptance: NewDMAcceptance;
  }
): Promise<void> {
  await tx.insert(chats).values(params.chat);
  await tx
    .insert(chatParticipants)
    .values([params.participants[0], params.participants[1]]);
  await tx.insert(dmAcceptances).values(params.dmAcceptance);
}

export async function selectChatIdById(
  db: ExecDb,
  chatId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

export async function selectChatParticipantUserIdsByChatId(
  db: ExecDb,
  chatId: string
): Promise<{ userId: string }[]> {
  return db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, chatId));
}

export async function selectUserIdAndIsActorById(
  db: ExecDb,
  userId: string
): Promise<{ id: string; isActor: boolean } | undefined> {
  const [row] = await db
    .select({ id: users.id, isActor: users.isActor })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function insertFollowOnConflictDoNothingReturningId(
  db: ExecDb,
  row: NewFollow
): Promise<{ id: string }[]> {
  return db
    .insert(follows)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: follows.id });
}

export async function deleteFollowByFollowerAndFollowingReturningId(
  db: ExecDb,
  followerId: string,
  followingId: string
): Promise<{ id: string }[]> {
  return db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    )
    .returning({ id: follows.id });
}

export async function insertReactionLikeOnConflictDoNothingReturningId(
  db: ExecDb,
  row: NewReaction
): Promise<{ id: string }[]> {
  return db
    .insert(reactions)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: reactions.id });
}

export type DirectExecutorPostRepostSliceRow = {
  id: string;
  authorId: string;
  content: string;
  originalPostId: string | null;
};

export async function selectPostRepostSliceById(
  db: ExecDb,
  postId: string
): Promise<DirectExecutorPostRepostSliceRow | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      content: posts.content,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function insertShareAndOptionalQuotePostInTransaction(
  tx: Transaction,
  params: { share: NewShare; quotePost?: NewPost }
): Promise<void> {
  await tx.insert(shares).values(params.share);
  if (params.quotePost) {
    await tx.insert(posts).values(params.quotePost);
  }
}

export async function selectShareIdByUserIdAndPostId(
  db: ExecDb,
  userId: string,
  postId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(and(eq(shares.postId, postId), eq(shares.userId, userId)))
    .limit(1);
  return row;
}
