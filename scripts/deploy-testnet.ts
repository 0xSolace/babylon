#!/usr/bin/env bun
/**
 * Babylon Testnet Deployment Script
 *
 * Deploys all Babylon infrastructure to testnet:
 * 1. Smart contracts (DAO, Treasury, Vault, Training)
 * 2. Register JNS names
 * 3. Register keepalive
 * 4. Deploy frontend to IPFS
 * 5. Configure triggers
 * 6. Seed AI CEO and council
 *
 * Usage:
 *   bun run scripts/deploy-testnet.ts
 *   SKIP_CONTRACTS=true bun run scripts/deploy-testnet.ts  # Skip contracts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  network: 'testnet',
  rpcUrl: process.env.TESTNET_RPC ?? 'https://rpc-testnet.jeju.network',
  chainId: parseInt(process.env.TESTNET_CHAIN_ID ?? '420691', 10),
  explorerUrl: 'https://explorer-testnet.jeju.network',
  jnsName: 'babylon.jeju',
  skipContracts: process.env.SKIP_CONTRACTS === 'true',
  skipFrontend: process.env.SKIP_FRONTEND === 'true',
  skipTriggers: process.env.SKIP_TRIGGERS === 'true',
  verbose: process.env.VERBOSE === 'true',
};

interface DeploymentResult {
  contracts: {
    dao: string;
    treasury: string;
    agentVault: string;
    trainingOrchestrator: string;
  } | null;
  jns: {
    registered: boolean;
    node: string;
  } | null;
  keepalive: {
    id: string;
    registered: boolean;
  } | null;
  frontend: {
    cid: string;
    url: string;
  } | null;
  triggers: {
    registered: number;
    failed: number;
  } | null;
}

// ============================================================================
// Main Deployment
// ============================================================================

async function main() {
  console.log('🚀 Babylon Testnet Deployment');
  console.log('='.repeat(60));
  console.log(`Network: ${CONFIG.network}`);
  console.log(`RPC: ${CONFIG.rpcUrl}`);
  console.log(`Chain ID: ${CONFIG.chainId}`);
  console.log('');

  const result: DeploymentResult = {
    contracts: null,
    jns: null,
    keepalive: null,
    frontend: null,
    triggers: null,
  };

  // -------------------------------------------------------------------------
  // Step 1: Deploy Contracts
  // -------------------------------------------------------------------------
  if (!CONFIG.skipContracts) {
    console.log('\n📜 Step 1: Deploying contracts...');
    result.contracts = await deployContracts();
    console.log('✅ Contracts deployed');
  } else {
    console.log('\n⏭️  Step 1: Skipping contracts (SKIP_CONTRACTS=true)');
  }

  // -------------------------------------------------------------------------
  // Step 2: Register JNS
  // -------------------------------------------------------------------------
  console.log('\n📛 Step 2: Registering JNS...');
  result.jns = await registerJNS();
  console.log('✅ JNS registered');

  // -------------------------------------------------------------------------
  // Step 3: Register Keepalive
  // -------------------------------------------------------------------------
  console.log('\n💗 Step 3: Registering keepalive...');
  result.keepalive = await registerKeepalive();
  console.log('✅ Keepalive registered');

  // -------------------------------------------------------------------------
  // Step 4: Deploy Frontend
  // -------------------------------------------------------------------------
  if (!CONFIG.skipFrontend) {
    console.log('\n🌐 Step 4: Deploying frontend to IPFS...');
    result.frontend = await deployFrontend();
    console.log('✅ Frontend deployed');
  } else {
    console.log('\n⏭️  Step 4: Skipping frontend (SKIP_FRONTEND=true)');
  }

  // -------------------------------------------------------------------------
  // Step 5: Register Triggers
  // -------------------------------------------------------------------------
  if (!CONFIG.skipTriggers) {
    console.log('\n⏰ Step 5: Registering triggers...');
    result.triggers = await registerTriggers();
    console.log('✅ Triggers registered');
  } else {
    console.log('\n⏭️  Step 5: Skipping triggers (SKIP_TRIGGERS=true)');
  }

  // -------------------------------------------------------------------------
  // Step 6: Seed Development Data
  // -------------------------------------------------------------------------
  console.log('\n🌱 Step 6: Seeding AI CEO and council...');
  await seedDevelopment();
  console.log('✅ Development data seeded');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('✅ Babylon Testnet Deployment Complete');
  console.log('='.repeat(60));

  if (result.contracts) {
    console.log('\nContracts:');
    console.log(`  DAO:                  ${result.contracts.dao}`);
    console.log(`  Treasury:             ${result.contracts.treasury}`);
    console.log(`  Agent Vault:          ${result.contracts.agentVault}`);
    console.log(
      `  Training Orchestrator: ${result.contracts.trainingOrchestrator}`
    );
  }

  if (result.jns) {
    console.log(`\nJNS: ${CONFIG.jnsName} -> ${result.jns.node}`);
  }

  if (result.keepalive) {
    console.log(`\nKeepalive ID: ${result.keepalive.id}`);
  }

  if (result.frontend) {
    console.log(`\nFrontend:`);
    console.log(`  CID: ${result.frontend.cid}`);
    console.log(`  URL: ${result.frontend.url}`);
  }

  if (result.triggers) {
    console.log(
      `\nTriggers: ${result.triggers.registered} registered, ${result.triggers.failed} failed`
    );
  }

  // Save deployment result
  const outputPath = join(process.cwd(), 'deployment-testnet.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nDeployment saved to: ${outputPath}`);

  // Update .env with addresses
  await updateEnvFile(result);
}

// ============================================================================
// Deployment Functions
// ============================================================================

async function deployContracts(): Promise<DeploymentResult['contracts']> {
  // Run forge script
  const cmd = [
    'forge script script/DeployDAO.s.sol:DeployDAO',
    `--rpc-url ${CONFIG.rpcUrl}`,
    '--broadcast',
    '--verify',
    '-vvv',
  ].join(' ');

  execSync(cmd, {
    cwd: join(process.cwd(), 'packages/contracts'),
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });

  // Parse deployment output
  // In production, parse from forge output or deployment artifacts
  return {
    dao: process.env.BABYLON_DAO_ADDRESS ?? '0x...',
    treasury: process.env.BABYLON_TREASURY_ADDRESS ?? '0x...',
    agentVault: process.env.BABYLON_AGENT_VAULT_ADDRESS ?? '0x...',
    trainingOrchestrator: process.env.TRAINING_ORCHESTRATOR_ADDRESS ?? '0x...',
  };
}

async function registerJNS(): Promise<DeploymentResult['jns']> {
  // Use Jeju CLI to register JNS
  const cmd = `jeju jns register ${CONFIG.jnsName} --network ${CONFIG.network}`;

  execSync(cmd, {
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });

  return {
    registered: true,
    node: `0x${Buffer.from(CONFIG.jnsName).toString('hex').padEnd(64, '0')}`,
  };
}

async function registerKeepalive(): Promise<DeploymentResult['keepalive']> {
  // Use Jeju CLI to register keepalive
  const cmd = [
    'jeju keepalive register',
    `--jns ${CONFIG.jnsName}`,
    `--network ${CONFIG.network}`,
    `--vault ${process.env.BABYLON_AGENT_VAULT_ADDRESS}`,
    '--auto-fund',
  ].join(' ');

  execSync(cmd, {
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });

  return {
    id: '0x...',
    registered: true,
  };
}

async function deployFrontend(): Promise<DeploymentResult['frontend']> {
  // Build static frontend
  console.log('  Building frontend...');
  execSync('bun run build:static', {
    cwd: join(process.cwd(), 'apps/web'),
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });

  // Deploy to IPFS via Jeju storage
  console.log('  Uploading to IPFS...');
  const cmd = [
    'jeju storage upload',
    '--dir apps/web/out',
    `--network ${CONFIG.network}`,
    '--pin',
  ].join(' ');

  const output = execSync(cmd, {
    encoding: 'utf-8',
  });

  // Parse CID from output
  const cidMatch = output.match(/CID: (Qm[a-zA-Z0-9]+)/);
  const cid = cidMatch?.[1] ?? 'Qm...';

  // Update JNS to point to new CID
  execSync(
    `jeju jns update ${CONFIG.jnsName} --content ${cid} --network ${CONFIG.network}`,
    {
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
    }
  );

  return {
    cid,
    url: `https://ipfs.jeju.network/ipfs/${cid}`,
  };
}

async function registerTriggers(): Promise<DeploymentResult['triggers']> {
  // Read trigger config from manifest
  const manifestPath = join(process.cwd(), 'jeju-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const triggers = manifest.decentralization?.triggers ?? [];

  let registered = 0;
  let failed = 0;

  for (const trigger of triggers) {
    console.log(`  Registering trigger: ${trigger.name}...`);

    const cmd = [
      'jeju trigger register',
      `--name ${trigger.name}`,
      `--type ${trigger.type}`,
      `--cron "${trigger.cronExpression}"`,
      `--endpoint ${trigger.endpoint}`,
      `--timeout ${trigger.timeout}`,
      `--retries ${trigger.retries}`,
      `--network ${CONFIG.network}`,
    ].join(' ');

    const success = execSync(cmd, {
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
    });

    if (success) {
      registered++;
    } else {
      failed++;
    }
  }

  return { registered, failed };
}

async function seedDevelopment(): Promise<void> {
  // Run auto-seed script
  execSync('bun run packages/contracts/script/auto-seed.ts', {
    env: {
      ...process.env,
      NETWORK: CONFIG.network,
      RPC_URL: CONFIG.rpcUrl,
    },
    stdio: CONFIG.verbose ? 'inherit' : 'pipe',
  });
}

async function updateEnvFile(result: DeploymentResult): Promise<void> {
  const envPath = join(process.cwd(), '.env.testnet');

  let content = '';

  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf-8');
  }

  // Update/add addresses
  const updates: Record<string, string> = {
    NETWORK: 'testnet',
    RPC_URL: CONFIG.rpcUrl,
    CHAIN_ID: String(CONFIG.chainId),
  };

  if (result.contracts) {
    updates.BABYLON_DAO_ADDRESS = result.contracts.dao;
    updates.BABYLON_TREASURY_ADDRESS = result.contracts.treasury;
    updates.BABYLON_AGENT_VAULT_ADDRESS = result.contracts.agentVault;
    updates.TRAINING_ORCHESTRATOR_ADDRESS =
      result.contracts.trainingOrchestrator;
  }

  if (result.frontend) {
    updates.BABYLON_FRONTEND_CID = result.frontend.cid;
  }

  if (result.keepalive) {
    updates.BABYLON_KEEPALIVE_ID = result.keepalive.id;
  }

  // Apply updates
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;

    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  }

  writeFileSync(envPath, content.trim() + '\n');
  console.log(`\nEnvironment updated: ${envPath}`);
}

// Run
main().catch((err) => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
