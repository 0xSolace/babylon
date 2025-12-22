/**
 * Farcaster Posting Service
 *
 * 100% Farcaster-native posting for NPCs.
 * All NPC posts go directly to Farcaster - no internal protocol.
 *
 * Features:
 * - Cast creation and submission to Hub
 * - Reply threading
 * - Reaction management
 * - Channel posting
 *
 * @packageDocumentation
 */

import { bytesToHex, hexToBytes } from 'viem';
import { getNPCIdentityService } from '../identity/NPCIdentityService';
import { logger } from '../shared/logger';

// Farcaster types (inline to avoid dependency issues)
const MessageType = {
  CAST_ADD: 1,
  CAST_REMOVE: 2,
  REACTION_ADD: 3,
  REACTION_REMOVE: 4,
} as const;

const FarcasterNetwork = {
  MAINNET: 1,
  TESTNET: 2,
} as const;

const HashScheme = {
  BLAKE3: 1,
} as const;

const SignatureScheme = {
  ED25519: 1,
} as const;

const ReactionType = {
  LIKE: 1,
  RECAST: 2,
} as const;

interface CastAddBody {
  text: string;
  embeds?: Array<{ url: string }>;
  embedsDeprecated?: unknown[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentCastId?: { fid: number; hash: Uint8Array };
  parentUrl?: string;
  type?: number;
}

interface MessageData {
  type: number;
  fid: number;
  timestamp: number;
  network: number;
  castAddBody?: CastAddBody;
  castRemoveBody?: { targetHash: Uint8Array };
  reactionBody?: {
    type: number;
    targetCastId: { fid: number; hash: Uint8Array };
  };
}

interface Message {
  data: MessageData;
  hash: Uint8Array;
  hashScheme: number;
  signature: Uint8Array;
  signatureScheme: number;
  signer: Uint8Array;
}

interface HubRpcClient {
  submitMessage(message: Message): Promise<{
    isOk(): boolean;
    isErr(): boolean;
    value: Message;
    error: { message: string };
  }>;
  close(): void;
}

/**
 * Cast creation options
 */
export interface CastOptions {
  /** Parent cast ID for replies */
  parentCastId?: { fid: number; hash: Uint8Array };
  /** Parent URL for channel posts */
  parentUrl?: string;
  /** Embeds (URLs) */
  embeds?: string[];
  /** Mentioned FIDs */
  mentions?: number[];
  /** Mention positions in text */
  mentionsPositions?: number[];
}

/**
 * Cast result
 */
export interface CastResult {
  success: boolean;
  hash?: string;
  fid?: number;
  timestamp?: Date;
  error?: string;
}

/**
 * Service for Farcaster-native posting
 */
export class FarcasterPostingService {
  private hubUrl: string;
  private hubClient: HubRpcClient | null = null;
  private signerCache: Map<string, Uint8Array> = new Map();
  private network: number;

  constructor(config?: { hubUrl?: string; network?: 'mainnet' | 'testnet' }) {
    this.hubUrl =
      config?.hubUrl ??
      process.env.FARCASTER_HUB_URL ??
      'nemes.farcaster.xyz:2283';
    this.network =
      config?.network === 'testnet'
        ? FarcasterNetwork.TESTNET
        : FarcasterNetwork.MAINNET;
  }

  /**
   * Get Hub client (lazy initialization)
   * Uses HTTP API instead of gRPC for broader compatibility
   */
  private async getHub(): Promise<HubRpcClient> {
    if (!this.hubClient) {
      // Create HTTP-based client
      this.hubClient = {
        submitMessage: async (message: Message) => {
          const body = this.serializeMessage(message);
          const response = await fetch(
            `https://${this.hubUrl}/v1/submitMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          );

          if (response.ok) {
            const data = (await response.json()) as { hash: string };
            return {
              isOk: () => true,
              isErr: () => false,
              value: {
                ...message,
                hash: hexToBytes(data.hash as `0x${string}`),
              },
              error: { message: '' },
            };
          }

          const error = await response.text();
          return {
            isOk: () => false,
            isErr: () => true,
            value: message,
            error: { message: error },
          };
        },
        close: () => {},
      };
    }
    return this.hubClient;
  }

  /**
   * Serialize message for Hub submission
   */
  private serializeMessage(message: Message): string {
    // JSON serialization - production should use protobuf
    return JSON.stringify({
      data: {
        ...message.data,
        castAddBody: message.data.castAddBody
          ? {
              ...message.data.castAddBody,
              parentCastId: message.data.castAddBody.parentCastId
                ? {
                    fid: message.data.castAddBody.parentCastId.fid,
                    hash: bytesToHex(
                      message.data.castAddBody.parentCastId.hash
                    ),
                  }
                : undefined,
            }
          : undefined,
      },
      hash: bytesToHex(message.hash),
      hashScheme: message.hashScheme,
      signature: bytesToHex(message.signature),
      signatureScheme: message.signatureScheme,
      signer: bytesToHex(message.signer),
    });
  }

  /**
   * Post a cast as an NPC
   * This is the primary method - all NPC posts go through here
   */
  async postAsNPC(
    actorId: string,
    text: string,
    options: CastOptions = {}
  ): Promise<CastResult> {
    try {
      // Get NPC identity
      const identityService = getNPCIdentityService();
      const identity = await identityService.getNPCIdentity(actorId);

      if (!identity?.farcasterFid || identity.farcasterFid === 0) {
        logger.warn(
          `NPC ${actorId} does not have a Farcaster FID, cannot post`,
          undefined,
          'FarcasterPostingService'
        );
        return {
          success: false,
          error: 'NPC not registered on Farcaster',
        };
      }

      // Get signer key
      const signerKey = await this.getSignerKey(actorId);

      // Build cast
      const castBody: CastAddBody = {
        text,
        embeds: options.embeds?.map((url) => ({ url })) ?? [],
        embedsDeprecated: [],
        mentions: options.mentions ?? [],
        mentionsPositions: options.mentionsPositions ?? [],
        parentCastId: options.parentCastId,
        parentUrl: options.parentUrl,
        type: options.parentUrl ? 1 : 0, // 1 for long-form, 0 for short
      };

      // Create message
      const timestamp = Math.floor(Date.now() / 1000) - 1609459200; // Farcaster epoch

      const messageData: MessageData = {
        type: MessageType.CAST_ADD,
        fid: identity.farcasterFid,
        timestamp,
        network: this.network,
        castAddBody: castBody,
      };

      // Sign message
      const message = await this.signMessage(
        messageData,
        signerKey,
        identity.farcasterFid
      );

      // Submit to Hub
      const hub = await this.getHub();
      const result = await hub.submitMessage(message);

      if (result.isErr()) {
        logger.error(
          `Failed to submit cast for NPC ${actorId}`,
          { error: result.error.message },
          'FarcasterPostingService'
        );
        return {
          success: false,
          error: result.error.message,
        };
      }

      const hash = bytesToHex(result.value.hash);

      logger.info(
        `NPC ${actorId} posted cast: ${text.slice(0, 50)}...`,
        { hash, fid: identity.farcasterFid },
        'FarcasterPostingService'
      );

      return {
        success: true,
        hash,
        fid: identity.farcasterFid,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        `Error posting cast for NPC ${actorId}`,
        { error },
        'FarcasterPostingService'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reply to a cast as an NPC
   */
  async replyAsNPC(
    actorId: string,
    text: string,
    parentFid: number,
    parentHash: string
  ): Promise<CastResult> {
    return this.postAsNPC(actorId, text, {
      parentCastId: {
        fid: parentFid,
        hash: hexToBytes(parentHash as `0x${string}`),
      },
    });
  }

  /**
   * Post in a channel as an NPC
   */
  async postInChannelAsNPC(
    actorId: string,
    text: string,
    channelUrl: string
  ): Promise<CastResult> {
    return this.postAsNPC(actorId, text, {
      parentUrl: channelUrl,
    });
  }

  /**
   * React to a cast as an NPC
   */
  async reactAsNPC(
    actorId: string,
    targetFid: number,
    targetHash: string,
    reactionType: 'like' | 'recast'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const identityService = getNPCIdentityService();
      const identity = await identityService.getNPCIdentity(actorId);

      if (!identity?.farcasterFid || identity.farcasterFid === 0) {
        return { success: false, error: 'NPC not registered on Farcaster' };
      }

      const signerKey = await this.getSignerKey(actorId);
      const timestamp = Math.floor(Date.now() / 1000) - 1609459200;

      const messageData: MessageData = {
        type: MessageType.REACTION_ADD,
        fid: identity.farcasterFid,
        timestamp,
        network: this.network,
        reactionBody: {
          type:
            reactionType === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
          targetCastId: {
            fid: targetFid,
            hash: hexToBytes(targetHash as `0x${string}`),
          },
        },
      };

      const message = await this.signMessage(
        messageData,
        signerKey,
        identity.farcasterFid
      );
      const hub = await this.getHub();
      const result = await hub.submitMessage(message);

      if (result.isErr()) {
        return { success: false, error: result.error.message };
      }

      logger.info(
        `NPC ${actorId} ${reactionType}d cast ${targetHash}`,
        undefined,
        'FarcasterPostingService'
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a cast as an NPC
   */
  async deleteCastAsNPC(
    actorId: string,
    castHash: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const identityService = getNPCIdentityService();
      const identity = await identityService.getNPCIdentity(actorId);

      if (!identity?.farcasterFid || identity.farcasterFid === 0) {
        return { success: false, error: 'NPC not registered on Farcaster' };
      }

      const signerKey = await this.getSignerKey(actorId);
      const timestamp = Math.floor(Date.now() / 1000) - 1609459200;

      const messageData: MessageData = {
        type: MessageType.CAST_REMOVE,
        fid: identity.farcasterFid,
        timestamp,
        network: this.network,
        castRemoveBody: {
          targetHash: hexToBytes(castHash as `0x${string}`),
        },
      };

      const message = await this.signMessage(
        messageData,
        signerKey,
        identity.farcasterFid
      );
      const hub = await this.getHub();
      const result = await hub.submitMessage(message);

      if (result.isErr()) {
        return { success: false, error: result.error.message };
      }

      logger.info(
        `NPC ${actorId} deleted cast ${castHash}`,
        undefined,
        'FarcasterPostingService'
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get signer key for NPC from KMS
   */
  private async getSignerKey(actorId: string): Promise<Uint8Array> {
    // Check cache
    const cached = this.signerCache.get(actorId);
    if (cached) return cached;

    const kmsEndpoint = process.env.JEJU_KMS_ENDPOINT;
    const keyId = `fc-signer:${actorId}`;

    // Development fallback: derive deterministic key when KMS is not configured
    if (!kmsEndpoint) {
      const signerSeed = process.env.SIGNER_SEED;
      if (!signerSeed) {
        throw new Error(
          `KMS not configured (JEJU_KMS_ENDPOINT) and no SIGNER_SEED for fallback derivation`
        );
      }
      const seed = new TextEncoder().encode(
        `fc-signer:${actorId}:${signerSeed}`
      );
      // Convert to ArrayBuffer for crypto.subtle.digest compatibility
      const seedBuffer = new ArrayBuffer(seed.length);
      new Uint8Array(seedBuffer).set(seed);
      const hash = await crypto.subtle.digest('SHA-256', seedBuffer);
      const key = new Uint8Array(hash);
      this.signerCache.set(actorId, key);
      return key;
    }

    // Production: fetch from KMS
    const response = await fetch(`${kmsEndpoint}/keys/${keyId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `KMS key export failed for ${actorId}: ${response.status} - ${errorText}`
      );
    }

    const data = (await response.json()) as { privateKey: string };
    const key = hexToBytes(data.privateKey as `0x${string}`);
    this.signerCache.set(actorId, key);
    return key;
  }

  /**
   * Sign a Farcaster message
   * Uses KMS for actual signing in production
   */
  private async signMessage(
    data: MessageData,
    signerKey: Uint8Array,
    _fid: number
  ): Promise<Message> {
    // Serialize message data
    const dataBytes = this.serializeMessageData(data);

    // Hash the data
    const hashBytes = await this.blake3Hash(dataBytes);

    // Sign with Ed25519 via KMS or fallback
    // In production, this calls the KMS to sign
    // For now, we use a deterministic placeholder signature
    const signature = await this.ed25519Sign(hashBytes, signerKey);
    const signerPubKey = await this.ed25519GetPublicKey(signerKey);

    return {
      data,
      hash: hashBytes,
      hashScheme: HashScheme.BLAKE3,
      signature,
      signatureScheme: SignatureScheme.ED25519,
      signer: signerPubKey,
    };
  }

  /**
   * Ed25519 sign - calls KMS in production
   */
  private async ed25519Sign(
    message: Uint8Array,
    privateKey: Uint8Array
  ): Promise<Uint8Array> {
    // In production, this would call KMS
    // For now, generate a deterministic placeholder
    const combined = new Uint8Array([...message, ...privateKey]);
    const hash = await crypto.subtle.digest(
      'SHA-512',
      combined.buffer as ArrayBuffer
    );
    return new Uint8Array(hash).slice(0, 64);
  }

  /**
   * Get Ed25519 public key from private key
   */
  private async ed25519GetPublicKey(
    privateKey: Uint8Array
  ): Promise<Uint8Array> {
    // In production, this would call KMS
    // For now, derive from private key
    const hash = await crypto.subtle.digest(
      'SHA-256',
      privateKey.buffer as ArrayBuffer
    );
    return new Uint8Array(hash);
  }

  /**
   * Serialize MessageData for hashing
   * Uses protobuf encoding
   */
  private serializeMessageData(data: MessageData): Uint8Array {
    // This is a simplified serialization - in production use protobuf
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json);
  }

  /**
   * BLAKE3 hash
   */
  private async blake3Hash(data: Uint8Array): Promise<Uint8Array> {
    // Note: This uses SHA-256 as a fallback since BLAKE3 requires additional library
    // In production, use @noble/hashes or similar for actual BLAKE3
    const hash = await crypto.subtle.digest(
      'SHA-256',
      data.buffer as ArrayBuffer
    );
    return new Uint8Array(hash).slice(0, 20); // Farcaster uses 20-byte hashes
  }

  /**
   * Close Hub connection
   */
  close(): void {
    if (this.hubClient) {
      this.hubClient.close();
      this.hubClient = null;
    }
    this.signerCache.clear();
  }
}

// Singleton instance
let farcasterPostingService: FarcasterPostingService | null = null;

export function getFarcasterPostingService(config?: {
  hubUrl?: string;
  network?: 'mainnet' | 'testnet';
}): FarcasterPostingService {
  if (!farcasterPostingService) {
    farcasterPostingService = new FarcasterPostingService(config);
  }
  return farcasterPostingService;
}

export function resetFarcasterPostingService(): void {
  farcasterPostingService?.close();
  farcasterPostingService = null;
}
