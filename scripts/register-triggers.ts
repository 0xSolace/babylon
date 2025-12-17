/**
 * Register Babylon Triggers in Jeju Compute Marketplace
 *
 * This script registers Babylon-specific triggers for:
 * - Game tick execution (every 10 seconds)
 * - Training data extraction (hourly)
 * - GPU training jobs (webhook)
 * - Model deployment (event-driven)
 *
 * Run with: bun vendor/babylon/scripts/register-triggers.ts
 */

// Import from Jeju DWS SDK
// Note: This uses a relative import path since we're in vendor/
import {
  initializeTriggerIntegration,
  registerVendorTriggers,
} from '../../../apps/dws/src/compute/sdk/trigger-integration';

async function main(): Promise<void> {
  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║       REGISTERING BABYLON TRIGGERS                           ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n'
  );

  const baseUrl =
    process.env.BABYLON_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  // Initialize the trigger integration
  await initializeTriggerIntegration();

  // Register Babylon-specific triggers
  await registerVendorTriggers('babylon', [
    // Game tick trigger - executes game logic every 10 seconds
    {
      type: 'cron',
      name: 'game-tick',
      description: 'Execute Babylon game tick every 10 seconds',
      cronExpression: '*/10 * * * * *',
      endpoint: `${baseUrl}/api/cron/game-tick`,
      method: 'POST',
      timeout: 30,
      resources: { cpuCores: 1, memoryMb: 512 },
      payment: { mode: 'free' },
      active: true,
    },
    // Training data extraction - extracts trajectories hourly
    {
      type: 'cron',
      name: 'training-extract',
      description: 'Extract Babylon trajectories for training hourly',
      cronExpression: '0 * * * *',
      endpoint: `${baseUrl}/api/training/extract`,
      method: 'POST',
      timeout: 300,
      resources: { cpuCores: 2, memoryMb: 4096 },
      payment: { mode: 'free' },
      active: true,
    },
    // GPU training trigger - triggered via webhook when training is needed
    {
      type: 'webhook',
      name: 'gpu-training',
      description: 'Trigger Babylon GPU training job',
      webhookPath: '/api/triggers/babylon/train',
      endpoint: `${baseUrl}/api/training/gpu`,
      method: 'POST',
      timeout: 3600,
      resources: {
        cpuCores: 8,
        memoryMb: 32768,
        requiresGpu: true,
        gpuType: 'H200',
        maxExecutionTime: 3600,
      },
      payment: {
        mode: 'x402',
        pricePerExecution: 10n ** 16n, // 0.01 ETH
      },
      active: true,
    },
    // Model deployment - triggered when training completes
    {
      type: 'event',
      name: 'model-deploy',
      description: 'Deploy Babylon model when training completes',
      eventTypes: ['babylon:training:complete', 'babylon:benchmark:passed'],
      endpoint: `${baseUrl}/api/training/deploy`,
      method: 'POST',
      timeout: 120,
      payment: { mode: 'free' },
      active: true,
    },
    // Heartbeat for unruggable game
    {
      type: 'cron',
      name: 'heartbeat',
      description: 'Send on-chain heartbeat to prove game liveness',
      cronExpression: '*/5 * * * *', // Every 5 minutes
      endpoint: `${baseUrl}/api/cron/heartbeat`,
      method: 'POST',
      timeout: 30,
      resources: { cpuCores: 1, memoryMb: 256 },
      payment: { mode: 'free' },
      active: true,
    },
  ]);

  console.log('\n✅ Babylon triggers registered successfully!');
  console.log('\nRegistered triggers:');
  console.log('  • babylon-game-tick (cron: every 10s)');
  console.log('  • babylon-training-extract (cron: hourly)');
  console.log('  • babylon-gpu-training (webhook)');
  console.log('  • babylon-model-deploy (event-driven)');
  console.log('  • babylon-heartbeat (cron: every 5min)');
}

main().catch(console.error);
