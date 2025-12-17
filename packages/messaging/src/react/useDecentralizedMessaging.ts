/**
 * React hook for decentralized messaging in Babylon
 */

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

  const clientRef = useRef<DecentralizedMessagingClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);

  // Create client on mount
  useEffect(() => {
    clientRef.current = createMessagingClient(config);

    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [config]);

  // Handle message events
  useEffect(() => {
    if (!clientRef.current || !isInitialized) return;

    const unsubscribe = clientRef.current.onMessage((event: MessageEvent) => {
      switch (event.type) {
        case 'message:new':
          setMessages((prev: DecryptedMessage[]) => {
            // Avoid duplicates
            if (prev.some((m: DecryptedMessage) => m.id === event.data.id))
              return prev;
            return [...prev, event.data].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
          });
          break;
        case 'connection:status':
          setIsConnected(event.data.connected);
          break;
      }
    });

    return unsubscribe;
  }, [isInitialized]);

  // Fetch pending messages
  const fetchMessages = useCallback(async () => {
    if (!clientRef.current || !isInitialized) return;

    setIsLoading(true);

    const pending = await clientRef.current.fetchPendingMessages();
    setMessages((prev: DecryptedMessage[]) => {
      const existingIds = new Set(prev.map((m: DecryptedMessage) => m.id));
      const newMessages = pending.filter(
        (m: DecryptedMessage) => !existingIds.has(m.id)
      );
      return [...prev, ...newMessages].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    });
    setIsLoading(false);
  }, [isInitialized]);

  // Initialize the client
  const initialize = useCallback(
    async (signature: string) => {
      if (!clientRef.current) return;

      setIsLoading(true);
      setError(null);

      await clientRef.current.initialize(signature);
      setIsInitialized(true);
      setIsLoading(false);

      if (autoFetch) {
        await fetchMessages();
      }
    },
    [autoFetch, fetchMessages]
  );

  // Auto-initialize if signature provided
  useEffect(() => {
    if (walletSignature && clientRef.current && !isInitialized) {
      initialize(walletSignature);
    }
  }, [walletSignature, isInitialized, initialize]);

  // Send a message
  const sendMessage = useCallback(
    async (to: Address, content: string): Promise<string> => {
      if (!clientRef.current || !isInitialized) {
        throw new Error('Client not initialized');
      }

      setIsLoading(true);

      const messageId = await clientRef.current.sendMessage(to, content);
      setIsLoading(false);

      return messageId;
    },
    [isInitialized]
  );

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
    setMessages([]);
  }, []);

  // Get key derivation message
  const keyDerivationMessage =
    clientRef.current?.getKeyDerivationMessage() ??
    `Sign this message to enable encrypted messaging on Babylon.\n\nAddress: ${config.address}`;

  return {
    isInitialized,
    isConnected,
    isLoading,
    error,
    messages,
    initialize,
    sendMessage,
    fetchMessages,
    getPublicKeyHex,
    keyDerivationMessage,
    disconnect,
  };
}
