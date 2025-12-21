/**
 * Base L2 Bridge for Cross-Chain Messaging
 *
 * Enables users on Base to participate in the Jeju messaging protocol.
 * Uses L1 <-> L2 message passing for key registration and message routing.
 *
 * Architecture:
 * - Users on Base register their keys locally
 * - Bridge relays key registrations to Jeju L2
 * - Messages can be sent cross-chain via relay nodes
 *
 * @packageDocumentation
 */

import type { Address, Hex } from 'viem';

/**
 * Supported chains for messaging
 */
export enum MessagingChain {
  JEJU = 1,
  BASE = 8453,
  BASE_SEPOLIA = 84532,
  OPTIMISM = 10,
}

/**
 * Cross-chain message envelope
 */
export interface CrossChainMessage {
  id: string;
  sourceChain: MessagingChain;
  destinationChain: MessagingChain;
  sender: Address;
  recipient: Address;
  encryptedContent: string;
  ephemeralPublicKey: string;
  nonce: string;
  timestamp: number;
  bridgeNonce: bigint;
  signature?: Hex;
}

/**
 * Key registration across chains
 */
export interface CrossChainKeyRegistration {
  address: Address;
  identityKey: string;
  signedPreKey: string;
  preKeySignature: string;
  oneTimePreKeys: string[];
  sourceChain: MessagingChain;
  destinationChains: MessagingChain[];
  timestamp: number;
  signature: Hex;
}

/**
 * Bridge configuration
 */
export interface BaseBridgeConfig {
  /** Jeju L2 RPC URL */
  jejuRpcUrl: string;
  /** Base RPC URL */
  baseRpcUrl: string;
  /** Bridge contract on Jeju */
  jejuBridgeAddress: Address;
  /** Bridge contract on Base */
  baseBridgeAddress: Address;
  /** KeyRegistry on Jeju */
  jejuKeyRegistryAddress: Address;
  /** Relay node URL */
  relayNodeUrl: string;
}

/**
 * Base <-> Jeju messaging bridge client
 */
export class BaseBridgeClient {
  private config: BaseBridgeConfig;
  private pendingMessages: Map<string, CrossChainMessage> = new Map();

  constructor(config: Partial<BaseBridgeConfig> = {}) {
    this.config = {
      jejuRpcUrl:
        config.jejuRpcUrl ??
        process.env.JEJU_RPC_URL ??
        'http://localhost:8545',
      baseRpcUrl:
        config.baseRpcUrl ??
        process.env.BASE_RPC_URL ??
        'https://mainnet.base.org',
      jejuBridgeAddress: (config.jejuBridgeAddress ??
        process.env.JEJU_BRIDGE_ADDRESS ??
        '0x0') as Address,
      baseBridgeAddress: (config.baseBridgeAddress ??
        process.env.BASE_BRIDGE_ADDRESS ??
        '0x0') as Address,
      jejuKeyRegistryAddress: (config.jejuKeyRegistryAddress ??
        process.env.JEJU_KEY_REGISTRY_ADDRESS ??
        '0x0') as Address,
      relayNodeUrl:
        config.relayNodeUrl ??
        process.env.RELAY_NODE_URL ??
        'http://localhost:3400',
    };
  }

  /**
   * Register keys on Base and bridge to Jeju
   */
  async registerKeysFromBase(
    keys: {
      identityKey: string;
      signedPreKey: string;
      preKeySignature: string;
      oneTimePreKeys: string[];
    },
    userAddress: Address,
    signature: Hex
  ): Promise<{ txHash: string }> {
    const registration: CrossChainKeyRegistration = {
      address: userAddress,
      identityKey: keys.identityKey,
      signedPreKey: keys.signedPreKey,
      preKeySignature: keys.preKeySignature,
      oneTimePreKeys: keys.oneTimePreKeys,
      sourceChain: MessagingChain.BASE,
      destinationChains: [MessagingChain.JEJU],
      timestamp: Date.now(),
      signature,
    };

    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/register-keys`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registration),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to register keys: ${response.status} ${errorText}`
      );
    }

    const result = (await response.json()) as { txHash: string };
    return { txHash: result.txHash };
  }

  /**
   * Send a cross-chain message
   */
  async sendCrossChainMessage(
    sender: Address,
    recipient: Address,
    encryptedContent: string,
    ephemeralPublicKey: string,
    nonce: string,
    sourceChain: MessagingChain,
    destinationChain: MessagingChain
  ): Promise<{ messageId: string }> {
    const messageId = `xc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const message: CrossChainMessage = {
      id: messageId,
      sourceChain,
      destinationChain,
      sender,
      recipient,
      encryptedContent,
      ephemeralPublicKey,
      nonce,
      timestamp: Date.now(),
      bridgeNonce: BigInt(Date.now()),
    };

    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/send-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...message,
          bridgeNonce: message.bridgeNonce.toString(),
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to send cross-chain message: ${response.status} ${errorText}`
      );
    }

    this.pendingMessages.set(messageId, message);
    return { messageId };
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<{
    status: 'pending' | 'bridging' | 'delivered' | 'failed';
    sourceChain?: MessagingChain;
    destinationChain?: MessagingChain;
    deliveredAt?: number;
    error?: string;
  }> {
    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/message-status/${messageId}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get message status: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Fetch cross-chain messages for a recipient
   */
  async fetchCrossChainMessages(
    recipient: Address,
    destinationChain: MessagingChain
  ): Promise<CrossChainMessage[]> {
    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/messages/${recipient}?chain=${destinationChain}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch cross-chain messages: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { messages: CrossChainMessage[] };
    return data.messages.map((m) => ({
      ...m,
      bridgeNonce: BigInt(m.bridgeNonce as unknown as string),
    }));
  }

  /**
   * Check if a user has keys registered on a specific chain
   */
  async hasKeysOnChain(
    address: Address,
    chain: MessagingChain
  ): Promise<boolean> {
    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/has-keys/${address}?chain=${chain}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to check keys on chain: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { hasKeys: boolean };
    return data.hasKeys;
  }

  /**
   * Get the optimal route for a message (direct or bridged)
   */
  async getMessageRoute(
    sender: Address,
    recipient: Address
  ): Promise<{
    route: 'direct' | 'bridge';
    sourceChain: MessagingChain;
    destinationChain: MessagingChain;
    estimatedTime: number;
  }> {
    const response = await fetch(
      `${this.config.relayNodeUrl}/bridge/route?sender=${sender}&recipient=${recipient}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get message route: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }
}

// Factory function
export function createBaseBridgeClient(
  config?: Partial<BaseBridgeConfig>
): BaseBridgeClient {
  return new BaseBridgeClient(config);
}

// Singleton
let bridgeClient: BaseBridgeClient | null = null;

export function getBaseBridgeClient(): BaseBridgeClient {
  if (!bridgeClient) {
    bridgeClient = new BaseBridgeClient();
  }
  return bridgeClient;
}

export function resetBaseBridgeClient(): void {
  bridgeClient = null;
}
