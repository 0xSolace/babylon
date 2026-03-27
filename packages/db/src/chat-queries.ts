/**
 * Lightweight chat row reads shared across API, agents, and notifications.
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { chats } from './tables/chats';

export async function fetchChatNameById(
  chatId: string
): Promise<string | null> {
  const [row] = await db
    .select({ name: chats.name })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  return row?.name ?? null;
}
