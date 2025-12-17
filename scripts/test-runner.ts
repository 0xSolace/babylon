#!/usr/bin/env bun
/**
 * Test Runner with Infrastructure Setup
 *
 * Orchestrates the complete test pipeline using Jeju CLI services:
 * 1. Checks Jeju infrastructure health
 * 2. Deploys contracts if needed
 * 3. Runs requested test suites
 * 4. Optionally validates testnet deployment
 *
 * Prerequisites:
 * - Jeju CLI running: cd /path/to/jeju && bun run dev
 *
 * Usage:
 *   bun run scripts/test-runner.ts                    # Run all tests (unit + integration)
 *   bun run scripts/test-runner.ts --unit             # Unit tests only
 *   bun run scripts/test-runner.ts --integration      # Integration tests only
 *   bun run scripts/test-runner.ts --e2e              # E2E tests only
 *   bun run scripts/test-runner.ts --decentralized    # Decentralized messaging tests
 *   bun run scripts/test-runner.ts --testnet          # Include testnet validation
 *   bun run scripts/test-runner.ts --skip-setup       # Skip infrastructure setup
 */

import { $ } from 'bun';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  checkCoreServices,
  checkJejuServices,
  type NetworkMode,
  printStatus,
  setupTestInfrastructure,
  type TestMode,
} from '../packages/testing/infrastructure/setup';
import {
  printValidationReport,
  runValidationSuite,
} from '../packages/testing/validation/integration-checklist';

interface TestRunnerOptions {
  unit: boolean;
  integration: boolean;
  e2e: boolean;
  decentralized: boolean;
  testnet: boolean;
  skipSetup: boolean;
  validate: boolean;
  verbose: boolean;
}

function parseArgs(): TestRunnerOptions {
  const args = process.argv.slice(2);

  // If no test type specified, run unit + integration (not e2e by default)
  const hasTestType = args.some((a) =>
    ['--unit', '--integration', '--e2e', '--decentralized'].includes(a)
  );

  return {
    unit: args.includes('--unit') || (!hasTestType && !args.includes('--e2e')),
    integration:
      args.includes('--integration') ||
      (!hasTestType && !args.includes('--e2e')),
    e2e: args.includes('--e2e'),
    decentralized: args.includes('--decentralized'),
    testnet: args.includes('--testnet'),
    skipSetup: args.includes('--skip-setup'),
    validate: args.includes('--validate'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const options = parseArgs();

  console.log('\n' + '═'.repeat(70));
  console.log('BABYLON TEST RUNNER (Powered by Jeju)');
  console.log('═'.repeat(70));
  console.log(
    `Mode: ${[
      options.unit && 'unit',
      options.integration && 'integration',
      options.e2e && 'e2e',
      options.decentralized && 'decentralized',
    ]
      .filter(Boolean)
      .join(' + ')}`
  );
  console.log(`Network: ${options.testnet ? 'testnet' : 'localnet'}`);
  console.log('═'.repeat(70) + '\n');

  // Load environment
  loadEnv();

  // Determine test mode for infrastructure
  const testMode: TestMode = options.decentralized
    ? 'decentralized'
    : options.e2e
      ? 'e2e'
      : options.integration
        ? 'integration'
        : 'unit';
  const network: NetworkMode = options.testnet ? 'testnet' : 'localnet';

  // 1. Setup infrastructure (unless skipped)
  if (!options.skipSetup && testMode !== 'unit') {
    console.log('[Runner] Setting up Jeju test infrastructure...\n');

    const setupResult = await setupTestInfrastructure({
      testMode,
      network,
      deployContracts: options.decentralized,
    });

    if (!setupResult.healthy) {
      console.error('\n❌ Infrastructure setup failed');
      console.error('Start Jeju services: cd /path/to/jeju && bun run dev');
      process.exit(1);
    }

    console.log('[Runner] ✅ Jeju infrastructure ready\n');
  } else if (testMode === 'unit') {
    console.log('[Runner] Unit tests - skipping infrastructure setup\n');
  } else {
    // Just check services without starting
    console.log('[Runner] Skipping setup, checking Jeju services...\n');
    const coreStatus = await checkCoreServices();

    if (!coreStatus.healthy) {
      printStatus(coreStatus);
      console.error('\n❌ Core services not healthy.');
      console.error('Start Jeju services: cd /path/to/jeju && bun run dev');
      process.exit(1);
    }

    if (options.decentralized) {
      const jejuStatus = await checkJejuServices();
      if (!jejuStatus.healthy) {
        printStatus(jejuStatus);
        console.error('\n❌ Jeju services not healthy.');
        console.error('Start Jeju services: cd /path/to/jeju && bun run dev');
        process.exit(1);
      }
    }
  }

  // 2. Run validation if requested or running testnet tests
  if (options.validate || options.testnet) {
    console.log('\n[Runner] Running validation suite...\n');
    const validationReport = await runValidationSuite({
      includeTestnet: options.testnet,
    });
    printValidationReport(validationReport);

    if (validationReport.failed > 0) {
      console.error(
        `\n❌ Validation failed with ${validationReport.failed} errors`
      );
      process.exit(1);
    }
  }

  // 3. Run test suites
  const testResults: { suite: string; passed: boolean; duration: number }[] =
    [];

  // Unit tests
  if (options.unit) {
    console.log('\n' + '─'.repeat(70));
    console.log('RUNNING UNIT TESTS');
    console.log('─'.repeat(70) + '\n');

    const unitStart = Date.now();
    const unitResult =
      await $`bun test packages/testing/unit/ --preload ./packages/testing/unit/preload.ts`.nothrow();
    testResults.push({
      suite: 'unit',
      passed: unitResult.exitCode === 0,
      duration: Date.now() - unitStart,
    });

    if (unitResult.exitCode !== 0) {
      console.error('\n❌ Unit tests failed');
    }
  }

  // Integration tests
  if (options.integration) {
    console.log('\n' + '─'.repeat(70));
    console.log('RUNNING INTEGRATION TESTS');
    console.log('─'.repeat(70) + '\n');

    const integrationStart = Date.now();
    const integrationResult =
      await $`bun test packages/testing/integration/ --preload ./packages/testing/integration/preload.ts`.nothrow();
    testResults.push({
      suite: 'integration',
      passed: integrationResult.exitCode === 0,
      duration: Date.now() - integrationStart,
    });

    if (integrationResult.exitCode !== 0) {
      console.error('\n❌ Integration tests failed');
    }
  }

  // Decentralized messaging tests
  if (options.decentralized) {
    console.log('\n' + '─'.repeat(70));
    console.log('RUNNING DECENTRALIZED MESSAGING TESTS');
    console.log('─'.repeat(70) + '\n');

    const decentralizedStart = Date.now();
    const decentralizedResult =
      await $`bun test packages/testing/integration/decentralized-*.test.ts --preload ./packages/testing/integration/preload.ts`.nothrow();
    testResults.push({
      suite: 'decentralized',
      passed: decentralizedResult.exitCode === 0,
      duration: Date.now() - decentralizedStart,
    });

    if (decentralizedResult.exitCode !== 0) {
      console.error('\n❌ Decentralized tests failed');
    }
  }

  // E2E tests
  if (options.e2e) {
    console.log('\n' + '─'.repeat(70));
    console.log('RUNNING E2E TESTS');
    console.log('─'.repeat(70) + '\n');

    const e2eStart = Date.now();
    const e2eResult =
      await $`cd packages/testing && playwright test e2e`.nothrow();
    testResults.push({
      suite: 'e2e',
      passed: e2eResult.exitCode === 0,
      duration: Date.now() - e2eStart,
    });

    if (e2eResult.exitCode !== 0) {
      console.error('\n❌ E2E tests failed');
    }
  }

  // Testnet-specific tests
  if (options.testnet) {
    console.log('\n' + '─'.repeat(70));
    console.log('RUNNING TESTNET TESTS');
    console.log('─'.repeat(70) + '\n');

    const testnetStart = Date.now();
    const testnetResult =
      await $`bun test packages/testing/deployment/testnet.test.ts`.nothrow();
    testResults.push({
      suite: 'testnet',
      passed: testnetResult.exitCode === 0,
      duration: Date.now() - testnetStart,
    });

    if (testnetResult.exitCode !== 0) {
      console.error('\n❌ Testnet tests failed');
    }
  }

  // 4. Print summary
  const totalDuration = Date.now() - startTime;
  const allPassed = testResults.every((r) => r.passed);

  console.log('\n' + '═'.repeat(70));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(70));

  for (const result of testResults) {
    const icon = result.passed ? '✅' : '❌';
    const durationSec = (result.duration / 1000).toFixed(1);
    console.log(
      `${icon} ${result.suite.padEnd(15)} ${result.passed ? 'PASSED' : 'FAILED'} (${durationSec}s)`
    );
  }

  console.log('─'.repeat(70));
  console.log(`Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('═'.repeat(70) + '\n');

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Test runner error:', error);
  process.exit(1);
});
