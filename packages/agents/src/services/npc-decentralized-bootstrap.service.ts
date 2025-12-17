/**
 * NPC Decentralized Bootstrap Service
 *
 * Initializes all NPCs with fully decentralized identities:
 * - Ethereum wallets (via Jeju KMS)
 * - Farcaster FIDs (on Optimism)
 * - Encryption keys (on Jeju KeyRegistry)
 *
 * This service runs at server startup and ensures all NPCs
 * are ready for decentralized messaging and Farcaster posting.
 *
 * @packageDocumentation
 */

import { type StaticActor, StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import { getFarcasterPostingService } from '../farcaster/FarcasterPostingService';
import {
  getNPCIdentityService,
  type NPCIdentity,
} from '../identity/NPCIdentityService';

/**
 * Bootstrap result for a single NPC with decentralized identity
 */
export interface DecentralizedNPCBootstrapResult {
  actorId: string;
  success: boolean;
  identity?: NPCIdentity;
  error?: string;
  steps: {
    wallet: boolean;
    farcaster: boolean;
    encryption: boolean;
  };
}

/**
 * Overall bootstrap result
 */
export interface DecentralizedBootstrapResult {
  total: number;
  success: number;
  failed: number;
  results: DecentralizedNPCBootstrapResult[];
  duration: number;
}

/**
 * Configuration for decentralized bootstrap
 */
export interface DecentralizedBootstrapConfig {
  /** Enable Farcaster registration (costs gas) */
  enableFarcasterRegistration: boolean;
  /** Enable encryption key registration */
  enableEncryptionKeys: boolean;
  /** Batch size for parallel initialization */
  batchSize: number;
  /** Delay between batches (ms) */
  batchDelay: number;
  /** Skip NPCs that already have identities */
  skipExisting: boolean;
  /** Specific actor IDs to initialize (empty = all) */
  actorIds?: string[];
}

const DEFAULT_CONFIG: DecentralizedBootstrapConfig = {
  enableFarcasterRegistration: false, // Start disabled, enable when ready
  enableEncryptionKeys: true,
  batchSize: 10,
  batchDelay: 1000,
  skipExisting: true,
};

/**
 * Service for bootstrapping decentralized NPC identities
 */
export class NPCDecentralizedBootstrapService {
  private static instance: NPCDecentralizedBootstrapService;
  private _initialized = false;
  private bootstrapResults: Map<string, DecentralizedNPCBootstrapResult> =
    new Map();

  private constructor() {}

  static getInstance(): NPCDecentralizedBootstrapService {
    if (!NPCDecentralizedBootstrapService.instance) {
      NPCDecentralizedBootstrapService.instance =
        new NPCDecentralizedBootstrapService();
    }
    return NPCDecentralizedBootstrapService.instance;
  }

  /**
   * Bootstrap all NPCs with decentralized identities
   */
  async bootstrapAll(
    config: Partial<DecentralizedBootstrapConfig> = {}
  ): Promise<DecentralizedBootstrapResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      'Starting decentralized NPC bootstrap',
      {
        enableFarcaster: fullConfig.enableFarcasterRegistration,
        enableEncryption: fullConfig.enableEncryptionKeys,
        batchSize: fullConfig.batchSize,
      },
      'NPCDecentralizedBootstrap'
    );

    // Get actors to initialize
    const allActors = StaticDataRegistry.getAllActors();
    const actors = fullConfig.actorIds?.length
      ? allActors.filter((a) => fullConfig.actorIds!.includes(a.id))
      : allActors;

    const results: DecentralizedNPCBootstrapResult[] = [];

    // Process in batches
    for (let i = 0; i < actors.length; i += fullConfig.batchSize) {
      const batch = actors.slice(i, i + fullConfig.batchSize);

      const batchResults = await Promise.all(
        batch.map((actor) => this.bootstrapSingleNPC(actor, fullConfig))
      );

      results.push(...batchResults);

      // Log progress
      const completed = Math.min(i + fullConfig.batchSize, actors.length);
      logger.info(
        `Bootstrap progress: ${completed}/${actors.length}`,
        undefined,
        'NPCDecentralizedBootstrap'
      );

      // Delay between batches
      if (i + fullConfig.batchSize < actors.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, fullConfig.batchDelay)
        );
      }
    }

    const duration = Date.now() - startTime;
    const success = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const result: DecentralizedBootstrapResult = {
      total: actors.length,
      success,
      failed,
      results,
      duration,
    };

    logger.info(
      'Decentralized NPC bootstrap complete',
      {
        total: result.total,
        success,
        failed,
        durationMs: duration,
      },
      'NPCDecentralizedBootstrap'
    );

    this._initialized = true;
    return result;
  }

  /**
   * Bootstrap a single NPC
   */
  private async bootstrapSingleNPC(
    actor: StaticActor,
    config: DecentralizedBootstrapConfig
  ): Promise<DecentralizedNPCBootstrapResult> {
    const result: DecentralizedNPCBootstrapResult = {
      actorId: actor.id,
      success: false,
      steps: {
        wallet: false,
        farcaster: false,
        encryption: false,
      },
    };

    try {
      // Check if already bootstrapped
      if (config.skipExisting && this.bootstrapResults.has(actor.id)) {
        const existing = this.bootstrapResults.get(actor.id)!;
        if (existing.success) {
          return existing;
        }
      }

      const identityService = getNPCIdentityService({
        enableExternalFarcaster: config.enableFarcasterRegistration,
      });

      // Initialize full identity
      const identity = await identityService.initializeNPCIdentity(actor.id);

      result.identity = identity;
      result.steps.wallet = !!identity.walletAddress;
      result.steps.farcaster = config.enableFarcasterRegistration
        ? !!identity.farcasterFid && identity.farcasterFid > 0
        : true; // Skip if not enabled
      result.steps.encryption = config.enableEncryptionKeys
        ? !!identity.encryptionKeyId
        : true; // Skip if not enabled

      result.success =
        result.steps.wallet &&
        (result.steps.farcaster || !config.enableFarcasterRegistration) &&
        (result.steps.encryption || !config.enableEncryptionKeys);

      this.bootstrapResults.set(actor.id, result);

      logger.debug(
        `Bootstrapped NPC: ${actor.id}`,
        {
          wallet: result.steps.wallet,
          farcaster: result.steps.farcaster,
          encryption: result.steps.encryption,
        },
        'NPCDecentralizedBootstrap'
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      logger.warn(
        `Failed to bootstrap NPC: ${actor.id}`,
        { error: result.error },
        'NPCDecentralizedBootstrap'
      );
    }

    return result;
  }

  /**
   * Get bootstrap result for an NPC
   */
  getBootstrapResult(
    actorId: string
  ): DecentralizedNPCBootstrapResult | undefined {
    return this.bootstrapResults.get(actorId);
  }

  /**
   * Check if an NPC is fully bootstrapped
   */
  isBootstrapped(actorId: string): boolean {
    const result = this.bootstrapResults.get(actorId);
    return result?.success ?? false;
  }

  /**
   * Get all bootstrap results
   */
  getAllResults(): DecentralizedNPCBootstrapResult[] {
    return Array.from(this.bootstrapResults.values());
  }

  /**
   * Get bootstrap statistics
   */
  getStats(): {
    total: number;
    bootstrapped: number;
    pending: number;
    failed: number;
  } {
    const allActors = StaticDataRegistry.getAllActors();
    const results = this.getAllResults();
    const bootstrapped = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success && r.error).length;

    return {
      total: allActors.length,
      bootstrapped,
      pending: allActors.length - results.length,
      failed,
    };
  }

  /**
   * Post as an NPC to Farcaster
   * Convenience method that ensures the NPC is bootstrapped first
   */
  async postAsNPC(
    actorId: string,
    text: string
  ): Promise<{
    success: boolean;
    hash?: string;
    error?: string;
  }> {
    // Ensure NPC is bootstrapped
    if (!this.isBootstrapped(actorId)) {
      const actor = StaticDataRegistry.getActor(actorId);
      if (!actor) {
        return { success: false, error: `Actor not found: ${actorId}` };
      }

      await this.bootstrapSingleNPC(actor, {
        ...DEFAULT_CONFIG,
        enableFarcasterRegistration: true,
      });
    }

    // Post via FarcasterPostingService
    const postingService = getFarcasterPostingService();
    return postingService.postAsNPC(actorId, text);
  }

  /**
   * Reset service state (for testing)
   */
  reset(): void {
    this.bootstrapResults.clear();
    this._initialized = false;
  }

  /**
   * Check if bootstrap has run
   */
  get initialized(): boolean {
    return this._initialized;
  }
}

// Singleton accessor
export function getNPCDecentralizedBootstrapService(): NPCDecentralizedBootstrapService {
  return NPCDecentralizedBootstrapService.getInstance();
}
