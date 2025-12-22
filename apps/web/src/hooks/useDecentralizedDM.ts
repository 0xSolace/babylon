/**
 * React Hook for Decentralized Direct Messages
 *
 * Provides end-to-end encrypted messaging using Jeju L2 infrastructure.
 * Messages are encrypted client-side before being sent to the relay network.
 */

import { useJejuAuth } from '@babylon/auth/client';
import {
  decryptMessageToString,
  type EncryptionKeyPair,
  encryptMessage,
  generateKeyPair,
  publicKeyToHex,
  serializeEncryptedMessage,
} from '@babylon/messaging';
import {
  ErrorApiResponseSchema,
  InboxApiResponseSchema,
  MessagingPublicKeyApiResponseSchema,
  SendMessageApiResponseSchema,
} from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

interface DecentralizedMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'delivered' | 'read';
  isDecentralized: true;
}

interface UseDecentralizedDMOptions {
  /** Target user's wallet address */
  recipientAddress?: string;
  /** Auto-initialize keys on mount */
  autoInit?: boolean;
}

interface UseDecentralizedDMReturn {
  /** Whether keys are initialized */
  isInitialized: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Decrypted messages */
  messages: DecentralizedMessage[];
  /** Initialize encryption keys */
  initializeKeys: () => Promise<void>;
  /** Send encrypted message */
  sendMessage: (content: string) => Promise<string>;
  /** Fetch and decrypt messages */
  fetchMessages: () => Promise<void>;
  /** Public key for sharing */
  publicKey: string | null;
}

/**
 * Hook for decentralized direct messaging
 */
export function useDecentralizedDM(
  options: UseDecentralizedDMOptions = {}
): UseDecentralizedDMReturn {
  const { recipientAddress, autoInit = false } = options;
  const { userId, walletAddress: userWalletAddress } = useJejuAuth();
  const queryClient = useQueryClient();

  const keyPairRef = useRef<EncryptionKeyPair | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipientKeyRef = useRef<Uint8Array | null>(null);

  // Query for recipient's public key
  const { data: recipientKeyData, isLoading: isLoadingRecipientKey } = useQuery(
    {
      queryKey: ['recipientKey', recipientAddress],
      queryFn: async (): Promise<Uint8Array | null> => {
        const response = await fetch(`/api/messaging/keys/${recipientAddress}`);
        if (!response.ok) {
          return null;
        }

        const json: unknown = await response.json();
        const responseData = MessagingPublicKeyApiResponseSchema.parse(json);

        const hex = responseData.publicKey.startsWith('0x')
          ? responseData.publicKey.slice(2)
          : responseData.publicKey;
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }

        recipientKeyRef.current = bytes;
        return bytes;
      },
      enabled: !!recipientAddress && isInitialized,
      staleTime: 300000, // 5 minutes
    }
  );

  // Query for inbox messages
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['decentralizedMessages'],
    queryFn: async (): Promise<DecentralizedMessage[]> => {
      if (!keyPairRef.current) {
        return [];
      }

      const response = await fetch('/api/messaging/inbox');
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const json: unknown = await response.json();
      const responseData = InboxApiResponseSchema.parse(json);

      const decrypted: DecentralizedMessage[] = [];

      for (const msg of responseData.messages) {
        const content = decryptMessageToString(
          msg.encryptedContent,
          keyPairRef.current
        );

        decrypted.push({
          id: msg.id,
          from: msg.from,
          to: msg.to,
          content,
          timestamp: new Date(msg.timestamp),
          status: 'delivered',
          isDecentralized: true,
        });
      }

      return decrypted;
    },
    enabled: isInitialized && !!keyPairRef.current,
    staleTime: 30000,
  });

  // Mutation for initializing keys
  const initKeysMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const keyPair = generateKeyPair();
      keyPairRef.current = keyPair;

      const pubKeyHex = '0x' + publicKeyToHex(keyPair.publicKey);
      setPublicKey(pubKeyHex);

      const response = await fetch('/api/messaging/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: pubKeyHex }),
      });

      if (!response.ok) {
        const errorJson: unknown = await response.json();
        const errorData = ErrorApiResponseSchema.parse(errorJson);
        throw new Error(errorData.error ?? 'Failed to register keys');
      }

      setIsInitialized(true);
    },
    onError: (err) => {
      setError((err as Error).message);
    },
  });

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string): Promise<string> => {
      if (!keyPairRef.current) {
        throw new Error('Keys not initialized');
      }
      if (!recipientAddress) {
        throw new Error('No recipient address');
      }

      let recipientKey = recipientKeyRef.current;
      if (!recipientKey) {
        recipientKey = recipientKeyData ?? null;
        if (!recipientKey) {
          throw new Error('Recipient has not registered encryption keys');
        }
        recipientKeyRef.current = recipientKey;
      }

      const encrypted = encryptMessage(
        content,
        recipientKey,
        keyPairRef.current
      );

      const encryptedContent = serializeEncryptedMessage(encrypted);

      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientAddress,
          encryptedContent,
        }),
      });

      if (!response.ok) {
        const errorJson: unknown = await response.json();
        const errorData = ErrorApiResponseSchema.parse(errorJson);
        throw new Error(errorData.error ?? 'Failed to send message');
      }

      const resultJson: unknown = await response.json();
      const result = SendMessageApiResponseSchema.parse(resultJson);

      return result.messageId;
    },
    onSuccess: (messageId, content) => {
      if (!userWalletAddress) {
        throw new Error(
          'Cannot record sent message: user wallet address is missing'
        );
      }
      // Optimistically add the message
      queryClient.setQueryData<DecentralizedMessage[]>(
        ['decentralizedMessages'],
        (old) => [
          ...(old ?? []),
          {
            id: messageId,
            from: userWalletAddress,
            to: recipientAddress!,
            content,
            timestamp: new Date(),
            status: 'pending',
            isDecentralized: true,
          },
        ]
      );
    },
    onError: (err) => {
      setError((err as Error).message);
    },
  });

  const initializeKeys = useCallback(async () => {
    setError(null);
    await initKeysMutation.mutateAsync();
  }, [initKeysMutation]);

  const sendMessage = useCallback(
    async (content: string): Promise<string> => {
      setError(null);
      return sendMessageMutation.mutateAsync(content);
    },
    [sendMessageMutation]
  );

  const fetchMessages = useCallback(async () => {
    setError(null);
    await refetchMessages();
  }, [refetchMessages]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInit && userId && !isInitialized && !initKeysMutation.isPending) {
      void initializeKeys();
    }
  }, [
    autoInit,
    userId,
    isInitialized,
    initKeysMutation.isPending,
    initializeKeys,
  ]);

  const isLoading =
    initKeysMutation.isPending ||
    sendMessageMutation.isPending ||
    isLoadingMessages ||
    isLoadingRecipientKey;

  return {
    isInitialized,
    isLoading,
    error,
    messages: messagesData ?? [],
    initializeKeys,
    sendMessage,
    fetchMessages,
    publicKey,
  };
}
