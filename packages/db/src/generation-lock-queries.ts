/**
 * Drizzle for `@babylon/api` `DistributedLockService` (GenerationLock rows).
 */

import { and, eq, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { generationLocks } from './tables/generation-locks';

type LockDb = DrizzleClient | Transaction;

export async function updateGenerationLockTakeIfExpired(
  client: LockDb,
  params: {
    lockId: string;
    lockHolder: string;
    now: Date;
    expiresAt: Date;
    operation: string;
  }
): Promise<boolean> {
  const { lockId, lockHolder, now, expiresAt, operation } = params;
  const updateResult = await client
    .update(generationLocks)
    .set({
      lockedBy: lockHolder,
      lockedAt: now,
      expiresAt,
      operation,
    })
    .where(
      and(eq(generationLocks.id, lockId), lte(generationLocks.expiresAt, now))
    )
    .returning({ id: generationLocks.id });
  return updateResult.length > 0;
}

export async function selectGenerationLockById(
  client: LockDb,
  lockId: string
): Promise<typeof generationLocks.$inferSelect | undefined> {
  const [row] = await client
    .select()
    .from(generationLocks)
    .where(eq(generationLocks.id, lockId))
    .limit(1);
  return row;
}

export async function insertGenerationLockOnConflictDoNothing(
  client: LockDb,
  values: typeof generationLocks.$inferInsert
): Promise<boolean> {
  const insertResult = await client
    .insert(generationLocks)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: generationLocks.id });
  return insertResult.length > 0;
}

export async function deleteGenerationLockIfHeldBy(
  client: LockDb,
  lockId: string,
  lockedBy: string
): Promise<boolean> {
  const deleteResult = await client
    .delete(generationLocks)
    .where(
      and(
        eq(generationLocks.id, lockId),
        eq(generationLocks.lockedBy, lockedBy)
      )
    )
    .returning({ id: generationLocks.id });
  return deleteResult.length > 0;
}
