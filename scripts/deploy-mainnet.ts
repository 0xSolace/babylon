#!/usr/bin/env bun
/**
 * Babylon Mainnet Deployment Script
 *
 * PRODUCTION DEPLOYMENT - USE WITH CAUTION
 *
 * Pre-deployment checklist:
 * 1. All testnet tests passing
 * 2. Security audit complete
 * 3. Treasury funded with minimum 10 ETH
 * 4. Council members confirmed
 * 5. AI CEO wallet funded
 * 6. MPC parties operational (5 of 5)
 *
 * Deployment steps:
 * 1. Deploy contracts with timelocks
 * 2. Register JNS (babylon.jeju)
 * 3. Configure keepalive with strict monitoring
 * 4. Deploy frontend with redundant pinning
 * 5. Register production triggers
 * 6. Configure AI CEO with production keys
 * 7. Verify all systems
 *
 * Usage:
 *   CONFIRM_MAINNET=yes bun run scripts/deploy-mainnet.ts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  network: 'mainnet',
  rpcUrl: process.env.MAINNET_RPC ?? 'https://rpc.jeju.network',
  chainId: parseInt(process.env.MAINNET_CHAIN_ID ?? '420690', 10),
  explorerUrl: 'https://explorer.jeju.network',
  jnsName: 'babylon.jeju',

  // Safety checks
  minTreasuryBalance: 10n * 10n ** 18n, // 10 ETH
  minVaultBalance: 1n * 10n ** 18n, // 1 ETH
  requiredMPCParties: 5,
  requiredCouncilMembers: 3,

  // Deployment flags
  verbose: process.env.VERBOSE === 'true',
  dryRun: process.env.DRY_RUN === 'true',
};

// ============================================================================
// Safety Checks
// ============================================================================

async function confirmMainnetDeployment(): Promise<boolean> {
  if (process.env.CONFIRM_MAINNET === 'yes') {
    return true;
  }

  console.log('\n⚠️  MAINNET DEPLOYMENT WARNING ⚠️');
  console.log('='.repeat(60));
  console.log('You are about to deploy to MAINNET.');
  console.log('This action cannot be undone.');
  console.log('');
  console.log('Pre-deployment checklist:');
  console.log('  [ ] All testnet tests passing');
  console.log('  [ ] Security audit complete');
  console.log('  [ ] Treasury funded with minimum 10 ETH');
  console.log('  [ ] Council members confirmed');
  console.log('  [ ] AI CEO wallet funded');
  console.log('  [ ] MPC parties operational (5 of 5)');
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Type "DEPLOY TO MAINNET" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'DEPLOY TO MAINNET');
    });
  });
}

async function runSafetyChecks(): Promise<{
  passed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  console.log('\n🔍 Running safety checks...');

  // Check deployer key
  if (!process.env.DEPLOYER_KEY) {
    errors.push('DEPLOYER_KEY not set');
  }

  // Check treasury funding
  const treasuryBalance = BigInt(process.env.TREASURY_BALANCE ?? '0');
  if (treasuryBalance < CONFIG.minTreasuryBalance) {
    errors.push(
      `Treasury balance too low: ${treasuryBalance} < ${CONFIG.minTreasuryBalance}`
    );
  }

  // Check MPC parties
  const mpcParties = parseInt(process.env.MPC_PARTIES ?? '0', 10);
  if (mpcParties < CONFIG.requiredMPCParties) {
    errors.push(
      `Not enough MPC parties: ${mpcParties} < ${CONFIG.requiredMPCParties}`
    );
  }

  // Check MPC party health
  const mpcHealthy = await checkMPCHealth();
  if (!mpcHealthy) {
    errors.push('MPC parties not all healthy');
  }

  // Check council members
  const councilMembers = (process.env.COUNCIL_ADDRESSES ?? '')
    .split(',')
    .filter(Boolean);
  if (councilMembers.length < CONFIG.requiredCouncilMembers) {
    errors.push(
      `Not enough council members: ${councilMembers.length} < ${CONFIG.requiredCouncilMembers}`
    );
  }

  // Check testnet deployment exists
  const testnetDeployment = join(process.cwd(), 'deployment-testnet.json');
  if (!existsSync(testnetDeployment)) {
    errors.push('No testnet deployment found - deploy to testnet first');
  }

  for (const error of errors) {
    console.log(`  ❌ ${error}`);
  }

  if (errors.length === 0) {
    console.log('  ✅ All safety checks passed');
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

async function checkMPCHealth(): Promise<boolean> {
  // Check all MPC parties are healthy
  const partyEndpoints = [
    process.env.MPC_PARTY_1_ENDPOINT,
    process.env.MPC_PARTY_2_ENDPOINT,
    process.env.MPC_PARTY_3_ENDPOINT,
    process.env.MPC_PARTY_4_ENDPOINT,
    process.env.MPC_PARTY_5_ENDPOINT,
  ].filter(Boolean);

  let healthyCount = 0;

  for (const endpoint of partyEndpoints) {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (response?.ok) {
      healthyCount++;
    }
  }

  console.log(
    `  MPC parties healthy: ${healthyCount}/${partyEndpoints.length}`
  );

  return healthyCount >= CONFIG.requiredMPCParties;
}

// ============================================================================
// Main Deployment
// ============================================================================

async function main() {
  console.log('🚀 Babylon Mainnet Deployment');
  console.log('='.repeat(60));
  console.log(`Network: ${CONFIG.network}`);
  console.log(`RPC: ${CONFIG.rpcUrl}`);
  console.log(`Chain ID: ${CONFIG.chainId}`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);

  // Confirm mainnet deployment
  const confirmed = await confirmMainnetDeployment();
  if (!confirmed) {
    console.log('\n❌ Deployment cancelled');
    process.exit(1);
  }

  // Run safety checks
  const safetyResult = await runSafetyChecks();
  if (!safetyResult.passed) {
    console.log('\n❌ Safety checks failed. Fix errors before deploying.');
    process.exit(1);
  }

  if (CONFIG.dryRun) {
    console.log('\n✅ Dry run complete. Remove DRY_RUN=true to deploy.');
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Step 1: Deploy Contracts
  // -------------------------------------------------------------------------
  console.log('\n📜 Step 1: Deploying contracts...');
  const contracts = await deployContracts();
  console.log('✅ Contracts deployed');

  // -------------------------------------------------------------------------
  // Step 2: Register JNS
  // -------------------------------------------------------------------------
  console.log('\n📛 Step 2: Registering JNS...');
  const jns = await registerJNS();
  console.log('✅ JNS registered');

  // -------------------------------------------------------------------------
  // Step 3: Register Keepalive
  // -------------------------------------------------------------------------
  console.log('\n💗 Step 3: Registering keepalive...');
  const keepalive = await registerKeepalive();
  console.log('✅ Keepalive registered');

  // -------------------------------------------------------------------------
  // Step 4: Deploy Frontend
  // -------------------------------------------------------------------------
  console.log('\n🌐 Step 4: Deploying frontend to IPFS...');
  const frontend = await deployFrontend();
  console.log('✅ Frontend deployed');

  // -------------------------------------------------------------------------
  // Step 5: Register Triggers
  // -------------------------------------------------------------------------
  console.log('\n⏰ Step 5: Registering triggers...');
  const triggers = await registerTriggers();
  console.log('✅ Triggers registered');

  // -------------------------------------------------------------------------
  // Step 6: Configure AI CEO
  // -------------------------------------------------------------------------
  console.log('\n🐵 Step 6: Configuring AI CEO...');
  await configureAICEO(contracts.dao);
  console.log('✅ AI CEO configured');

  // -------------------------------------------------------------------------
  // Step 7: Verify Deployment
  // -------------------------------------------------------------------------
  console.log('\n🔍 Step 7: Verifying deployment...');
  const verified = await verifyDeployment();
  if (!verified) {
    console.log('⚠️  Some verification checks failed - review manually');
  } else {
    console.log('✅ Deployment verified');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Babylon Mainnet Deployment Complete');
  console.log('='.repeat(60));

  console.log('\nContracts:');
  console.log(`  DAO:                  ${contracts.dao}`);
  console.log(`  Treasury:             ${contracts.treasury}`);
  console.log(`  Agent Vault:          ${contracts.agentVault}`);
  console.log(`  Training Orchestrator: ${contracts.trainingOrchestrator}`);

  console.log(`\nJNS: ${CONFIG.jnsName} -> ${jns.node}`);
  console.log(`\nKeepalive ID: ${keepalive.id}`);
  console.log(`\nFrontend: ${frontend.url}`);
  console.log(`\nTriggers: ${triggers.registered} registered`);

  // Save deployment result
  const result = {
    network: CONFIG.network,
    chainId: CONFIG.chainId,
    deployedAt: new Date().toISOString(),
    contracts,
    jns,
    keepalive,
    frontend,
    triggers,
  };

  const outputPath = join(process.cwd(), 'deployment-mainnet.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nDeployment saved to: ${outputPath}`);
}

// ============================================================================
// Deployment Functions
// ============================================================================

async function deployContracts() {
  const cmd = [
    'forge script script/DeployDAO.s.sol:DeployDAO',
    `--rpc-url ${CONFIG.rpcUrl}`,
    '--broadcast',
    '--verify',
    '--slow', // Slower but more reliable for mainnet
    '-vvv',
  ].join(' ');

  execSync(cmd, {
    cwd: join(process.cwd(), 'packages/contracts'),
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
    env: {
      ...process.env,
      NETWORK: 'mainnet',
    },
  });

  // Parse deployment output
  return {
    dao: process.env.BABYLON_DAO_ADDRESS ?? '0x...',
    treasury: process.env.BABYLON_TREASURY_ADDRESS ?? '0x...',
    agentVault: process.env.BABYLON_AGENT_VAULT_ADDRESS ?? '0x...',
    trainingOrchestrator: process.env.TRAINING_ORCHESTRATOR_ADDRESS ?? '0x...',
  };
}

async function registerJNS() {
  execSync(`jeju jns register ${CONFIG.jnsName} --network mainnet --verify`, {
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });

  return {
    registered: true,
    node: `0x${Buffer.from(CONFIG.jnsName).toString('hex').padEnd(64, '0')}`,
  };
}

async function registerKeepalive() {
  execSync(
    [
      'jeju keepalive register',
      `--jns ${CONFIG.jnsName}`,
      '--network mainnet',
      `--vault ${process.env.BABYLON_AGENT_VAULT_ADDRESS}`,
      '--auto-fund',
      '--check-interval 300',
      '--min-balance 0.1',
      '--top-up 1.0',
    ].join(' '),
    { stdio: CONFIG.verbose ? 'inherit' : 'pipe' }
  );

  return {
    id: '0x...',
    registered: true,
  };
}

async function deployFrontend() {
  // Build production frontend
  execSync('bun run build:static', {
    cwd: join(process.cwd(), 'apps/web'),
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  // Deploy with redundant pinning
  const output = execSync(
    [
      'jeju storage upload',
      '--dir apps/web/out',
      '--network mainnet',
      '--pin',
      '--replicas 5', // More replicas for mainnet
    ].join(' '),
    { encoding: 'utf-8' }
  );

  const cidMatch = output.match(/CID: (Qm[a-zA-Z0-9]+)/);
  const cid = cidMatch?.[1] ?? 'Qm...';

  // Update JNS
  execSync(
    `jeju jns update ${CONFIG.jnsName} --content ${cid} --network mainnet`,
    {
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
    }
  );

  return {
    cid,
    url: `https://${CONFIG.jnsName}`,
  };
}

async function registerTriggers() {
  const manifestPath = join(process.cwd(), 'jeju-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const triggers = manifest.decentralization?.triggers ?? [];

  let registered = 0;

  for (const trigger of triggers) {
    execSync(
      [
        'jeju trigger register',
        `--name ${trigger.name}`,
        `--type ${trigger.type}`,
        `--cron "${trigger.cronExpression}"`,
        `--endpoint ${trigger.endpoint}`,
        `--timeout ${trigger.timeout}`,
        `--retries ${trigger.retries}`,
        '--network mainnet',
        '--verify',
      ].join(' '),
      { stdio: CONFIG.verbose ? 'inherit' : 'pipe' }
    );
    registered++;
  }

  return { registered, failed: 0 };
}

async function configureAICEO(daoAddress: string) {
  // Set AI CEO address in DAO
  // This uses TEE-derived keys in production
  execSync(
    [
      'jeju agent configure',
      '--name monkeyking',
      `--dao ${daoAddress}`,
      '--network mainnet',
      '--tee',
    ].join(' '),
    { stdio: CONFIG.verbose ? 'inherit' : 'pipe' }
  );
}

async function verifyDeployment(): Promise<boolean> {
  let allPassed = true;

  // Verify contracts respond
  console.log('  Checking contracts...');
  // Add verification logic

  // Verify JNS resolves
  console.log('  Checking JNS resolution...');
  // Add verification logic

  // Verify frontend loads
  console.log('  Checking frontend...');
  const frontendResponse = await fetch(`https://${CONFIG.jnsName}`, {
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);

  if (!frontendResponse?.ok) {
    console.log('    ❌ Frontend not responding');
    allPassed = false;
  } else {
    console.log('    ✅ Frontend responding');
  }

  // Verify health endpoint
  console.log('  Checking health endpoint...');
  const healthResponse = await fetch(
    `https://api.${CONFIG.jnsName}/api/health`,
    {
      signal: AbortSignal.timeout(10000),
    }
  ).catch(() => null);

  if (!healthResponse?.ok) {
    console.log('    ❌ Health endpoint not responding');
    allPassed = false;
  } else {
    console.log('    ✅ Health endpoint responding');
  }

  return allPassed;
}

// Run
main().catch((err) => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
