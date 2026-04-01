import { logger, type MessageMetadata } from '@babylon/shared';
import { usePrivy } from '@privy-io/react-auth';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type MessageReactionSummary,
  type MessageType,
  MessageTypeEnum,
  type ReplyToMessage,
} from '@/components/chats/types';
import { getPrivyAccessTokenSafely } from '@/lib/auth/privyAccessToken';
import { CHAT_PAGE_SIZE } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useSSEChannel } from './useSSE';
import { applyReactionDelta } from './useToggleReaction';

/**
 * Represents a chat message in the system.
 */
export interface ChatMessage {
  id: string;
  content: string;
  chatId: string;
  senderId: string;
  type?: MessageType;
  createdAt: string;
  isGameChat?: boolean;
  /** Stable key for React rendering - prevents flash when optimistic messages are replaced */
  stableKey?: string;
  /** Whether this message is a "thinking" placeholder (shows spinner while waiting for response) */
  isThinking?: boolean;
  /** Metadata containing action tags for sidebar display */
  metadata?: MessageMetadata | null;
  /** Aggregated emoji reactions summary (counts + whether current user reacted). */
  reactions?: MessageReactionSummary[];
  /** ID of the message this is replying to */
  replyToMessageId?: string | null;
  /** Denormalized snippet of the replied-to message */
  replyToMessage?: ReplyToMessage | null;
}

/** Raw message from API (createdAt may be string or Date) */
interface RawApiMessage {
  id: string;
  content: string;
  senderId: string;
  type?: MessageType;
  createdAt: string | Date;
  metadata?: MessageMetadata | null;
  reactions?: MessageReactionSummary[];
  replyToMessageId?: string | null;
  replyToMessage?: ReplyToMessage | null;
}

/** Format raw API message to ChatMessage */
function formatMessage(msg: RawApiMessage, chatId: string): ChatMessage {
  return {
    id: msg.id,
    content: msg.content,
    chatId,
    senderId: msg.senderId,
    type: msg.type,
    createdAt:
      typeof msg.createdAt === 'string'
        ? msg.createdAt
        : msg.createdAt.toISOString(),
    metadata: msg.metadata,
    reactions: msg.reactions,
    replyToMessageId: msg.replyToMessageId,
    replyToMessage: msg.replyToMessage,
  };
}

/**
 * Prefix for optimistic message IDs. Used so SSE/replaceOptimisticMessage can
 * match and replace placeholders instead of appending duplicates.
 */
export enum OptimisticMessageIdPrefix {
  /** User message not yet confirmed by server */
  Pending = 'pending-',
  /** Agent/coordinator response in progress (thinking placeholder) */
  Thinking = 'thinking-',
}

/**
 * Time window (ms) for matching optimistic messages to confirmed messages.
 * If a confirmed message arrives within this window of an optimistic message
 * with matching content and sender, they are considered the same message.
 */
const OPTIMISTIC_MATCH_WINDOW_MS = 30000;

/** Check if a message is an optimistic placeholder matching the incoming confirmed message */
export function isMatchingOptimistic(
  pending: ChatMessage,
  incoming: ChatMessage
): boolean {
  const inWindow =
    Math.abs(
      new Date(pending.createdAt).getTime() -
        new Date(incoming.createdAt).getTime()
    ) < OPTIMISTIC_MATCH_WINDOW_MS;
  if (pending.id.startsWith(OptimisticMessageIdPrefix.Pending)) {
    return (
      pending.senderId === incoming.senderId &&
      pending.content === incoming.content &&
      inWindow
    );
  }
  if (pending.id.startsWith(OptimisticMessageIdPrefix.Thinking)) {
    return pending.senderId === incoming.senderId && inWindow;
  }
  return false;
}

/**
 * Adds a confirmed message to the list, replacing any matching optimistic message.
 * Preserves the stableKey from the optimistic message to prevent React remount.
 * Merges metadata from SSE messages when a message with the same ID already exists.
 */
export function replaceOptimisticMessage(
  messages: ChatMessage[],
  confirmed: ChatMessage
): ChatMessage[] {
  // Check if message with same ID already exists
  const existingIdx = messages.findIndex((msg) => msg.id === confirmed.id);
  if (existingIdx >= 0) {
    const existingMsg = messages[existingIdx];
    // Merge metadata from confirmed message (SSE) into existing message
    // This handles the case where updateMessage is called first (without metadata)
    // and then SSE arrives with metadata
    if (confirmed.metadata && existingMsg && !existingMsg.metadata) {
      return messages.map((msg, idx) =>
        idx === existingIdx ? { ...msg, metadata: confirmed.metadata } : msg
      );
    }
    return messages;
  }

  // Replace optimistic message if found
  const pending = messages.find((msg) => isMatchingOptimistic(msg, confirmed));
  if (pending) {
    // Preserve the optimistic message's createdAt to maintain visual order
    // The server timestamp might differ due to network latency, but we want
    // to keep the message in the same position the user saw it
    return messages.map((msg) =>
      msg.id === pending.id
        ? {
            ...confirmed,
            stableKey: pending.stableKey || pending.id,
            createdAt: pending.createdAt,
          }
        : msg
    );
  }

  // Don't sort - just append. This preserves visual order during real-time chat.
  // Messages are already sorted when loaded from API.
  return [...messages, confirmed];
}

function reactionsEqual(
  a: MessageReactionSummary[] | undefined,
  b: MessageReactionSummary[] | undefined
): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const key = (r: MessageReactionSummary) =>
    `${r.emoji}:${r.count}:${r.reactedByMe ? 1 : 0}`;
  const as = [...a].map(key).sort().join('|');
  const bs = [...b].map(key).sort().join('|');
  return as === bs;
}

/** Polling interval — only used when SSE is disconnected */
const POLLING_INTERVAL_MS = 15000;

/**
 * React Query cache key for chat messages.
 * Exported so other modules can read/invalidate.
 */
export const chatMessagesQueryKey = (chatId: string) =>
  ['chat-messages', chatId] as const;

/**
 * Shape of the data stored in the React Query cache for a chat.
 * Bundles messages with pagination state so they stay in sync.
 */
export interface ChatMessagesData {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Hook for managing chat messages with React Query caching + real-time SSE updates.
 *
 * Uses React Query for in-memory caching so switching between chats is instant
 * on return visits (gcTime: 30 min). SSE pushes live messages via
 * queryClient.setQueryData. Polling fallback only activates when SSE drops.
 *
 * @param chatId - The ID of the chat to load messages for, or null to clear.
 */
export function useChatMessages(chatId: string | null) {
  const { getAccessToken } = usePrivy();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pendingReactionDeltasRef = useRef<Set<string>>(new Set());

  const markPendingReactionDelta = useCallback(
    (delta: {
      messageId: string;
      emoji: string;
      action: 'added' | 'removed';
    }) => {
      const key = `${delta.messageId}:${delta.emoji}:${delta.action}`;
      pendingReactionDeltasRef.current.add(key);
      setTimeout(() => pendingReactionDeltasRef.current.delete(key), 5000);
    },
    []
  );

  const getSafeAccessToken = useCallback(
    () =>
      getPrivyAccessTokenSafely(getAccessToken, {
        onError: (error) => {
          logger.warn(
            'Failed to retrieve chat access token',
            { error: error.message },
            'useChatMessages'
          );
        },
      }),
    [getAccessToken]
  );

  // ── Helpers to read/write the React Query cache ─────────────────────
  const getCachedData = useCallback((): ChatMessagesData | undefined => {
    if (!chatId) return undefined;
    return queryClient.getQueryData<ChatMessagesData>(
      chatMessagesQueryKey(chatId)
    );
  }, [chatId, queryClient]);

  const setCachedData = useCallback(
    (
      updater: (
        old: ChatMessagesData | undefined
      ) => ChatMessagesData | undefined
    ) => {
      if (!chatId) return;
      queryClient.setQueryData<ChatMessagesData>(
        chatMessagesQueryKey(chatId),
        updater
      );
    },
    [chatId, queryClient]
  );

  // ── Initial message loading ─────────────────────────────────────────
  // Uses the query cache: if data already exists (from a previous visit
  // or IndexedDB hydration), it's returned instantly with no fetch.
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedRef = useRef<Set<string>>(new Set());

  const loadMessages = useCallback(
    async (targetChatId: string) => {
      // If React Query already has data for this chat, skip the fetch
      const existing = queryClient.getQueryData<ChatMessagesData>(
        chatMessagesQueryKey(targetChatId)
      );
      if (existing && existing.messages.length > 0) {
        hasLoadedRef.current.add(targetChatId);
        return;
      }

      if (hasLoadedRef.current.has(targetChatId)) {
        return;
      }

      setIsLoading(true);
      const token = await getSafeAccessToken();
      if (!token) {
        logger.error(
          'Failed to load messages - no auth token',
          { chatId: targetChatId },
          'useChatMessages'
        );
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `/api/chats/${targetChatId}?limit=${CHAT_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          const formatted = (data.messages as RawApiMessage[]).map((msg) =>
            formatMessage(msg, targetChatId)
          );
          queryClient.setQueryData<ChatMessagesData>(
            chatMessagesQueryKey(targetChatId),
            {
              messages: formatted,
              hasMore: data.pagination?.hasMore ?? false,
              nextCursor: data.pagination?.nextCursor ?? null,
            }
          );
          hasLoadedRef.current.add(targetChatId);
          logger.debug(
            `Loaded ${formatted.length} messages`,
            { chatId: targetChatId, count: formatted.length },
            'useChatMessages'
          );
        }
      } else {
        logger.error(
          'Failed to load messages',
          { chatId: targetChatId, status: response.status },
          'useChatMessages'
        );
      }
      setIsLoading(false);
    },
    [getSafeAccessToken, queryClient]
  );

  // ── Load more (older messages via cursor pagination) ────────────────
  const loadMore = useCallback(async () => {
    const currentData = getCachedData();
    if (
      !chatId ||
      !currentData?.nextCursor ||
      isLoadingMore ||
      !currentData.hasMore
    )
      return;

    setIsLoadingMore(true);
    const token = await getSafeAccessToken();
    if (!token) {
      logger.error(
        'Failed to load more messages - no auth token',
        { chatId },
        'useChatMessages'
      );
      setIsLoadingMore(false);
      return;
    }

    const response = await fetch(
      `/api/chats/${chatId}?cursor=${currentData.nextCursor}&limit=${CHAT_PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.messages?.length > 0) {
        const formatted = (data.messages as RawApiMessage[]).map((msg) =>
          formatMessage(msg, chatId)
        );
        setCachedData((old) => {
          if (!old) return old;
          return {
            messages: [...formatted, ...old.messages],
            hasMore: data.pagination?.hasMore ?? false,
            nextCursor: data.pagination?.nextCursor ?? null,
          };
        });
      }
    } else {
      logger.error(
        'Failed to load more messages',
        { chatId, status: response.status },
        'useChatMessages'
      );
    }
    setIsLoadingMore(false);
  }, [chatId, isLoadingMore, getSafeAccessToken, getCachedData, setCachedData]);

  // ── SSE handler ─────────────────────────────────────────────────────
  const handleChatUpdate = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === 'new_message' && data.message) {
        const m = data.message as Record<string, unknown>;
        if (
          typeof m.id !== 'string' ||
          typeof m.content !== 'string' ||
          typeof m.chatId !== 'string' ||
          typeof m.senderId !== 'string' ||
          typeof m.createdAt !== 'string' ||
          m.chatId !== chatId
        ) {
          return;
        }

        const newMessage: ChatMessage = {
          id: m.id,
          content: m.content,
          chatId: m.chatId,
          senderId: m.senderId,
          type:
            m.type === MessageTypeEnum.USER ||
            m.type === MessageTypeEnum.SYSTEM ||
            m.type === MessageTypeEnum.COORDINATOR
              ? (m.type as MessageType)
              : undefined,
          createdAt: m.createdAt,
          isGameChat:
            typeof m.isGameChat === 'boolean' ? m.isGameChat : undefined,
          metadata: m.metadata as MessageMetadata | null | undefined,
          reactions: Array.isArray(m.reactions)
            ? (m.reactions as MessageReactionSummary[])
            : undefined,
          replyToMessageId:
            typeof m.replyToMessageId === 'string'
              ? m.replyToMessageId
              : undefined,
          replyToMessage: m.replyToMessage as ReplyToMessage | null | undefined,
        };

        setIsLoading(false);
        setCachedData((old) => {
          if (!old)
            return {
              messages: [newMessage],
              hasMore: false,
              nextCursor: null,
            };
          return {
            ...old,
            messages: replaceOptimisticMessage(old.messages, newMessage),
          };
        });
        return;
      }

      if (data.type === 'message_reaction' && data.reaction) {
        const r = data.reaction as Record<string, unknown>;
        if (
          typeof r.messageId !== 'string' ||
          typeof r.chatId !== 'string' ||
          typeof r.emoji !== 'string' ||
          typeof r.userId !== 'string' ||
          typeof r.action !== 'string' ||
          r.chatId !== chatId ||
          (r.action !== 'added' && r.action !== 'removed')
        ) {
          return;
        }

        const isMine = !!user?.id && r.userId === user.id;
        const emoji = r.emoji;
        const action = r.action as 'added' | 'removed';

        if (isMine) {
          const key = `${r.messageId}:${emoji}:${action}`;
          if (pendingReactionDeltasRef.current.has(key)) {
            pendingReactionDeltasRef.current.delete(key);
            return;
          }
        }

        setCachedData((old) => {
          if (!old) return old;
          const idx = old.messages.findIndex((m) => m.id === r.messageId);
          if (idx < 0) return old;
          const msg = old.messages[idx]!;
          const next = applyReactionDelta(msg.reactions, emoji, action, isMine);
          return {
            ...old,
            messages: old.messages.map((m, i) =>
              i === idx ? { ...m, reactions: next } : m
            ),
          };
        });
      }
    },
    [chatId, user?.id, setCachedData]
  );

  // Subscribe to chat channel
  const channel: `chat:${string}` | null = chatId ? `chat:${chatId}` : null;
  const { isConnected } = useSSEChannel(channel, handleChatUpdate);

  // ── Load on chat switch ─────────────────────────────────────────────
  const previousChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousChatIdRef.current !== chatId) {
      if (chatId) {
        void loadMessages(chatId);
      } else {
        setIsLoading(false);
      }
      previousChatIdRef.current = chatId;
    }
  }, [chatId, loadMessages]);

  // ── Polling fallback — only when SSE is disconnected ────────────────
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!chatId || isConnected) {
      // SSE is connected — no need to poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // SSE is disconnected — start polling as fallback
    const startTimeout = setTimeout(() => {
      pollIntervalRef.current = setInterval(async () => {
        const token = await getSafeAccessToken();
        if (!token) return;

        const response = await fetch(
          `/api/chats/${chatId}?limit=${CHAT_PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) return;

        const data = await response.json();
        if (!data.messages) return;

        const formatted = (data.messages as RawApiMessage[]).map((msg) =>
          formatMessage(msg, chatId)
        );

        setCachedData((old) => {
          if (!old) {
            return {
              messages: formatted,
              hasMore: data.pagination?.hasMore ?? false,
              nextCursor: data.pagination?.nextCursor ?? null,
            };
          }

          const existingIds = new Set(old.messages.map((m) => m.id));
          const updated = [...old.messages];
          let changed = false;

          for (const msg of formatted) {
            if (existingIds.has(msg.id)) {
              const existingIdx = updated.findIndex((m) => m.id === msg.id);
              if (existingIdx < 0) continue;
              const existing = updated[existingIdx]!;

              if (!reactionsEqual(existing.reactions, msg.reactions)) {
                updated[existingIdx] = {
                  ...existing,
                  reactions: msg.reactions,
                };
                changed = true;
              }
              if (msg.metadata && !existing.metadata) {
                updated[existingIdx] = {
                  ...updated[existingIdx]!,
                  metadata: msg.metadata,
                };
                changed = true;
              }
              continue;
            }

            const pending = updated.find((m) => isMatchingOptimistic(m, msg));
            if (pending) {
              const idx = updated.indexOf(pending);
              updated[idx] = {
                ...msg,
                stableKey: pending.stableKey || pending.id,
                createdAt: pending.createdAt,
              };
              changed = true;
            } else {
              updated.push(msg);
              changed = true;
            }
          }

          return changed ? { ...old, messages: updated } : old;
        });

        hasLoadedRef.current.add(chatId);
      }, POLLING_INTERVAL_MS);
    }, 1000);

    return () => {
      clearTimeout(startTimeout);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [chatId, isConnected, getSafeAccessToken, setCachedData]);

  // SSE connected means we're ready
  useEffect(() => {
    if (isConnected && chatId) setIsLoading(false);
  }, [isConnected, chatId]);

  // ── Derived state from cache ────────────────────────────────────────
  const cachedData = getCachedData();
  const messages = cachedData?.messages ?? [];
  const hasMore = cachedData?.hasMore ?? false;

  // ── Mutation helpers (same interface as before) ─────────────────────
  const addMessage = useCallback(
    (message: ChatMessage) => {
      const isOptimistic =
        message.id.startsWith(OptimisticMessageIdPrefix.Pending) ||
        message.id.startsWith(OptimisticMessageIdPrefix.Thinking);
      setCachedData((old) => {
        if (!old)
          return { messages: [message], hasMore: false, nextCursor: null };
        if (isOptimistic) {
          return { ...old, messages: [...old.messages, message] };
        }
        return {
          ...old,
          messages: replaceOptimisticMessage(old.messages, message),
        };
      });
    },
    [setCachedData]
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setCachedData((old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        };
      });
    },
    [setCachedData]
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      setCachedData((old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.filter((msg) => msg.id !== messageId),
        };
      });
    },
    [setCachedData]
  );

  const clearMessages = useCallback(() => {
    if (chatId) {
      queryClient.removeQueries({
        queryKey: chatMessagesQueryKey(chatId),
      });
    }
    hasLoadedRef.current.clear();
  }, [chatId, queryClient]);

  const reloadMessages = useCallback(() => {
    if (chatId) {
      hasLoadedRef.current.delete(chatId);
      queryClient.removeQueries({
        queryKey: chatMessagesQueryKey(chatId),
      });
      void loadMessages(chatId);
    }
  }, [chatId, loadMessages, queryClient]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    reloadMessages,
    isConnected,
    markPendingReactionDelta,
  };
}
