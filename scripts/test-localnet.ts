#!/usr/bin/env bun

import { $ } from 'bun';
import { readFileSync } from 'fs';

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8547';
const LOCAL_RPC = new URL(LOCAL_RPC_URL);
const LOCALNET_TEST_FILES = [
  './packages/testing/integration/agent0-localnet.test.ts',
  './packages/testing/deployment/localnet.test.ts',
];

function buildLocalTestEnv(
  overrides: Record<string, string> = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DEPLOYMENT_ENV: 'localnet',
    NEXT_PUBLIC_CHAIN_ID: '31337',
    CHAIN_ID: '31337',
    NEXT_PUBLIC_RPC_URL: LOCAL_RPC_URL,
    RPC_URL: LOCAL_RPC_URL,
    LOCAL_RPC_URL,
    NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS: 'true',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'onchain',
    PERP_SETTLEMENT_MODE: 'onchain',
    ...overrides,
  };
}

function loadLocalDeploymentEnv(): Record<string, string> {
  const deployment = JSON.parse(
    readFileSync('packages/contracts/deployments/local/index.json', 'utf-8')
  ) as {
    contracts?: {
      diamond?: string;
    };
  };
  const diamondAddress = deployment.contracts?.diamond;

  if (!diamondAddress) {
    throw new Error('Localnet diamond deployment metadata is missing');
  }

  return {
    NEXT_PUBLIC_DIAMOND_ADDRESS: diamondAddress,
    BABYLON_DIAMOND_ADDRESS: diamondAddress,
  };
}

async function sendLocalRpcRequest(
  method: string,
  params: unknown[] = []
): Promise<Response | null> {
  const response = await fetch(LOCAL_RPC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  }).catch(() => null);

  return response?.ok ? response : null;
}

async function isLocalRpcReady(): Promise<boolean> {
  const response = await sendLocalRpcRequest('eth_blockNumber');

  if (!response?.ok) {
    return false;
  }

  const payload = (await response.json()) as { result?: string };
  return typeof payload.result === 'string' && payload.result.startsWith('0x');
}

async function resetLocalRpc(): Promise<boolean> {
  return (await sendLocalRpcRequest('anvil_reset')) !== null;
}

async function configureLocalMining(): Promise<boolean> {
  const autoMineConfigured =
    (await sendLocalRpcRequest('evm_setAutomine', [true])) !== null;
  const intervalMiningConfigured =
    (await sendLocalRpcRequest('evm_setIntervalMining', [1])) !== null;

  return autoMineConfigured && intervalMiningConfigured;
}

async function waitForLocalRpc(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isLocalRpcReady()) {
      return true;
    }
    await Bun.sleep(1000);
  }

  return false;
}

let anvilProcess: Bun.Subprocess | null = null;

async function shutdownAndExit(code: number): Promise<never> {
  if (anvilProcess) {
    anvilProcess.kill('SIGTERM');
    await anvilProcess.exited;
  }

  process.exit(code);
}

async function ensureDedicatedLocalAnvil(): Promise<void> {
  if (!(await isLocalRpcReady())) {
    console.log('🔨 Starting local Anvil node for localnet tests...');
    anvilProcess = Bun.spawn(
      [
        'anvil',
        '--host',
        LOCAL_RPC.hostname,
        '--port',
        LOCAL_RPC.port,
        '--chain-id',
        '31337',
      ],
      {
        cwd: process.cwd(),
        env: buildLocalTestEnv(),
        stdout: 'inherit',
        stderr: 'inherit',
      }
    );

    if (!(await waitForLocalRpc(30_000))) {
      console.error('❌ Local Anvil node did not become ready in time');
      await shutdownAndExit(1);
    }

    if (!(await configureLocalMining())) {
      console.error('❌ Failed to configure localnet mining mode');
      await shutdownAndExit(1);
    }

    return;
  }

  console.log('✅ Reusing dedicated localnet test Anvil node');
  if (!(await resetLocalRpc())) {
    console.error('❌ Failed to reset the dedicated localnet test chain');
    await shutdownAndExit(1);
  }

  if (!(await configureLocalMining())) {
    console.error('❌ Failed to configure localnet mining mode');
    await shutdownAndExit(1);
  }
}

await ensureDedicatedLocalAnvil();

console.log('🔄 Bootstrapping local contracts and onchain market state...');
const bootstrapResult =
  await $`bun run scripts/wait-for-local-chain-and-deploy.ts`.env(
    buildLocalTestEnv({
      BABYLON_LOCAL_BOOTSTRAP_ONCE: '1',
    })
  );

if (bootstrapResult.exitCode !== 0) {
  console.error('❌ Local bootstrap failed');
  await shutdownAndExit(bootstrapResult.exitCode);
}

console.log('🧪 Running localnet smoke tests...');
const localDeploymentEnv = loadLocalDeploymentEnv();
const testProcess = Bun.spawn(['bun', 'test', ...LOCALNET_TEST_FILES], {
  cwd: process.cwd(),
  env: buildLocalTestEnv(localDeploymentEnv),
  stdout: 'inherit',
  stderr: 'inherit',
});

await shutdownAndExit(await testProcess.exited);
