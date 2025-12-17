/**
 * DID Resolver
 *
 * Resolves DIDs to their documents.
 * Supports caching and multiple resolution strategies.
 */

import type { DID, DIDDocument } from '../types/index';
import { parseDID, validateDID } from './utils';

export interface ResolverConfig {
  /** Enable caching */
  cache: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Resolution endpoints by network */
  endpoints: Record<string, string>;
}

interface CacheEntry {
  document: DIDDocument;
  expiresAt: number;
}

const DEFAULT_CONFIG: ResolverConfig = {
  cache: true,
  cacheTTL: 60_000, // 1 minute
  endpoints: {
    mainnet: 'https://did.jeju.network/v1',
    testnet: 'https://testnet.did.jeju.network/v1',
    localnet: 'http://localhost:4011/v1',
  },
};

/**
 * DID Resolver
 *
 * Resolves did:jeju identifiers to DID documents.
 */
export class DIDResolver {
  private config: ResolverConfig;
  private cache: Map<DID, CacheEntry> = new Map();

  constructor(config: Partial<ResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve a DID to its document
   */
  async resolve(did: DID): Promise<DIDDocument | null> {
    if (!validateDID(did)) {
      throw new Error(`Invalid DID: ${did}`);
    }

    // Check cache
    if (this.config.cache) {
      const cached = this.cache.get(did);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.document;
      }
    }

    // Resolve from network
    const document = await this.resolveFromNetwork(did);

    // Cache result
    if (document && this.config.cache) {
      this.cache.set(did, {
        document,
        expiresAt: Date.now() + this.config.cacheTTL,
      });
    }

    return document;
  }

  /**
   * Resolve from network
   */
  private async resolveFromNetwork(did: DID): Promise<DIDDocument | null> {
    const { network } = parseDID(did);
    const endpoint = this.config.endpoints[network];

    if (!endpoint) {
      throw new Error(`Unknown network: ${network}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(`${endpoint}/did/${encodeURIComponent(did)}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Resolution failed: ${response.status}`);
    }

    return response.json() as Promise<DIDDocument>;
  }

  /**
   * Batch resolve multiple DIDs
   */
  async resolveMany(dids: DID[]): Promise<Map<DID, DIDDocument | null>> {
    const results = new Map<DID, DIDDocument | null>();

    await Promise.all(
      dids.map(async (did) => {
        const doc = await this.resolve(did).catch(() => null);
        results.set(did, doc);
      })
    );

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific entry from cache
   */
  invalidate(did: DID): void {
    this.cache.delete(did);
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would track in production
    };
  }
}
