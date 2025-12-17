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

interface Sender {
  id: string;
  displayName: string;
  username: string | null;
  profileImageUrl: string | null;
}

interface RawMessage {
  id: string;
  from: string;
  to: string;
  encryptedContent: string;
  timestamp: number;
  sender: Sender;
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

  const keyPairRef = useRef<EncryptionKeyPair | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DecentralizedMessage[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Recipient's public key (fetched from API)
  const recipientKeyRef = useRef<Uint8Array | null>(null);

  // Initialize encryption keys
  const initializeKeys = useCallback(async () => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Generate key pair
    const keyPair = generateKeyPair();
    keyPairRef.current = keyPair;

    const pubKeyHex = '0x' + publicKeyToHex(keyPair.publicKey);
    setPublicKey(pubKeyHex);

    // Register key with API
    const response = await fetch('/api/messaging/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: pubKeyHex }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? 'Failed to register keys');
      setIsLoading(false);
      return;
    }

    setIsInitialized(true);
    setIsLoading(false);
  }, [userId]);

  // Fetch recipient's public key
  const fetchRecipientKey = useCallback(async () => {
    if (!recipientAddress) return null;

    const response = await fetch(`/api/messaging/keys/${recipientAddress}`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { publicKey: string };

    // Convert hex to Uint8Array
    const hex = data.publicKey.startsWith('0x')
      ? data.publicKey.slice(2)
      : data.publicKey;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    recipientKeyRef.current = bytes;
    return bytes;
  }, [recipientAddress]);

  // Send encrypted message
  const sendMessage = useCallback(
    async (content: string): Promise<string> => {
      if (!keyPairRef.current) {
        throw new Error('Keys not initialized');
      }
      if (!recipientAddress) {
        throw new Error('No recipient address');
      }

      setIsLoading(true);
      setError(null);

      // Ensure we have recipient's key
      let recipientKey = recipientKeyRef.current;
      if (!recipientKey) {
        recipientKey = await fetchRecipientKey();
        if (!recipientKey) {
          setError('Recipient has not registered encryption keys');
          setIsLoading(false);
          throw new Error('Recipient key not found');
        }
      }

      // Encrypt message
      const encrypted = encryptMessage(
        content,
        recipientKey,
        keyPairRef.current
      );

      const encryptedContent = serializeEncryptedMessage(encrypted);

      // Send to API
      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientAddress,
          encryptedContent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Failed to send message');
        setIsLoading(false);
        throw new Error(data.error ?? 'Failed to send');
      }

      const result = (await response.json()) as {
        messageId: string;
        timestamp: number;
      };

      // Add to local messages (optimistic update)
      const newMessage: DecentralizedMessage = {
        id: result.messageId,
        from: userWalletAddress ?? '',
        to: recipientAddress,
        content,
        timestamp: new Date(result.timestamp),
        status: 'pending',
        isDecentralized: true,
      };

      setMessages((prev) => [...prev, newMessage]);
      setIsLoading(false);

      return result.messageId;
    },
    [recipientAddress, fetchRecipientKey, userWalletAddress]
  );

  // Fetch and decrypt messages
  const fetchMessages = useCallback(async () => {
    if (!keyPairRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetch('/api/messaging/inbox');
    if (!response.ok) {
      setError('Failed to fetch messages');
      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as { messages: RawMessage[] };

    // Decrypt messages
    const decrypted: DecentralizedMessage[] = [];

    for (const msg of data.messages) {
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

    setMessages(decrypted);
    setIsLoading(false);
  }, []);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInit && userId && !isInitialized && !isLoading) {
      initializeKeys();
    }
  }, [autoInit, userId, isInitialized, isLoading, initializeKeys]);

  // Fetch recipient key when address changes
  useEffect(() => {
    if (recipientAddress && isInitialized) {
      fetchRecipientKey();
    }
  }, [recipientAddress, isInitialized, fetchRecipientKey]);

  return {
    isInitialized,
    isLoading,
    error,
    messages,
    initializeKeys,
    sendMessage,
    fetchMessages,
    publicKey,
  };
}
