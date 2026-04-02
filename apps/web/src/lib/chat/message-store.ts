/**
 * IndexedDB persistence layer for chat messages.
 *
 * Stores the most recent messages per chat so conversations load instantly
 * on page refresh or return visit. Uses idb-keyval for a simple key/value
 * interface over IndexedDB.
 *
 * Storage limits:
 * - 100 most recent messages per chat (~30 KB per chat)
 * - 50 most recently accessed chats (LRU eviction)
 * - Total: ~1.5 MB — well within IndexedDB quotas
 */

import { del, get, set } from 'idb-keyval';
import type { ChatMessage, ChatMessagesData } from '@/hooks/useChatMessages';

const MAX_CACHED_MESSAGES_PER_CHAT = 100;
const MAX_CACHED_CHATS = 50;

interface CachedChatMessages {
  chatId: string;
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  cachedAt: number;
}

const STORE_KEY_PREFIX = 'chat-msgs:';
const INDEX_KEY = 'chat-msgs-index';

const isBrowser = typeof window !== 'undefined';

export async function getCachedMessages(
  chatId: string
): Promise<CachedChatMessages | null> {
  if (!isBrowser) return null;
  const cached = await get<CachedChatMessages>(`${STORE_KEY_PREFIX}${chatId}`);
  return cached ?? null;
}

export async function setCachedMessages(
  chatId: string,
  data: ChatMessagesData
): Promise<void> {
  if (!isBrowser) return;
  const trimmed: CachedChatMessages = {
    chatId,
    messages: data.messages.slice(-MAX_CACHED_MESSAGES_PER_CHAT),
    hasMore: data.hasMore,
    nextCursor: data.nextCursor,
    cachedAt: Date.now(),
  };
  await set(`${STORE_KEY_PREFIX}${chatId}`, trimmed);

  // Update LRU index and evict old chats if over limit.
  // Multi-tab note: concurrent writes are last-write-wins on the index key.
  // This is acceptable — per-chat data keys survive regardless, and the index
  // is only used for startup hydration and eviction.
  const index = (await get<string[]>(INDEX_KEY)) ?? [];
  const updated = [chatId, ...index.filter((id) => id !== chatId)];
  if (updated.length > MAX_CACHED_CHATS) {
    const evicted = updated.splice(MAX_CACHED_CHATS);
    await Promise.all(evicted.map((id) => del(`${STORE_KEY_PREFIX}${id}`)));
  }
  await set(INDEX_KEY, updated);
}

/**
 * Returns the chat IDs stored in IndexedDB (most recent first), capped at `limit`.
 */
export async function getCachedChatIds(limit = 10): Promise<string[]> {
  if (!isBrowser) return [];
  const index = await get<string[]>(INDEX_KEY);
  if (!index) return [];
  return index.slice(0, limit);
}
