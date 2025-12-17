/**
 * Decentralized Messaging Client - E2EE via X25519 + AES-256-GCM with on-chain key registry.
 */

import {
  type Address,
  createPublicClient,
  type Hex,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { KEY_REGISTRY_ABI } from './abis';
import {
  bytes32ToPublicKey,
  bytesToHex,
  decryptMessage,
  deriveKeyPair,
  encryptMessage,
  generateKeyPair,
  publicKeyToBytes32,
} from './crypto';
import type {
  DecryptedMessage,
  EncryptionKeys,
  MessageEnvelope,
  MessageEvent,
  MessagingConfig,
} from './types';
import { ErrorCodes, MessagingError } from './types';

export class DecentralizedMessagingClient {
  private config: MessagingConfig;
  private publicClient: PublicClient;
  private keyPair?: EncryptionKeys;
  private ws?: WebSocket;
  private eventListeners: Set<(event: MessageEvent) => void> = new Set();
  private isInitialized = false;

  constructor(config: MessagingConfig) {
    this.config = config;
    this.publicClient = createPublicClient({ transport: http(config.rpcUrl) });
  }

  async initialize(walletSignature: string): Promise<void> {
    this.keyPair = deriveKeyPair(walletSignature);
    this.isInitialized = true;
    if (this.config.relayUrl) await this.connectToRelay(this.config.relayUrl);
  }

  initializeWithRandomKeys(): void {
    this.keyPair = generateKeyPair();
    this.isInitialized = true;
  }

  getKeyDerivationMessage(): string {
    return `Sign this message to enable encrypted messaging on Babylon.\n\nThis signature will be used to derive your encryption keys.\n\nAddress: ${this.config.address}`;
  }

  getPublicKeyHex(): string {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED
      );
    return bytesToHex(this.keyPair.publicKey);
  }

  async registerKeyOnChain(walletClient: WalletClient): Promise<Hex> {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NO_KEY_BUNDLE
      );
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'KeyRegistry not configured',
        ErrorCodes.CONTRACT_ERROR
      );

    const identityKey = publicKeyToBytes32(this.keyPair.publicKey);
    return walletClient.writeContract({
      chain: null,
      account: walletClient.account!,
      address: this.config.keyRegistryAddress,
      abi: KEY_REGISTRY_ABI,
      functionName: 'registerKeyBundle',
      args: [identityKey, identityKey, ('0x' + '00'.repeat(32)) as Hex],
    });
  }

  async getRecipientPublicKey(recipientAddress: Address): Promise<Uint8Array> {
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'KeyRegistry not configured',
        ErrorCodes.CONTRACT_ERROR
      );

    const keyBundle = (await this.publicClient.readContract({
      address: this.config.keyRegistryAddress,
      abi: KEY_REGISTRY_ABI,
      functionName: 'getKeyBundle',
      args: [recipientAddress],
    })) as { identityKey: Hex; isActive: boolean };

    if (!keyBundle.isActive) {
      throw new MessagingError(
        `Recipient ${recipientAddress} has no registered keys`,
        ErrorCodes.RECIPIENT_KEY_NOT_FOUND
      );
    }
    return bytes32ToPublicKey(keyBundle.identityKey);
  }

  async sendMessage(to: Address, content: string): Promise<string> {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED
      );
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'Cannot resolve recipient key',
        ErrorCodes.RECIPIENT_KEY_NOT_FOUND
      );

    const recipientPublicKey = await this.getRecipientPublicKey(to);
    const encrypted = encryptMessage(content, recipientPublicKey, this.keyPair);

    const envelope: MessageEnvelope = {
      id: crypto.randomUUID(),
      from: this.config.address,
      to,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      ephemeralPublicKey: encrypted.ephemeralPublicKey,
      timestamp: Date.now(),
    };

    if (!this.config.relayUrl)
      throw new MessagingError(
        'No relay configured',
        ErrorCodes.RELAY_UNAVAILABLE
      );
    await this.sendViaRelay(envelope);
    return envelope.id;
  }

  private async sendViaRelay(envelope: MessageEnvelope): Promise<void> {
    if (!this.config.relayUrl)
      throw new MessagingError(
        'Relay not configured',
        ErrorCodes.RELAY_UNAVAILABLE
      );

    const response = await fetch(`${this.config.relayUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: envelope.id,
        from: envelope.from,
        to: envelope.to,
        ciphertext: bytesToHex(envelope.ciphertext),
        nonce: bytesToHex(envelope.nonce),
        ephemeralPublicKey: bytesToHex(envelope.ephemeralPublicKey),
        timestamp: envelope.timestamp,
      }),
    });

    if (!response.ok)
      throw new MessagingError(
        `Relay error: ${await response.text()}`,
        ErrorCodes.RELAY_UNAVAILABLE
      );
  }

  async fetchPendingMessages(): Promise<DecryptedMessage[]> {
    if (!this.config.relayUrl) return [];

    const response = await fetch(
      `${this.config.relayUrl}/messages/${this.config.address}`
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      messages: Array<{
        id: string;
        from: string;
        to: string;
        ciphertext: string;
        nonce: string;
        ephemeralPublicKey: string;
        timestamp: number;
      }>;
    };

    return Promise.all(
      data.messages.map(async (msg) => ({
        id: msg.id,
        from: msg.from as Address,
        to: msg.to as Address,
        content: await this.decryptMessageContent({
          ciphertext: hexToBytes(msg.ciphertext),
          nonce: hexToBytes(msg.nonce),
          ephemeralPublicKey: hexToBytes(msg.ephemeralPublicKey),
        }),
        timestamp: new Date(msg.timestamp),
        isDecentralized: true,
      }))
    );
  }

  private async decryptMessageContent(encrypted: {
    ciphertext: Uint8Array;
    nonce: Uint8Array;
    ephemeralPublicKey: Uint8Array;
  }): Promise<string> {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED
      );
    return decryptMessage(
      encrypted.ciphertext,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      this.keyPair
    );
  }

  private async connectToRelay(relayUrl: string): Promise<void> {
    const wsUrl = relayUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({ type: 'subscribe', address: this.config.address })
      );
      this.emit({ type: 'connection:status', data: { connected: true } });
    };

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data as string) as {
        type: string;
        message?: {
          id: string;
          from: string;
          to: string;
          ciphertext: string;
          nonce: string;
          ephemeralPublicKey: string;
          timestamp: number;
        };
      };

      if (data.type === 'new_message' && data.message) {
        const msg = data.message;
        const content = await this.decryptMessageContent({
          ciphertext: hexToBytes(msg.ciphertext),
          nonce: hexToBytes(msg.nonce),
          ephemeralPublicKey: hexToBytes(msg.ephemeralPublicKey),
        });
        this.emit({
          type: 'message:new',
          data: {
            id: msg.id,
            from: msg.from as Address,
            to: msg.to as Address,
            content,
            timestamp: new Date(msg.timestamp),
            isDecentralized: true,
          },
        });
      }
    };

    this.ws.onclose = () =>
      this.emit({ type: 'connection:status', data: { connected: false } });
  }

  onMessage(listener: (event: MessageEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: MessageEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
    this.eventListeners.clear();
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export const createMessagingClient = (config: MessagingConfig) =>
  new DecentralizedMessagingClient(config);
