/**
 * MPC Client - communicates with TEE nodes for threshold key/signing operations.
 * Dev mode uses single simulated node; production uses multiple TEE nodes.
 */

import { logger } from '@babylon/shared';
import type { Address, Hex } from 'viem';
import { keccak256, toBytes, toHex } from 'viem';
import type { AttestationQuote, DID, MPCNode } from '../types/index';

/** Redact sensitive data for logging - shows first 6 and last 4 chars */
function redactAddress(addr: Address | string | undefined): string {
  if (!addr) return '[none]';
  if (addr.length < 12) return '[invalid]';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Redact DID for logging - shows method and partial identifier */
function redactDID(did: DID | string | undefined): string {
  if (!did) return '[none]';
  const parts = did.split(':');
  if (parts.length < 4) return '[invalid-did]';
  const identifier = parts[3] ?? '';
  return `${parts[0]}:${parts[1]}:${parts[2]}:${redactAddress(identifier)}`;
}

import type {
  AuthProofData,
  KeyGenRequest,
  KeyGenResponse,
  MPCClientConfig,
  NetworkStatus,
  NodeStatus,
  SigningRequest,
  SigningResponse,
} from './types';

export { type MPCClientConfig };

/** Detect if running in production environment */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

const DEFAULT_CONFIG: MPCClientConfig = {
  endpoints: ['http://localhost:4010'],
  networkId: 'jeju-localnet',
  threshold: 1,
  timeout: 30_000,
  devMode: true,
};

export class MPCClient {
  private config: MPCClientConfig;
  private nodes: MPCNode[] = [];
  private initialized = false;

  constructor(config: Partial<MPCClientConfig> = {}) {
    // In production, require explicit devMode opt-in
    const effectiveDevMode =
      config.devMode ?? (isProduction() ? false : DEFAULT_CONFIG.devMode);

    this.config = { ...DEFAULT_CONFIG, ...config, devMode: effectiveDevMode };

    // Production safety checks
    if (isProduction()) {
      if (this.config.devMode) {
        logger.warn(
          'MPC client running in devMode in production - keys are derived locally, not via MPC network',
          undefined,
          'MPCClient'
        );
      }
      if (this.config.networkId === 'jeju-localnet') {
        logger.warn(
          'MPC client using localnet network ID in production',
          undefined,
          'MPCClient'
        );
      }
    }

    // Warn if threshold > 1 is configured (not yet supported)
    if (this.config.threshold > 1) {
      logger.warn(
        'Threshold > 1 configured but FROST aggregation not implemented. ' +
          'Signing operations with multiple nodes will fail.',
        { threshold: this.config.threshold },
        'MPCClient'
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.debug(
      'Initializing MPC client',
      {
        endpoints: this.config.endpoints.length,
        threshold: this.config.threshold,
      },
      'MPCClient'
    );
    await this.discoverNodes();

    const healthyCount = this.nodes.filter((n) => n.healthy).length;
    if (healthyCount < this.config.threshold) {
      logger.error(
        'MPC initialization failed',
        { healthyCount, threshold: this.config.threshold },
        'MPCClient'
      );
      throw new Error(
        `Insufficient healthy nodes: ${healthyCount}/${this.config.threshold} required`
      );
    }

    logger.info(
      'MPC client initialized',
      { healthyNodes: healthyCount, totalNodes: this.nodes.length },
      'MPCClient'
    );
    this.initialized = true;
  }

  private async discoverNodes(): Promise<void> {
    const results = await Promise.allSettled(
      this.config.endpoints.map((endpoint) => this.probeNode(endpoint))
    );
    this.nodes = results
      .filter(
        (r): r is PromiseFulfilledResult<MPCNode> => r.status === 'fulfilled'
      )
      .map((r) => r.value);
  }

  private async probeNode(endpoint: string): Promise<MPCNode> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${endpoint}/health`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`Node unhealthy: ${response.status}`);
    }

    const health = (await response.json()) as {
      nodeId: string;
      attestation: AttestationQuote;
      publicKey: Hex;
    };

    return {
      nodeId: health.nodeId,
      endpoint,
      attestation: health.attestation,
      publicKey: health.publicKey,
      healthy: true,
      lastHeartbeat: Date.now(),
    };
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    await this.ensureInitialized();

    const nodeStatuses: NodeStatus[] = this.nodes.map((node) => ({
      nodeId: node.nodeId,
      healthy: node.healthy,
      latencyMs: 0,
      attestation: {
        valid: true,
        isSimulated: node.attestation.isSimulated,
        mrEnclave: node.attestation.mrEnclave,
      },
    }));

    const healthyNodes = nodeStatuses.filter((n) => n.healthy).length;

    return {
      operational: healthyNodes >= this.config.threshold,
      healthyNodes,
      totalNodes: this.nodes.length,
      thresholdMet: healthyNodes >= this.config.threshold,
      nodes: nodeStatuses,
    };
  }

  async generateKey(
    userId: DID,
    authProof: AuthProofData
  ): Promise<KeyGenResponse> {
    await this.ensureInitialized();

    logger.debug(
      'Generating key',
      { userId: redactDID(userId), authType: authProof.type },
      'MPCClient'
    );
    const request: KeyGenRequest = { userId, authProof, timestamp: Date.now() };

    const result = this.config.devMode
      ? await this.devModeKeyGen(request)
      : await this.coordinatedKeyGen(request);

    if (result.success) {
      logger.info(
        'Key generated',
        {
          userId: redactDID(userId),
          walletAddress: redactAddress(result.walletAddress),
        },
        'MPCClient'
      );
    } else {
      logger.error(
        'Key generation failed',
        { userId: redactDID(userId), error: result.error },
        'MPCClient'
      );
    }
    return result;
  }

  private async devModeKeyGen(request: KeyGenRequest): Promise<KeyGenResponse> {
    if (!this.nodes[0]) {
      throw new Error('No MPC nodes available');
    }

    const seedMaterial = toBytes(request.userId);
    const privateKeyHash = keccak256(seedMaterial);
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(privateKeyHash);

    return {
      success: true,
      walletAddress: account.address,
      publicKey: privateKeyHash,
    };
  }

  private async coordinatedKeyGen(
    request: KeyGenRequest
  ): Promise<KeyGenResponse> {
    const responses = await Promise.allSettled(
      this.nodes.map((node) =>
        this.sendToNode<KeyGenResponse>(node, '/mpc/keygen', request)
      )
    );

    const successes = responses.filter(
      (r): r is PromiseFulfilledResult<KeyGenResponse> =>
        r.status === 'fulfilled' && r.value.success
    );

    if (successes.length < this.config.threshold) {
      return {
        success: false,
        error: `Key generation failed: only ${successes.length}/${this.config.threshold} nodes responded`,
      };
    }

    return {
      success: true,
      walletAddress: successes[0]?.value.walletAddress,
      publicKey: successes[0]?.value.publicKey,
    };
  }

  async sign(
    userId: DID,
    message: Hex,
    signatureType: SigningRequest['signatureType'] = 'message'
  ): Promise<SigningResponse> {
    await this.ensureInitialized();

    logger.debug(
      'Signing message',
      {
        userId: redactDID(userId),
        signatureType,
        messageLength: message.length,
      },
      'MPCClient'
    );
    const request: SigningRequest = {
      userId,
      message,
      signatureType,
      timestamp: Date.now(),
      nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    };

    const result = this.config.devMode
      ? await this.devModeSign(request)
      : await this.coordinatedSign(request);

    if (result.success) {
      logger.info(
        'Message signed',
        {
          userId: redactDID(userId),
          participants: result.participants?.length ?? 0,
        },
        'MPCClient'
      );
    } else {
      logger.error(
        'Signing failed',
        { userId: redactDID(userId), error: result.error },
        'MPCClient'
      );
    }
    return result;
  }

  private async devModeSign(request: SigningRequest): Promise<SigningResponse> {
    const seedMaterial = toBytes(request.userId);
    const privateKeyHash = keccak256(seedMaterial);
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(privateKeyHash);

    const signature = await account.signMessage({
      message: { raw: toBytes(request.message) },
    });

    const nodeId = this.nodes[0]?.nodeId ?? 'dev-node';
    return {
      success: true,
      signature: {
        signature,
        participants: [nodeId],
        threshold: 1,
        totalNodes: 1,
        recoveryId: 0,
      },
      participants: [nodeId],
    };
  }

  private async coordinatedSign(
    request: SigningRequest
  ): Promise<SigningResponse> {
    const responses = await Promise.allSettled(
      this.nodes.map((node) =>
        this.sendToNode<{ partialSignature: Hex; nodeId: string }>(
          node,
          '/mpc/sign',
          request
        )
      )
    );

    const successes = responses.filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        partialSignature: Hex;
        nodeId: string;
      }> => r.status === 'fulfilled'
    );

    if (successes.length < this.config.threshold) {
      return {
        success: false,
        error: `Signing failed: only ${successes.length}/${this.config.threshold} nodes responded`,
      };
    }

    // Threshold ECDSA requires: @noble/secp256k1 + FROST protocol implementation.
    // In production, each node contributes a partial signature share, and they are
    // combined using Lagrange interpolation. Currently, dev mode returns the first
    // partial signature since threshold=1 is typical for development.
    // See: https://eprint.iacr.org/2020/852.pdf (FROST spec)
    const combinedSignature = this.combineSignatures(
      successes.map((s) => s.value)
    );

    return {
      success: true,
      signature: {
        signature: combinedSignature,
        participants: successes.map((s) => s.value.nodeId),
        threshold: this.config.threshold,
        totalNodes: this.nodes.length,
        recoveryId: 0,
      },
      participants: successes.map((s) => s.value.nodeId),
    };
  }

  /**
   * Combine partial signatures from MPC nodes into a complete signature.
   *
   * CURRENT LIMITATION: Only threshold=1 is supported.
   * For threshold > 1, requires FROST protocol implementation.
   * See: https://eprint.iacr.org/2020/852.pdf
   */
  private combineSignatures(
    partials: Array<{ partialSignature: Hex; nodeId: string }>
  ): Hex {
    if (partials.length === 0) {
      throw new Error('No partial signatures to combine');
    }

    // Single signature - no combination needed
    if (partials.length === 1) {
      return partials[0]!.partialSignature;
    }

    // Multiple signatures with threshold=1 means we only need one
    if (this.config.threshold === 1) {
      return partials[0]!.partialSignature;
    }

    // Threshold > 1 requires FROST aggregation - not yet implemented
    // This is a hard error to prevent silent security failures
    throw new Error(
      `Threshold signature aggregation not implemented. ` +
        `Requested threshold=${this.config.threshold} but received ${partials.length} partial signatures. ` +
        `Use threshold=1 for single-node mode, or implement FROST protocol for multi-party signing.`
    );
  }

  private async sendToNode<T>(
    node: MPCNode,
    path: string,
    body: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    const response = await fetch(`${node.endpoint}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`Node ${node.nodeId} error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  getHealthyNodes(): MPCNode[] {
    return this.nodes.filter((n) => n.healthy);
  }

  async refreshHealth(): Promise<void> {
    for (const node of this.nodes) {
      const probed = await this.probeNode(node.endpoint).catch(() => null);
      if (probed) {
        node.healthy = true;
        node.lastHeartbeat = Date.now();
        node.attestation = probed.attestation;
      } else {
        node.healthy = false;
      }
    }
  }
}

export const createMPCClient = (config?: Partial<MPCClientConfig>) =>
  new MPCClient(config);
