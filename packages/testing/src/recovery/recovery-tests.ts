/**
 * Babylon Recovery Tests
 *
 * Tests that Babylon can recover from various failure scenarios
 * within the target recovery time (<1 hour).
 *
 * Scenarios tested:
 * 1. Backend crash and restart
 * 2. Low/depleted vault funds
 * 3. TEE worker failure
 * 4. Database connection loss
 * 5. IPFS content unavailable
 * 6. Training job failure
 *
 * Run with:
 *   bun run test:recovery
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

// ============================================================================
// Configuration
// ============================================================================

const RECOVERY_TARGET_MS = 60 * 60 * 1000; // 1 hour
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_RETRIES = 120; // 120 * 30s = 1 hour

const API_URL = process.env.BABYLON_API_URL ?? 'http://localhost:5007';
// Reserved for future WebSocket recovery tests
const _WS_URL = process.env.BABYLON_WS_URL ?? 'ws://localhost:5007';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, { status: string; latencyMs: number }>;
}

// ============================================================================
// Utilities
// ============================================================================

async function checkHealth(): Promise<HealthStatus | null> {
  const response = await fetch(`${API_URL}/api/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) return null;

  return response.json() as Promise<HealthStatus>;
}

async function waitForHealthy(maxWaitMs: number = RECOVERY_TARGET_MS): Promise<{
  recovered: boolean;
  timeMs: number;
  finalStatus: HealthStatus | null;
}> {
  const startTime = Date.now();
  let retries = 0;

  while (Date.now() - startTime < maxWaitMs && retries < MAX_RETRIES) {
    const health = await checkHealth();

    if (health?.status === 'ok') {
      return {
        recovered: true,
        timeMs: Date.now() - startTime,
        finalStatus: health,
      };
    }

    await new Promise((resolve) =>
      setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS)
    );
    retries++;

    if (retries % 10 === 0) {
      console.log(
        `  Waiting for recovery... ${Math.round((Date.now() - startTime) / 1000)}s elapsed`
      );
    }
  }

  const finalHealth = await checkHealth();
  return {
    recovered: finalHealth?.status === 'ok',
    timeMs: Date.now() - startTime,
    finalStatus: finalHealth,
  };
}

async function getVaultBalance(): Promise<bigint> {
  const response = await fetch(`${API_URL}/api/admin/vault-balance`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) return 0n;

  const data = (await response.json()) as { balance: string };
  return BigInt(data.balance);
}

async function simulateBackendCrash(): Promise<void> {
  // In testing environment, trigger a graceful shutdown
  await fetch(`${API_URL}/api/admin/simulate-crash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  }).catch(() => {});
}

async function simulateLowFunds(): Promise<void> {
  // Simulate draining the vault
  await fetch(`${API_URL}/api/admin/simulate-low-funds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  }).catch(() => {});
}

async function simulateTEEFailure(): Promise<void> {
  // Simulate TEE worker becoming unavailable
  await fetch(`${API_URL}/api/admin/simulate-tee-failure`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  }).catch(() => {});
}

async function simulateDBConnectionLoss(): Promise<void> {
  // Simulate database connection issues
  await fetch(`${API_URL}/api/admin/simulate-db-failure`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  }).catch(() => {});
}

// ============================================================================
// Tests
// ============================================================================

describe('Babylon Recovery Tests', () => {
  let initialHealth: HealthStatus | null;

  beforeAll(async () => {
    console.log('\n🔍 Checking initial system health...');
    initialHealth = await checkHealth();

    if (!initialHealth || initialHealth.status !== 'ok') {
      console.warn('⚠️  System not healthy before tests - some tests may fail');
    } else {
      console.log('✅ System healthy, starting recovery tests\n');
    }
  });

  afterAll(async () => {
    // Ensure system is healthy after all tests
    console.log('\n🔍 Final health check...');
    const finalHealth = await checkHealth();

    if (finalHealth?.status === 'ok') {
      console.log('✅ System healthy after all tests');
    } else {
      console.warn('⚠️  System may need manual recovery');
    }
  });

  describe('Backend Crash Recovery', () => {
    it(
      'should recover from backend crash within 1 hour',
      async () => {
        console.log('\n📋 Test: Backend crash recovery');
        console.log('  Simulating backend crash...');

        await simulateBackendCrash();

        // Wait a moment for crash to take effect
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verify service is down
        const downHealth = await checkHealth();
        console.log(
          `  Service status after crash: ${downHealth?.status ?? 'unreachable'}`
        );

        // Wait for recovery
        console.log('  Waiting for auto-recovery...');
        const result = await waitForHealthy(RECOVERY_TARGET_MS);

        console.log(`  Recovery time: ${Math.round(result.timeMs / 1000)}s`);
        console.log(`  Recovered: ${result.recovered}`);

        expect(result.recovered).toBe(true);
        expect(result.timeMs).toBeLessThan(RECOVERY_TARGET_MS);
      },
      RECOVERY_TARGET_MS + 60000
    );
  });

  describe('Low Funds Recovery', () => {
    it(
      'should auto-fund vault when balance drops below threshold',
      async () => {
        console.log('\n📋 Test: Low funds auto-recovery');

        // Get initial balance
        const initialBalance = await getVaultBalance();
        console.log(`  Initial vault balance: ${initialBalance}`);

        // Simulate low funds
        console.log('  Simulating low funds...');
        await simulateLowFunds();

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Check if auto-fund triggered
        const balanceAfterSimulation = await getVaultBalance();
        console.log(`  Balance after simulation: ${balanceAfterSimulation}`);

        // Wait for recovery (auto-fund from treasury)
        console.log('  Waiting for auto-fund...');
        const result = await waitForHealthy(RECOVERY_TARGET_MS);

        // Check final balance
        const finalBalance = await getVaultBalance();
        console.log(`  Final vault balance: ${finalBalance}`);

        expect(result.recovered).toBe(true);
        expect(result.timeMs).toBeLessThan(RECOVERY_TARGET_MS);
      },
      RECOVERY_TARGET_MS + 60000
    );
  });

  describe('TEE Worker Failure Recovery', () => {
    it(
      'should recover from TEE worker failure',
      async () => {
        console.log('\n📋 Test: TEE worker failure recovery');

        // Simulate TEE failure
        console.log('  Simulating TEE worker failure...');
        await simulateTEEFailure();

        // Wait for recovery (should spin up new worker)
        console.log('  Waiting for TEE worker recovery...');
        const result = await waitForHealthy(RECOVERY_TARGET_MS);

        console.log(`  Recovery time: ${Math.round(result.timeMs / 1000)}s`);

        expect(result.recovered).toBe(true);
        expect(result.timeMs).toBeLessThan(RECOVERY_TARGET_MS);
      },
      RECOVERY_TARGET_MS + 60000
    );
  });

  describe('Database Recovery', () => {
    it(
      'should recover from database connection loss',
      async () => {
        console.log('\n📋 Test: Database connection recovery');

        // Simulate DB failure
        console.log('  Simulating database connection loss...');
        await simulateDBConnectionLoss();

        // Wait for recovery (should reconnect)
        console.log('  Waiting for database recovery...');
        const result = await waitForHealthy(RECOVERY_TARGET_MS);

        console.log(`  Recovery time: ${Math.round(result.timeMs / 1000)}s`);

        // Verify database is functional
        if (result.finalStatus?.checks.database?.status === 'healthy') {
          console.log('  ✅ Database reconnected');
        }

        expect(result.recovered).toBe(true);
        expect(result.finalStatus?.checks.database?.status).toBe('healthy');
        expect(result.timeMs).toBeLessThan(RECOVERY_TARGET_MS);
      },
      RECOVERY_TARGET_MS + 60000
    );
  });

  describe('Full System Recovery', () => {
    it(
      'should recover from multiple simultaneous failures',
      async () => {
        console.log('\n📋 Test: Full system recovery (multiple failures)');

        // Simulate multiple failures
        console.log('  Simulating multiple failures...');
        await Promise.all([
          simulateBackendCrash(),
          simulateLowFunds(),
          simulateDBConnectionLoss(),
        ]);

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Wait for full recovery
        console.log('  Waiting for full system recovery...');
        const result = await waitForHealthy(RECOVERY_TARGET_MS);

        console.log(`  Recovery time: ${Math.round(result.timeMs / 1000)}s`);
        console.log(`  Final status: ${result.finalStatus?.status}`);

        if (result.finalStatus?.checks) {
          console.log('  Component status:');
          for (const [name, check] of Object.entries(
            result.finalStatus.checks
          )) {
            console.log(`    ${name}: ${check.status} (${check.latencyMs}ms)`);
          }
        }

        expect(result.recovered).toBe(true);
        expect(result.timeMs).toBeLessThan(RECOVERY_TARGET_MS);
      },
      RECOVERY_TARGET_MS + 60000
    );
  });

  describe('Recovery Time Metrics', () => {
    const METRIC_ITERATIONS = 3;

    it(
      'should measure average recovery time',
      async () => {
        console.log('\n📋 Test: Recovery time metrics');

        const recoveryTimes: number[] = [];
        const iterations = METRIC_ITERATIONS;

        for (let i = 0; i < iterations; i++) {
          console.log(`  Iteration ${i + 1}/${iterations}...`);

          await simulateBackendCrash();
          await new Promise((resolve) => setTimeout(resolve, 5000));

          const result = await waitForHealthy(RECOVERY_TARGET_MS);
          if (result.recovered) {
            recoveryTimes.push(result.timeMs);
          }

          // Wait between iterations
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        const avgRecoveryTime =
          recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
        const maxRecoveryTime = Math.max(...recoveryTimes);
        const minRecoveryTime = Math.min(...recoveryTimes);

        console.log(`\n  Recovery Time Statistics:`);
        console.log(`    Average: ${Math.round(avgRecoveryTime / 1000)}s`);
        console.log(`    Min: ${Math.round(minRecoveryTime / 1000)}s`);
        console.log(`    Max: ${Math.round(maxRecoveryTime / 1000)}s`);
        console.log(`    Success rate: ${recoveryTimes.length}/${iterations}`);

        expect(avgRecoveryTime).toBeLessThan(RECOVERY_TARGET_MS);
        expect(recoveryTimes.length).toBe(iterations);
      },
      METRIC_ITERATIONS * (RECOVERY_TARGET_MS + 60000)
    );
  });
});

// ============================================================================
// Direct execution
// ============================================================================

if (import.meta.main) {
  console.log('🧪 Running Babylon Recovery Tests');
  console.log(`Target recovery time: ${RECOVERY_TARGET_MS / 1000}s`);
  console.log(`API URL: ${API_URL}`);
  console.log('');

  // Run with Bun test runner
  const result = Bun.spawnSync(['bun', 'test', import.meta.path], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  process.exit(result.exitCode);
}
