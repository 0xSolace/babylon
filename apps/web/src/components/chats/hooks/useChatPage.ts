'use client';

import { useJejuAuth } from '@babylon/auth/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChatMessages } from '@/hooks/useChatMessages';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAuthStore } from '@/stores/authStore';
import type { Chat, ChatDetails, ChatFilter } from '../types';

interface ChatsApiResponse {
  groupChats?: Chat[];
  directChats?: Chat[];
  chats?: Chat[];
}

interface ChatDetailsApiResponse {
  chat?: {
    id: string;
    name: string | null;
    isGroup: boolean;
    createdAt: string;
    updatedAt: string;
  };
  messages?: Array<{
    id: string;
    content: string;
    chatId: string;
    senderId: string;
    createdAt: string;
  }>;
  participants?: Array<{
    id: string;
    displayName: string;
    username: string | null;
    profileImageUrl: string | null;
  }>;
}

interface SendMessageResponse {
  message?: {
    id: string;
    content: string;
    chatId: string;
    senderId: string;
    createdAt: string | Date;
  };
  warnings?: string[];
  error?: string;
}

interface GroupIdResponse {
  groupId: string;
}

interface UserProfileResponse {
  user: {
    id: string;
    displayName?: string;
    username?: string;
    profileImageUrl?: string;
  };
}

export function useChatPage() {
  const { ready, authenticated } = useAuth();
  const { user } = useAuthStore();
  const { getAccessToken } = useJejuAuth();
  const queryClient = useQueryClient();

  // UI state
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Message input state
  const [messageInput, setMessageInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendWarning, setSendWarning] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Leave chat state
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveChatError, setLeaveChatError] = useState<string | null>(null);

  // Group modals
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupManagementModalOpen, setIsGroupManagementModalOpen] =
    useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // New DM state
  const [pendingDM, setPendingDM] = useState<{
    chatId: string;
    targetUserId: string;
  } | null>(null);

  // Scroll state
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAdjustRef = useRef<{
    previousHeight: number;
    previousTop: number;
  } | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Debug mode
  const isDebugMode =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  // SSE for real-time messages
  const {
    messages: realtimeMessages,
    isConnected: sseConnected,
    isLoadingMore,
    hasMore,
    loadMore,
    addMessage,
  } = useChatMessages(selectedChatId);

  // Query for all chats
  const {
    data: allChats = [],
    isLoading: loading,
    refetch: refetchChats,
  } = useQuery({
    queryKey: ['chats'],
    queryFn: async (): Promise<Chat[]> => {
      if (!isDebugMode && (!ready || !authenticated)) {
        return [];
      }

      const token = await getAccessToken();
      if (!token && !isDebugMode) {
        return [];
      }

      const [personalResponse, gameResponse] = await Promise.all([
        fetch('/api/chats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        isDebugMode ? fetch('/api/chats?all=true') : Promise.resolve(null),
      ]);

      if (!personalResponse.ok) {
        return [];
      }

      const personalData = (await personalResponse.json()) as ChatsApiResponse;

      let gameChats: Chat[] = [];
      if (gameResponse?.ok) {
        const gameData = (await gameResponse.json()) as ChatsApiResponse;
        gameChats = gameData.chats ?? [];
      }

      const combined = [
        ...(personalData.groupChats ?? []),
        ...(personalData.directChats ?? []),
        ...gameChats,
      ].sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.updatedAt;
        const bTime = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      return combined;
    },
    enabled: (ready && authenticated) || isDebugMode,
    staleTime: 30000,
  });

  // Query for chat details
  const {
    data: chatDetails = null,
    isLoading: loadingChat,
    refetch: refetchChatDetails,
  } = useQuery({
    queryKey: ['chatDetails', selectedChatId],
    queryFn: async (): Promise<ChatDetails | null> => {
      if (isDebugMode) {
        const response = await fetch(`/api/chats/${selectedChatId}?debug=true`);
        const data = (await response.json()) as ChatDetailsApiResponse;
        return {
          ...data,
          chat: data.chat ?? {
            id: selectedChatId!,
            name: null,
            isGroup: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          messages: data.messages ?? [],
          participants: data.participants ?? [],
        } as ChatDetails;
      }

      const token = await getAccessToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`/api/chats/${selectedChatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 404 || !response.ok) {
        return null;
      }

      const data = (await response.json()) as ChatDetailsApiResponse;
      return {
        ...data,
        chat: data.chat ?? {
          id: selectedChatId!,
          name: null,
          isGroup: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: data.messages ?? [],
        participants: data.participants ?? [],
      } as ChatDetails;
    },
    enabled: !!selectedChatId,
    staleTime: 30000,
  });

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (): Promise<SendMessageResponse> => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`/api/chats/${selectedChatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: messageInput.trim() }),
      });

      const data = (await response.json()) as SendMessageResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? 'Failed to send message. Please try again.'
        );
      }

      return data;
    },
    onSuccess: (data) => {
      const warnings = Array.isArray(data.warnings) ? data.warnings : [];
      if (warnings.length > 0) {
        setSendWarning(warnings.join('. '));
        setTimeout(() => setSendWarning(null), 5000);
      }

      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);

      if (data.message) {
        addMessage({
          id: data.message.id,
          content: data.message.content,
          chatId: data.message.chatId,
          senderId: data.message.senderId,
          createdAt:
            typeof data.message.createdAt === 'string'
              ? data.message.createdAt
              : new Date(data.message.createdAt).toISOString(),
        });
      }

      setMessageInput('');
      void refetchChats();
    },
    onError: (error) => {
      setSendError((error as Error).message);
    },
  });

  // Mutation for leaving chat
  const leaveChatMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Authentication failed. Please try again.');
      }

      const response = await fetch(
        `/api/chats/${selectedChatId}/participants/me`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? 'Failed to leave chat');
      }
    },
    onSuccess: () => {
      setLeaveConfirmOpen(false);
      setSelectedChatId(null);
      void refetchChats();
    },
    onError: (error) => {
      setLeaveChatError((error as Error).message);
    },
  });

  const sendMessage = useCallback(async () => {
    if (
      !selectedChatId ||
      !messageInput.trim() ||
      sendMessageMutation.isPending
    )
      return;

    setSendError(null);
    setSendWarning(null);
    setSendSuccess(false);

    await sendMessageMutation.mutateAsync();
  }, [selectedChatId, messageInput, sendMessageMutation]);

  const handleLeaveChat = useCallback(async () => {
    if (!selectedChatId) return;
    setLeaveChatError(null);
    await leaveChatMutation.mutateAsync();
  }, [selectedChatId, leaveChatMutation]);

  // Group handlers
  const handleGroupCreated = useCallback(
    async (groupId: string, chatId: string) => {
      await refetchChats();
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSelectedGroupId(groupId);
      setSelectedChatId(chatId);
      await refetchChatDetails();
    },
    [refetchChats, refetchChatDetails]
  );

  const handleGroupUpdated = useCallback(async () => {
    await refetchChats();
    if (selectedChatId) {
      await refetchChatDetails();
    }
  }, [refetchChats, selectedChatId, refetchChatDetails]);

  const handleManageGroup = useCallback(async () => {
    if (!chatDetails?.chat.id) return;

    const token = await getAccessToken();
    const response = await fetch(`/api/chats/${chatDetails.chat.id}/group`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = (await response.json()) as GroupIdResponse;
      setSelectedGroupId(data.groupId);
      setIsGroupManagementModalOpen(true);
    }
  }, [chatDetails?.chat.id, getAccessToken]);

  // Load new DM chat
  const loadNewDMChat = useCallback(
    async (chatId: string, targetUserId: string) => {
      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const response = await fetch(`/api/users/${targetUserId}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return;
      }

      const userData = (await response.json()) as UserProfileResponse;
      const targetUser = userData.user;

      // Update chat details cache directly
      queryClient.setQueryData<ChatDetails>(['chatDetails', chatId], {
        chat: {
          id: chatId,
          name: null,
          isGroup: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [],
        participants: [
          {
            id: user!.id,
            displayName: user!.displayName || user!.username || 'You',
            username: user!.username,
            profileImageUrl: user!.profileImageUrl,
          },
          {
            id: targetUser.id,
            displayName:
              targetUser.displayName || targetUser.username || 'User',
            username: targetUser.username,
            profileImageUrl: targetUser.profileImageUrl,
          },
        ],
      });

      const newChat: Chat = {
        id: chatId,
        name: targetUser.displayName || targetUser.username || 'User',
        isGroup: false,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
        otherUser: {
          id: targetUser.id,
          displayName: targetUser.displayName ?? null,
          username: targetUser.username ?? null,
          profileImageUrl: targetUser.profileImageUrl ?? null,
        },
      };

      queryClient.setQueryData<Chat[]>(['chats'], (prev) => {
        if (!prev) return [newChat];
        if (prev.some((c) => c.id === chatId)) {
          return prev;
        }
        return [newChat, ...prev];
      });
    },
    [getAccessToken, user, queryClient]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = chatContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  // Pull-to-refresh
  const { pullDistance, containerRef: setPullToRefreshRef } = usePullToRefresh({
    onRefresh: async () => {
      if (!selectedChatId) return;
      await refetchChatDetails();
    },
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      chatContainerRef.current = node;
      setPullToRefreshRef(node);
    },
    [setPullToRefreshRef]
  );

  // Filter chats
  const filteredByType =
    activeFilter === 'all'
      ? allChats
      : activeFilter === 'dms'
        ? allChats.filter((c) => !c.isGroup)
        : allChats.filter((c) => c.isGroup);

  const filteredChats = searchQuery
    ? filteredByType.filter((chat) =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByType;

  // Combined chat details with realtime messages
  const chatDetailsWithRealtimeMessages: ChatDetails | null = chatDetails
    ? {
        ...chatDetails,
        messages:
          realtimeMessages.length > 0 ? realtimeMessages : chatDetails.messages,
      }
    : null;

  // Load selected chat details
  useEffect(() => {
    if (selectedChatId) {
      lastMessageIdRef.current = null;
      setIsAtBottom(true);
    }
  }, [selectedChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const msgs = chatDetailsWithRealtimeMessages?.messages ?? [];
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1]?.id : null;
    if (!lastId) return;

    const isNewMessage = lastId !== lastMessageIdRef.current;
    const shouldForce = lastMessageIdRef.current === null;
    lastMessageIdRef.current = lastId;

    if (shouldForce) {
      scrollToBottom('auto');
      setIsAtBottom(true);
      return;
    }

    if (isNewMessage && isAtBottom) {
      scrollToBottom('smooth');
      setIsAtBottom(true);
    }
  }, [chatDetailsWithRealtimeMessages?.messages, isAtBottom, scrollToBottom]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    const sentinel = topSentinelRef.current;

    if (!container || !sentinel || !selectedChatId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (
          entry.isIntersecting &&
          container.scrollTop < 200 &&
          hasMore &&
          !isLoadingMore
        ) {
          pendingScrollAdjustRef.current = {
            previousHeight: container.scrollHeight,
            previousTop: container.scrollTop,
          };
          loadMore();
        }
      },
      { root: container, rootMargin: '0px 0px 0px 0px', threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedChatId, hasMore, isLoadingMore, loadMore]);

  // Maintain scroll position after loading older messages
  useEffect(() => {
    if (isLoadingMore || !pendingScrollAdjustRef.current) return;
    const container = chatContainerRef.current;
    if (!container) return;

    const { previousHeight, previousTop } = pendingScrollAdjustRef.current;
    const newHeight = container.scrollHeight;
    const delta = newHeight - previousHeight;
    container.scrollTop = previousTop + delta;
    pendingScrollAdjustRef.current = null;
  }, [isLoadingMore]);

  // Track scroll position
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 50;
      const atBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - threshold;
      setIsAtBottom(atBottom);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for chat ID in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const chatParam = params.get('chat');
      const newDMParam = params.get('newDM');

      if (chatParam && chatParam !== selectedChatId) {
        setSelectedChatId(chatParam);

        if (newDMParam && chatParam.startsWith('dm-')) {
          setPendingDM({ chatId: chatParam, targetUserId: newDMParam });
        }

        window.history.replaceState({}, '', '/chats');
      }
    }
  }, [selectedChatId]);

  // Load pending DM once user is available
  useEffect(() => {
    if (pendingDM && user) {
      void loadNewDMChat(pendingDM.chatId, pendingDM.targetUserId);
      setPendingDM(null);
    }
  }, [pendingDM, user, loadNewDMChat]);

  const loadChats = useCallback(async () => {
    await refetchChats();
  }, [refetchChats]);

  return {
    // Auth
    ready,
    authenticated,
    user,

    // UI state
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,

    // Data
    filteredChats,
    chatDetails: chatDetailsWithRealtimeMessages,

    // Loading state
    loading,
    loadingChat,
    sending: sendMessageMutation.isPending,
    isLoadingMore,
    hasMore,

    // Message state
    messageInput,
    setMessageInput,
    sendError,
    sendWarning,
    sendSuccess,

    // Leave chat
    isLeaveConfirmOpen,
    setLeaveConfirmOpen,
    isLeavingChat: leaveChatMutation.isPending,
    leaveChatError,
    setLeaveChatError,
    handleLeaveChat,

    // Group modals
    isCreateGroupModalOpen,
    setIsCreateGroupModalOpen,
    isGroupManagementModalOpen,
    setIsGroupManagementModalOpen,
    selectedGroupId,
    setSelectedGroupId,
    handleGroupCreated,
    handleGroupUpdated,
    handleManageGroup,

    // SSE
    sseConnected,

    // Refs
    messagesEndRef,
    topSentinelRef,
    setRefs,
    pullDistance,

    // Actions
    sendMessage,
    loadChats,
  };
}
