/**
 * React hook for decentralized messaging in Babylon
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { createMessagingClient, DecentralizedMessagingClient } from '../client';
import type { DecryptedMessage, MessageEvent, MessagingConfig } from '../types';

interface UseDecentralizedMessagingOptions {
  config: MessagingConfig;
  /** Auto-fetch pending messages on init */
  autoFetch?: boolean;
  /** Wallet signature for key derivation (optional if using manual init) */
  walletSignature?: string;
}

interface UseDecentralizedMessagingReturn {
  /** Whether the client is initialized */
  isInitialized: boolean;
  /** Whether connected to relay */
  isConnected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Messages for the current conversation */
  messages: DecryptedMessage[];
  /** Initialize the client with wallet signature */
  initialize: (signature: string) => Promise<void>;
  /** Send a message */
  sendMessage: (to: Address, content: string) => Promise<string>;
  /** Fetch pending messages */
  fetchMessages: () => Promise<void>;
  /** Get public key hex for registration */
  getPublicKeyHex: () => string | null;
  /** Message to sign for key derivation */
  keyDerivationMessage: string;
  /** Disconnect and cleanup */
  disconnect: () => void;
}

/**
 * Hook for using decentralized messaging in Babylon React components
 *
 * @example
 * ```tsx
 * const { initialize, sendMessage, messages, isConnected } = useDecentralizedMessaging({
 *   config: {
 *     rpcUrl: 'https://rpc.jeju.network',
 *     address: userAddress,
 *     relayUrl: 'https://relay.jeju.network',
 *   }
 * });
 *
 * // Initialize with wallet signature
 * const signature = await signMessage(keyDerivationMessage);
 * await initialize(signature);
 *
 * // Send message
 * await sendMessage(recipientAddress, 'Hello!');
 * ```
 */
export function useDecentralizedMessaging(
  options: UseDecentralizedMessagingOptions
): UseDecentralizedMessagingReturn {
  const { config, autoFetch = true, walletSignature } = options;

  const queryClient = useQueryClient();
  const clientRef = useRef<DecentralizedMessagingClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeMessages, setRealtimeMessages] = useState<DecryptedMessage[]>(
    []
  );

  // Create client on mount
  useEffect(() => {
    clientRef.current = createMessagingClient(config);

    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [config]);

  // Query for fetching pending messages
  const {
    data: fetchedMessages = [],
    isLoading: isFetchingMessages,
    error: fetchError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['decentralized-messages', config.address],
    queryFn: async () => {
      if (!clientRef.current) return [];
      return clientRef.current.fetchPendingMessages();
    },
    enabled: isInitialized && !!clientRef.current && autoFetch,
    staleTime: 30_000,
  });

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, content }: { to: Address; content: string }) => {
      if (!clientRef.current || !isInitialized) {
        throw new Error('Client not initialized');
      }
      return clientRef.current.sendMessage(to, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['decentralized-messages', config.address],
      });
    },
  });

  // Handle message events for real-time updates
  useEffect(() => {
    if (!clientRef.current || !isInitialized) return;

    const unsubscribe = clientRef.current.onMessage((event: MessageEvent) => {
      switch (event.type) {
        case 'message:new':
          setRealtimeMessages((prev: DecryptedMessage[]) => {
            if (prev.some((m: DecryptedMessage) => m.id === event.data.id))
              return prev;
            return [...prev, event.data].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
          });
          // Invalidate query to refetch
          queryClient.invalidateQueries({
            queryKey: ['decentralized-messages', config.address],
          });
          break;
        case 'connection:status':
          setIsConnected(event.data.connected);
          break;
      }
    });

    return unsubscribe;
  }, [isInitialized, queryClient, config.address]);

  // Merge fetched and real-time messages
  const messages = [...fetchedMessages, ...realtimeMessages]
    .filter(
      (msg, index, self) => self.findIndex((m) => m.id === msg.id) === index
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Initialize the client
  const initialize = useCallback(async (signature: string) => {
    if (!clientRef.current) return;
    await clientRef.current.initialize(signature);
    setIsInitialized(true);
  }, []);

  // Auto-initialize if signature provided
  useEffect(() => {
    if (walletSignature && clientRef.current && !isInitialized) {
      initialize(walletSignature);
    }
  }, [walletSignature, isInitialized, initialize]);

  // Send a message wrapper
  const sendMessage = useCallback(
    async (to: Address, content: string): Promise<string> => {
      return sendMessageMutation.mutateAsync({ to, content });
    },
    [sendMessageMutation]
  );

  // Fetch messages wrapper
  const fetchMessages = useCallback(async () => {
    await refetchMessages();
  }, [refetchMessages]);

  // Get public key
  const getPublicKeyHex = useCallback(() => {
    if (!clientRef.current || !isInitialized) return null;
    return clientRef.current.getPublicKeyHex();
  }, [isInitialized]);

  // Disconnect
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    setIsInitialized(false);
    setIsConnected(false);
    setRealtimeMessages([]);
    queryClient.removeQueries({
      queryKey: ['decentralized-messages', config.address],
    });
  }, [queryClient, config.address]);

  // Get key derivation message
  const keyDerivationMessage =
    clientRef.current?.getKeyDerivationMessage() ??
    `Sign this message to enable encrypted messaging on Babylon.\n\nAddress: ${config.address}`;

  return {
    isInitialized,
    isConnected,
    isLoading: isFetchingMessages || sendMessageMutation.isPending,
    error: fetchError ?? sendMessageMutation.error ?? null,
    messages,
    initialize,
    sendMessage,
    fetchMessages,
    getPublicKeyHex,
    keyDerivationMessage,
    disconnect,
  };
}
