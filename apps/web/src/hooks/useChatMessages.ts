import { ChatMessagesApiResponseSchema, logger } from '@babylon/shared'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSSEChannel } from './useSSE'

/**
 * Represents a chat message in the system.
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string
  /** Message content/text */
  content: string
  /** ID of the chat this message belongs to */
  chatId: string
  /** ID of the user who sent the message */
  senderId: string
  /** ISO timestamp when the message was created */
  createdAt: string
  /** Whether this is a game chat message */
  isGameChat?: boolean
}

interface ApiMessage {
  id: string
  content: string
  senderId: string
  createdAt: string | Date
}

interface ChatPage {
  messages: ChatMessage[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Hook for managing chat messages with real-time SSE updates.
 *
 * Provides comprehensive chat message management including:
 * - Initial message loading with pagination
 * - Real-time message updates via SSE
 * - Message history pagination (load more)
 * - Automatic deduplication
 * - Polling fallback for multi-instance serverless environments
 *
 * @param chatId - The ID of the chat to load messages for, or null to clear messages.
 *
 * @returns An object containing:
 * - `messages`: Array of chat messages sorted by timestamp
 * - `isLoading`: Whether initial messages are being loaded
 * - `isLoadingMore`: Whether more messages are being loaded (pagination)
 * - `hasMore`: Whether there are more messages to load
 * - `loadMore`: Function to load older messages
 * - `addMessage`: Function to manually add a message to the list
 * - `clearMessages`: Function to clear all messages
 * - `reloadMessages`: Function to reload messages from the API
 * - `isConnected`: Whether SSE connection is active
 *
 * @example
 * ```tsx
 * const { messages, isLoading, loadMore, hasMore } = useChatMessages(chatId);
 *
 * return (
 *   <div>
 *     {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
 *     {hasMore && <button onClick={loadMore}>Load More</button>}
 *   </div>
 * );
 * ```
 */
const formatMessage = (msg: ApiMessage, targetChatId: string): ChatMessage => ({
  id: msg.id,
  content: msg.content,
  chatId: targetChatId,
  senderId: msg.senderId,
  createdAt:
    typeof msg.createdAt === 'string'
      ? msg.createdAt
      : msg.createdAt.toISOString(),
})

export function useChatMessages(chatId: string | null) {
  const queryClient = useQueryClient()
  const [sseMessages, setSseMessages] = useState<ChatMessage[]>([])
  const previousChatIdRef = useRef<string | null>(null)

  const {
    data,
    isLoading,
    isFetchingNextPage: isLoadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['chatMessages', chatId],
    queryFn: async ({ pageParam }): Promise<ChatPage> => {
      const url = pageParam
        ? `/api/chats/${chatId}?cursor=${pageParam}&limit=50`
        : `/api/chats/${chatId}?limit=50`

      logger.debug(
        `Loading messages for chat ${chatId}`,
        { chatId, cursor: pageParam },
        'useChatMessages',
      )

      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        logger.error(
          'Failed to load messages',
          { chatId, errorData, status: response.status },
          'useChatMessages',
        )
        throw new Error('Failed to load messages')
      }

      const json = await response.json()
      const responseData = ChatMessagesApiResponseSchema.parse(json)

      const formattedMessages: ChatMessage[] = (
        responseData.messages ?? []
      ).map((msg) => formatMessage(msg as ApiMessage, chatId))

      logger.debug(
        `Loaded ${formattedMessages.length} messages for chat ${chatId}`,
        {
          chatId,
          count: formattedMessages.length,
          hasMore: responseData.pagination?.hasMore,
        },
        'useChatMessages',
      )

      return {
        messages: formattedMessages,
        nextCursor: responseData.pagination?.nextCursor ?? null,
        hasMore: responseData.pagination?.hasMore ?? false,
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!chatId,
    staleTime: 30000,
  })

  // Handle SSE updates for this chat
  const handleChatUpdate = useCallback(
    (eventData: Record<string, unknown>) => {
      if (eventData.type === 'new_message' && eventData.message) {
        const messageData = eventData.message as Record<string, unknown>

        if (
          typeof messageData.id === 'string' &&
          typeof messageData.content === 'string' &&
          typeof messageData.chatId === 'string' &&
          typeof messageData.senderId === 'string' &&
          typeof messageData.createdAt === 'string'
        ) {
          const newMessage: ChatMessage = {
            id: messageData.id,
            content: messageData.content,
            chatId: messageData.chatId,
            senderId: messageData.senderId,
            createdAt: messageData.createdAt,
            isGameChat:
              typeof messageData.isGameChat === 'boolean'
                ? messageData.isGameChat
                : undefined,
          }

          if (newMessage.chatId === chatId) {
            setSseMessages((prev) => {
              if (prev.some((msg) => msg.id === newMessage.id)) {
                return prev
              }
              return [...prev, newMessage]
            })
          }
        }
      }
    },
    [chatId],
  )

  const channel: `chat:${string}` | null = chatId ? `chat:${chatId}` : null
  const { isConnected } = useSSEChannel(channel, handleChatUpdate)

  // Reset SSE messages when chat changes
  useEffect(() => {
    if (previousChatIdRef.current !== chatId) {
      setSseMessages([])
      previousChatIdRef.current = chatId
    }
  }, [chatId])

  // Polling fallback: Refresh chat every 15 seconds
  useEffect(() => {
    if (!chatId) return

    const interval = setInterval(async () => {
      logger.debug(
        `Polling for new messages in chat ${chatId}`,
        { chatId },
        'useChatMessages',
      )

      const response = await fetch(`/api/chats/${chatId}?limit=50`)
      if (response.ok) {
        const json = await response.json()
        const responseData = ChatMessagesApiResponseSchema.parse(json)
        if (responseData.messages) {
          const formattedMessages: ChatMessage[] = responseData.messages.map(
            (msg) => formatMessage(msg as ApiMessage, chatId),
          )

          // Check for new messages and add them via SSE messages
          setSseMessages((prev) => {
            const existingIds = new Set([
              ...prev.map((m) => m.id),
              ...(data?.pages.flatMap((p) => p.messages.map((m) => m.id)) ??
                []),
            ])
            const newMessages = formattedMessages.filter(
              (m) => !existingIds.has(m.id),
            )
            if (newMessages.length > 0) {
              logger.debug(
                `Polling found ${newMessages.length} new messages`,
                { chatId, count: newMessages.length },
                'useChatMessages',
              )
              return [...prev, ...newMessages]
            }
            return prev
          })
        }
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [chatId, data?.pages])

  // Combine paginated data with SSE messages
  const allMessages = useCallback((): ChatMessage[] => {
    const paginatedMessages = data?.pages.flatMap((page) => page.messages) ?? []
    const allMsgs = [...paginatedMessages, ...sseMessages]

    // Deduplicate by id
    const seen = new Set<string>()
    const unique = allMsgs.filter((msg) => {
      if (seen.has(msg.id)) return false
      seen.add(msg.id)
      return true
    })

    return unique.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }, [data?.pages, sseMessages])

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void fetchNextPage()
    }
  }, [hasMore, isLoadingMore, fetchNextPage])

  const addMessage = useCallback((message: ChatMessage) => {
    setSseMessages((prev) => {
      if (prev.some((msg) => msg.id === message.id)) {
        return prev
      }
      return [...prev, message]
    })
  }, [])

  const clearMessages = useCallback(() => {
    setSseMessages([])
    void queryClient.resetQueries({ queryKey: ['chatMessages', chatId] })
  }, [queryClient, chatId])

  const reloadMessages = useCallback(() => {
    setSseMessages([])
    void refetch()
  }, [refetch])

  return {
    messages: allMessages(),
    isLoading,
    isLoadingMore,
    hasMore: hasMore ?? false,
    loadMore,
    addMessage,
    clearMessages,
    reloadMessages,
    isConnected,
  }
}
