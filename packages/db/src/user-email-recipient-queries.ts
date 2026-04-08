/**
 * Drizzle for `@babylon/api` batch user email fields (e.g. whitelist welcome).
 */

import { inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type MailDb = DrizzleClient | Transaction;

export type UserEmailRecipientRow = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  privyId: string | null;
};

export async function selectUsersEmailRecipientRows(
  client: MailDb,
  userIds: string[]
): Promise<UserEmailRecipientRow[]> {
  if (userIds.length === 0) return [];
  return client
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      privyId: users.privyId,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}
