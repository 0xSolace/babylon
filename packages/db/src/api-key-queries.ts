/**
 * Drizzle for `@babylon/api` user API key maintenance (e.g. `lastUsedAt`).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { userApiKeys } from './tables/user-api-keys';

type ApiKeyDb = DrizzleClient | Transaction;

export async function updateUserApiKeyLastUsedAt(
  client: ApiKeyDb,
  keyId: string,
  at: Date
): Promise<void> {
  await client
    .update(userApiKeys)
    .set({ lastUsedAt: at })
    .where(eq(userApiKeys.id, keyId));
}
