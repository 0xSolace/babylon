import {
  countUsersStrictlyAheadForWhitelistRank,
  insertWhitelistRowsIgnoreDuplicateUser,
  listWhitelistEntriesJoinedUsers,
  selectActiveWhitelistExists,
  selectNftSnapshotUserIdsIn,
  selectTopNonActorUserIdsByLeaderboard,
  selectUserSliceForWhitelistLeaderboard,
  selectWhitelistActiveCountsBySource,
  selectWhitelistConfigById,
  selectWhitelistEntryIdRevoked,
  selectWhitelistEntrySourceRevoked,
  selectWhitelistUserRevokedForUserIds,
  updateWhitelistEntryRevokedAt,
  upsertWhitelistConfigRow,
  upsertWhitelistEntryActiveOrRevive,
  type WhitelistSourceValue,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { UserAlphaGroupAssignmentService } from '@babylon/engine';
import { logger } from '@babylon/shared';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WhitelistSource = WhitelistSourceValue;

interface AddToWhitelistParams {
  userId: string;
  source: WhitelistSource;
  reason?: string;
  grantedBy?: string;
}

interface UpdateWhitelistConfigParams {
  leaderboardRankThreshold: number | null;
  leaderboardCategory?: string;
  updatedBy?: string;
}

export const DEFAULT_WHITELIST_LEADERBOARD_THRESHOLD = 100;
export const MAX_WHITELIST_LEADERBOARD_THRESHOLD = 25_000;

export function normalizeWhitelistLeaderboardThreshold(
  value: number | null | undefined
): number {
  if (!Number.isFinite(value) || value === undefined || value === null) {
    return DEFAULT_WHITELIST_LEADERBOARD_THRESHOLD;
  }

  const normalized = Math.trunc(value);
  if (normalized < 1) {
    return DEFAULT_WHITELIST_LEADERBOARD_THRESHOLD;
  }

  return Math.min(normalized, MAX_WHITELIST_LEADERBOARD_THRESHOLD);
}

// ---------------------------------------------------------------------------
// Access checks
// ---------------------------------------------------------------------------

export async function isUserWhitelisted(userId: string): Promise<boolean> {
  return selectActiveWhitelistExists(db, userId);
}

export async function isUserWhitelistedByLeaderboard(
  userId: string
): Promise<boolean> {
  const threshold = await getEffectiveWhitelistLeaderboardThreshold();
  const user = await selectUserSliceForWhitelistLeaderboard(db, userId);

  if (!user || user.isActor || user.isAgent || !user.createdAt) {
    return false;
  }

  const ahead = await countUsersStrictlyAheadForWhitelistRank(db, {
    reputationPoints: user.reputationPoints,
    invitePoints: user.invitePoints,
    createdAt: user.createdAt,
    id: user.id,
  });

  const rank = ahead + 1;
  return rank <= threshold;
}

export async function checkWhitelistAccess(
  userId: string
): Promise<{ allowed: boolean; source: string | null }> {
  const entry = await selectWhitelistEntrySourceRevoked(db, userId);

  if (entry?.revokedAt) {
    return { allowed: false, source: null };
  }

  if (entry) {
    return { allowed: true, source: entry.source };
  }

  const leaderboardAllowed = await isUserWhitelistedByLeaderboard(userId);
  if (leaderboardAllowed) {
    return { allowed: true, source: 'leaderboard' };
  }

  return { allowed: false, source: null };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function addToWhitelist({
  userId,
  source,
  reason,
  grantedBy,
}: AddToWhitelistParams): Promise<{ id: string; alreadyExists: boolean }> {
  const id = nanoid();
  const now = new Date();
  const nowISO = now.toISOString();

  const result = await upsertWhitelistEntryActiveOrRevive(db, {
    newRowId: id,
    userId,
    source,
    reason: reason ?? null,
    grantedBy: grantedBy ?? null,
    grantedAt: now,
    nowISO,
  });

  if (!result) throw new Error('Whitelist upsert returned no rows');

  const alreadyExists = result.id !== id;

  if (!alreadyExists) {
    UserAlphaGroupAssignmentService.assignDefaultGroups(userId)
      .then((assignmentResult) => {
        if (assignmentResult.groupsAssigned > 0) {
          logger.info(
            'Assigned default alpha groups to whitelisted user',
            {
              userId,
              groupsAssigned: assignmentResult.groupsAssigned,
              source,
            },
            'addToWhitelist'
          );
        }
      })
      .catch((error) => {
        logger.error(
          'Failed to assign default alpha groups to whitelisted user',
          { userId, error: String(error) },
          'addToWhitelist'
        );
      });
  }

  return { id: result.id, alreadyExists };
}

export async function removeFromWhitelist(
  userId: string
): Promise<{ removed: boolean }> {
  const entry = await selectWhitelistEntryIdRevoked(db, userId);

  if (!entry) return { removed: false };
  if (entry.revokedAt) return { removed: false };

  await updateWhitelistEntryRevokedAt(db, entry.id, new Date());

  return { removed: true };
}

export async function listWhitelistEntries(options?: {
  source?: WhitelistSource;
  includeRevoked?: boolean;
  search?: string;
}) {
  const results = await listWhitelistEntriesJoinedUsers(db, {
    source: options?.source,
    includeRevoked: options?.includeRevoked,
  });

  if (options?.search) {
    const q = options.search.toLowerCase();
    return results.filter(
      (r) =>
        r.username?.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q) ||
        r.walletAddress?.toLowerCase().includes(q) ||
        r.displayName?.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function getWhitelistStats() {
  const entries = await selectWhitelistActiveCountsBySource(db);

  const stats = {
    total: 0,
    snapshot_first_100: 0,
    admin_manual: 0,
    leaderboard: 0,
  };

  for (const entry of entries) {
    const count = Number(entry.count);
    stats.total += count;
    if (entry.source in stats) {
      stats[entry.source as WhitelistSource] = count;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONFIG_ID = 'default';

export async function getWhitelistConfig() {
  const config = await selectWhitelistConfigById(db, CONFIG_ID);
  return config ?? null;
}

export async function getEffectiveWhitelistLeaderboardThreshold(): Promise<number> {
  const config = await getWhitelistConfig();
  return normalizeWhitelistLeaderboardThreshold(
    config?.leaderboardRankThreshold
  );
}

export async function updateWhitelistConfig({
  leaderboardRankThreshold,
  leaderboardCategory,
  updatedBy,
}: UpdateWhitelistConfigParams) {
  const now = new Date();

  await upsertWhitelistConfigRow(db, {
    id: CONFIG_ID,
    leaderboardRankThreshold,
    leaderboardCategory,
    updatedAt: now,
    updatedBy: updatedBy ?? null,
  });
}

// ---------------------------------------------------------------------------
// Auto-Whitelist From Leaderboard
// ---------------------------------------------------------------------------

async function getAutoWhitelistTopN(): Promise<number> {
  return getEffectiveWhitelistLeaderboardThreshold();
}

export async function autoWhitelistCurrentTopN(): Promise<{
  topN: number;
  totalInTopN: number;
  inserted: number;
  skippedExisting: number;
  skippedRevoked: number;
}> {
  const topN = await getAutoWhitelistTopN();
  const topUsers = await selectTopNonActorUserIdsByLeaderboard(db, topN);
  const userIds = topUsers.map((user) => user.id);

  if (userIds.length === 0) {
    return {
      topN,
      totalInTopN: 0,
      inserted: 0,
      skippedExisting: 0,
      skippedRevoked: 0,
    };
  }

  const snapshotRows = await selectNftSnapshotUserIdsIn(db, userIds);
  const snapshotSet = new Set(snapshotRows.map((r) => r.userId));

  const existing = await selectWhitelistUserRevokedForUserIds(db, userIds);

  const existingMap = new Map(existing.map((e) => [e.userId, e.revokedAt]));
  const toInsert = userIds.filter(
    (id) => !snapshotSet.has(id) && !existingMap.has(id)
  );

  const skippedExisting = existing.length;
  const skippedRevoked = existing.filter((e) => e.revokedAt !== null).length;

  if (toInsert.length === 0) {
    return {
      topN,
      totalInTopN: userIds.length,
      inserted: 0,
      skippedExisting,
      skippedRevoked,
    };
  }

  const now = new Date();
  const rows = toInsert.map((userId) => ({
    id: nanoid(),
    userId,
    source: 'leaderboard' as WhitelistSource,
    reason: `Auto-whitelisted by leaderboard (Top ${topN})`,
    grantedBy: null,
    grantedAt: now,
  }));

  const insertedRows = await insertWhitelistRowsIgnoreDuplicateUser(db, rows);

  return {
    topN,
    totalInTopN: userIds.length,
    inserted: insertedRows.length,
    skippedExisting,
    skippedRevoked,
  };
}
