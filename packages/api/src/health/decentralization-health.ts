/**
 * Decentralization Health Check
 *
 * Probes availability of decentralized components:
 * - TEE enclave (simulated vs real hardware)
 * - IPFS/Arweave storage connectivity
 * - KMS availability
 *
 * Self-initializing - no external wiring required.
 */

import { logger } from '@babylon/shared';
import {
  getJejuStorageClient,
  isJejuStorageAvailable,
} from '../storage/jeju-storage';
import { getBabylonEnclave } from '../tee/babylon-enclave';
import { isDStackAvailable } from '../tee/dstack-integration';

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export interface DecentralizationHealthStatus {
  healthy: boolean;
  timestamp: number;
  components: {
    tee: TEEHealthStatus;
    storage: StorageHealthStatus;
    kms: KMSHealthStatus;
    cache: CacheHealthStatus;
    database: DatabaseHealthStatus;
  };
  warnings: string[];
}

export interface CacheHealthStatus {
  available: boolean;
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
}

export interface DatabaseHealthStatus {
  available: boolean;
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
}

export interface TEEHealthStatus {
  available: boolean;
  platform: 'intel_tdx' | 'amd_sev' | 'simulated' | 'unavailable';
  measurement: string | null;
  operatorAddress: string | null;
  warning: string | null;
}

export interface StorageHealthStatus {
  available: boolean;
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
}

export interface KMSHealthStatus {
  available: boolean;
  provider: 'jeju' | 'local' | 'unavailable';
  configured: boolean;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

async function checkTEE(): Promise<{
  status: TEEHealthStatus;
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Check if running in real TEE (DStack CVM with TDX)
  const inRealTEE = isDStackAvailable();

  if (inRealTEE) {
    // In real TEE, get attestation
    const enclave = await getBabylonEnclave();
    const attestation = enclave.getAttestation();

    return {
      status: {
        available: true,
        platform: attestation.platform as TEEHealthStatus['platform'],
        measurement: attestation.measurement,
        operatorAddress: attestation.operatorAddress,
        warning: null,
      },
      warnings,
    };
  }

  // Simulated mode
  const enclave = await getBabylonEnclave();
  const attestation = enclave.getAttestation();

  if (process.env.NODE_ENV === 'production') {
    const requireRealTee = process.env.REQUIRE_REAL_TEE === 'true';
    if (requireRealTee) {
      // This shouldn't happen - getBabylonEnclave should throw
      warnings.push('REQUIRE_REAL_TEE is set but running simulated');
    } else {
      warnings.push(
        'TEE running in SIMULATED mode. Set REQUIRE_REAL_TEE=true to enforce.'
      );
    }
  }

  return {
    status: {
      available: true,
      platform: 'simulated',
      measurement: attestation.measurement,
      operatorAddress: attestation.operatorAddress,
      warning: 'Simulated TEE - no hardware attestation',
    },
    warnings,
  };
}

async function checkStorage(): Promise<{
  status: StorageHealthStatus;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const configured = isJejuStorageAvailable();

  if (!configured) {
    return {
      status: {
        available: false,
        configured: false,
        reachable: false,
        latencyMs: null,
      },
      warnings: ['JEJU_STORAGE_ENDPOINT not configured'],
    };
  }

  const storage = getJejuStorageClient();
  if (!storage) {
    return {
      status: {
        available: false,
        configured: true,
        reachable: false,
        latencyMs: null,
      },
      warnings: ['Storage client failed to initialize'],
    };
  }

  // Probe storage reachability with timeout
  const start = Date.now();
  const reachable = await withTimeout(
    storage
      .listFiles('health-probe')
      .then(() => true)
      .catch(() => false),
    HEALTH_CHECK_TIMEOUT_MS,
    false
  );

  if (!reachable) {
    warnings.push('Storage endpoint not reachable');
  }

  return {
    status: {
      available: reachable,
      configured: true,
      reachable,
      latencyMs: reachable ? Date.now() - start : null,
    },
    warnings,
  };
}

async function checkCache(): Promise<{
  status: CacheHealthStatus;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const cacheUrl = process.env.JEJU_CACHE_SERVICE_URL;

  if (!cacheUrl) {
    return {
      status: {
        available: false,
        configured: false,
        reachable: false,
        latencyMs: null,
      },
      warnings: ['JEJU_CACHE_SERVICE_URL not configured'],
    };
  }

  const start = Date.now();
  const reachable = await withTimeout(
    fetch(`${cacheUrl}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok)
      .catch(() => false),
    HEALTH_CHECK_TIMEOUT_MS,
    false
  );

  if (!reachable) {
    warnings.push('Jeju Cache service not reachable');
  }

  return {
    status: {
      available: reachable,
      configured: true,
      reachable,
      latencyMs: reachable ? Date.now() - start : null,
    },
    warnings,
  };
}

async function checkDatabase(): Promise<{
  status: DatabaseHealthStatus;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const cqlEndpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;

  if (!cqlEndpoint) {
    return {
      status: {
        available: false,
        configured: false,
        reachable: false,
        latencyMs: null,
      },
      warnings: ['CQL_BLOCK_PRODUCER_ENDPOINT not configured'],
    };
  }

  const start = Date.now();
  const reachable = await withTimeout(
    fetch(`${cqlEndpoint}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok)
      .catch(() => false),
    HEALTH_CHECK_TIMEOUT_MS,
    false
  );

  if (!reachable) {
    warnings.push('CQL database service not reachable');
  }

  return {
    status: {
      available: reachable,
      configured: true,
      reachable,
      latencyMs: reachable ? Date.now() - start : null,
    },
    warnings,
  };
}

async function checkKMS(): Promise<{
  status: KMSHealthStatus;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const kmsEndpoint = process.env.JEJU_KMS_ENDPOINT;

  if (!kmsEndpoint) {
    // No external KMS - using local enclave
    warnings.push('Using local enclave KMS - keys not distributed');
    return {
      status: {
        available: true,
        provider: 'local',
        configured: false,
      },
      warnings,
    };
  }

  // Probe KMS health endpoint with timeout
  const healthy = await withTimeout(
    fetch(`${kmsEndpoint}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok)
      .catch(() => false),
    HEALTH_CHECK_TIMEOUT_MS,
    false
  );

  if (!healthy) {
    warnings.push('Jeju KMS endpoint not reachable - falling back to local');
  }

  return {
    status: {
      available: healthy,
      provider: healthy ? 'jeju' : 'local',
      configured: true,
    },
    warnings,
  };
}

/**
 * Run decentralization health check.
 * Self-initializing - probes services directly without requiring pre-initialized instances.
 */
export async function checkDecentralizationHealth(): Promise<DecentralizationHealthStatus> {
  const allWarnings: string[] = [];

  const [teeResult, storageResult, kmsResult, cacheResult, databaseResult] =
    await Promise.all([
      checkTEE().catch((err) => {
        logger.error('[Health] TEE check failed', { error: err.message });
        return {
          status: {
            available: false,
            platform: 'unavailable' as const,
            measurement: null,
            operatorAddress: null,
            warning: `TEE check failed: ${err.message}`,
          },
          warnings: [`TEE check error: ${err.message}`],
        };
      }),
      checkStorage().catch((err) => {
        logger.error('[Health] Storage check failed', { error: err.message });
        return {
          status: {
            available: false,
            configured: false,
            reachable: false,
            latencyMs: null,
          },
          warnings: [`Storage check error: ${err.message}`],
        };
      }),
      checkKMS().catch((err) => {
        logger.error('[Health] KMS check failed', { error: err.message });
        return {
          status: {
            available: false,
            provider: 'unavailable' as const,
            configured: false,
          },
          warnings: [`KMS check error: ${err.message}`],
        };
      }),
      checkCache().catch((err: Error) => {
        logger.error('[Health] Cache check failed', { error: err.message });
        return {
          status: {
            available: false,
            configured: false,
            reachable: false,
            latencyMs: null,
          },
          warnings: [`Cache check error: ${err.message}`],
        };
      }),
      checkDatabase().catch((err: Error) => {
        logger.error('[Health] Database check failed', { error: err.message });
        return {
          status: {
            available: false,
            configured: false,
            reachable: false,
            latencyMs: null,
          },
          warnings: [`Database check error: ${err.message}`],
        };
      }),
    ]);

  allWarnings.push(
    ...teeResult.warnings,
    ...storageResult.warnings,
    ...kmsResult.warnings,
    ...cacheResult.warnings,
    ...databaseResult.warnings
  );

  // Health criteria:
  // - TEE must be available (even simulated is OK for dev)
  // - Database must be available (CQL is required)
  // - Cache must be available (Jeju Cache is required)
  // - Storage is optional (can work without it)
  // - KMS must be available (local is OK)
  const healthy =
    teeResult.status.available &&
    kmsResult.status.available &&
    cacheResult.status.available &&
    databaseResult.status.available;

  return {
    healthy,
    timestamp: Date.now(),
    components: {
      tee: teeResult.status,
      storage: storageResult.status,
      kms: kmsResult.status,
      cache: cacheResult.status,
      database: databaseResult.status,
    },
    warnings: allWarnings,
  };
}

// Legacy exports for backward compatibility
export class DecentralizationHealthChecker {
  async check(): Promise<DecentralizationHealthStatus> {
    return checkDecentralizationHealth();
  }
}

let healthChecker: DecentralizationHealthChecker | null = null;

export function initializeHealthChecker(): DecentralizationHealthChecker {
  if (!healthChecker) {
    healthChecker = new DecentralizationHealthChecker();
  }
  return healthChecker;
}

export function getHealthChecker(): DecentralizationHealthChecker {
  return initializeHealthChecker();
}
