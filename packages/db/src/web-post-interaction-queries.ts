/**
 * SQL for `apps/web` post like/unlike, share/unshare, interaction summary, post detail GET, and soft delete.
 */

import { and, count, eq, isNull, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import type { Post } from './tables/posts';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';

type PostIxDb = DrizzleClient | Transaction;

export async function selectPostById(
  db: PostIxDb,
  postId: string
): Promise<Post | undefined> {
  const [row] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function selectPostByIdWhereTimestampLte(
  db: PostIxDb,
  postId: string,
  at: Date
): Promise<Post | undefined> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), lte(posts.timestamp, at)))
    .limit(1);
  return row;
}

export async function insertGamePostStubReturning(
  db: PostIxDb,
  params: {
    id: string;
    content: string;
    authorId: string;
    gameId: string;
    timestamp: Date;
  }
): Promise<Post | undefined> {
  const [row] = await db
    .insert(posts)
    .values({
      id: params.id,
      content: params.content,
      authorId: params.authorId,
      gameId: params.gameId,
      timestamp: params.timestamp,
    })
    .returning();
  return row;
}

export async function insertGamePostStubIfNotExists(
  db: PostIxDb,
  params: {
    id: string;
    content: string;
    authorId: string;
    gameId: string;
    timestamp: Date;
  }
): Promise<void> {
  const [existing] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, params.id))
    .limit(1);
  if (existing) return;
  await db.insert(posts).values({
    id: params.id,
    content: params.content,
    authorId: params.authorId,
    gameId: params.gameId,
    timestamp: params.timestamp,
  });
}

export async function selectPostLikeReactionIdForUser(
  db: PostIxDb,
  params: { postId: string; userId: string }
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.postId, params.postId),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    )
    .limit(1);
  return row;
}

export async function insertPostLikeReaction(
  db: PostIxDb,
  params: { id: string; postId: string; userId: string }
): Promise<void> {
  await db.insert(reactions).values({
    id: params.id,
    postId: params.postId,
    userId: params.userId,
    type: 'like',
  });
}

export async function countPostLikesForPostId(
  db: PostIxDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(reactions)
    .where(and(eq(reactions.postId, postId), eq(reactions.type, 'like')));
  return Number(row?.c ?? 0);
}

export type PostShareTargetSlice = {
  id: string;
  content: string;
  deletedAt: Date | null;
  authorId: string;
  timestamp: Date;
  originalPostId: string | null;
};

export async function selectPostShareTargetSliceById(
  db: PostIxDb,
  postId: string
): Promise<PostShareTargetSlice | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      deletedAt: posts.deletedAt,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function selectShareIdForUserAndPost(
  db: PostIxDb,
  params: { userId: string; postId: string }
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(eq(shares.userId, params.userId), eq(shares.postId, params.postId))
    )
    .limit(1);
  return row;
}

export async function insertShareRow(
  db: PostIxDb,
  params: { id: string; userId: string; postId: string }
): Promise<void> {
  await db.insert(shares).values({
    id: params.id,
    userId: params.userId,
    postId: params.postId,
  });
}

export async function countSharesForPostId(
  db: PostIxDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(shares)
    .where(eq(shares.postId, postId));
  return Number(row?.c ?? 0);
}

export type OriginalPostAuthorSlice = {
  content: string;
  authorId: string;
  timestamp: Date;
};

export async function selectOriginalPostContentAuthorTimestamp(
  db: PostIxDb,
  postId: string
): Promise<OriginalPostAuthorSlice | undefined> {
  const [row] = await db
    .select({
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export type UserDisplayProfileSlice = {
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectUserUsernameDisplayProfileById(
  db: PostIxDb,
  userId: string
): Promise<UserDisplayProfileSlice | undefined> {
  const [row] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function insertRepostPostReturning(
  db: PostIxDb,
  params: {
    id: string;
    content: string;
    authorId: string;
    timestamp: Date;
    originalPostId: string;
  }
): Promise<Post | undefined> {
  const [row] = await db
    .insert(posts)
    .values({
      id: params.id,
      content: params.content,
      authorId: params.authorId,
      timestamp: params.timestamp,
      originalPostId: params.originalPostId,
    })
    .returning();
  return row;
}

export async function selectPostAuthorIdById(
  db: PostIxDb,
  postId: string
): Promise<{ authorId: string } | undefined> {
  const [row] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function selectUserIdExists(
  db: PostIxDb,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row;
}

export async function selectRepostPostIdForAuthorAndOriginal(
  db: PostIxDb,
  params: { authorId: string; originalPostId: string }
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, params.authorId),
        eq(posts.originalPostId, params.originalPostId),
        isNull(posts.deletedAt)
      )
    )
    .limit(1);
  return row;
}

export async function deletePostById(
  db: PostIxDb,
  postId: string
): Promise<void> {
  await db.delete(posts).where(eq(posts.id, postId));
}

export async function deleteShareById(
  db: PostIxDb,
  shareId: string
): Promise<void> {
  await db.delete(shares).where(eq(shares.id, shareId));
}

export type PostIdOriginalSlice = {
  id: string;
  content: string;
  originalPostId: string | null;
};

export async function selectPostIdContentOriginalById(
  db: PostIxDb,
  postId: string
): Promise<PostIdOriginalSlice | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export type PostInteractionGateRow = {
  id: string;
  deletedAt: Date | null;
  timestamp: Date;
};

export async function selectPostInteractionGateById(
  db: PostIxDb,
  postId: string
): Promise<PostInteractionGateRow | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      deletedAt: posts.deletedAt,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function countCommentsForPostId(
  db: PostIxDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(comments)
    .where(eq(comments.postId, postId));
  return Number(row?.c ?? 0);
}

export type PostAuthorContentSlice = {
  authorId: string;
  content: string;
};

export async function selectPostAuthorIdContentById(
  db: PostIxDb,
  postId: string
): Promise<PostAuthorContentSlice | undefined> {
  const [row] = await db
    .select({ authorId: posts.authorId, content: posts.content })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function selectPostByIdNotDeleted(
  db: PostIxDb,
  postId: string
): Promise<Post | undefined> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  return row;
}

export type PostSoftDeleteSlice = {
  id: string;
  authorId: string;
  deletedAt: Date | null;
};

export async function selectPostSoftDeleteSliceById(
  db: PostIxDb,
  postId: string
): Promise<PostSoftDeleteSlice | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      deletedAt: posts.deletedAt,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function updatePostDeletedAtById(
  db: PostIxDb,
  postId: string,
  deletedAt: Date
): Promise<void> {
  await db.update(posts).set({ deletedAt }).where(eq(posts.id, postId));
}

export type UserDisplayNameUsernameSlice = {
  displayName: string | null;
  username: string | null;
};

export async function selectUserDisplayNameUsernameById(
  db: PostIxDb,
  userId: string
): Promise<UserDisplayNameUsernameSlice | undefined> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function insertUserAuthoredPostReturning(
  db: PostIxDb,
  params: {
    id: string;
    content: string;
    authorId: string;
    timestamp: Date;
  }
): Promise<Post | undefined> {
  const [row] = await db
    .insert(posts)
    .values({
      id: params.id,
      content: params.content,
      authorId: params.authorId,
      timestamp: params.timestamp,
    })
    .returning();
  return row;
}
