#!/usr/bin/env bun

import { $ } from 'bun';

const LOCAL_RPC_URL =
  process.env.LOCAL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'http://localhost:8545';

const LOCAL_TEST_ENV = {
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
};

async function isLocalRpcReady(): Promise<boolean> {
  const response = await fetch(LOCAL_RPC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return false;
  }

  const payload = (await response.json()) as { result?: string };
  return typeof payload.result === 'string' && payload.result.startsWith('0x');
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

if (!(await isLocalRpcReady())) {
  console.log('🔨 Starting local Anvil node for localnet tests...');
  anvilProcess = Bun.spawn(
    ['anvil', '--host', '0.0.0.0', '--port', '8545', '--chain-id', '31337'],
    {
      cwd: process.cwd(),
      env: LOCAL_TEST_ENV,
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  if (!(await waitForLocalRpc(30_000))) {
    console.error('❌ Local Anvil node did not become ready in time');
    await shutdownAndExit(1);
  }
} else {
  console.log('✅ Reusing existing local Anvil node');
}

console.log('🔄 Bootstrapping local contracts and onchain market state...');
const bootstrapResult =
  await $`bun run scripts/wait-for-hardhat-and-deploy.ts`.env({
    ...LOCAL_TEST_ENV,
    BABYLON_LOCAL_BOOTSTRAP_ONCE: '1',
  });

if (bootstrapResult.exitCode !== 0) {
  console.error('❌ Local bootstrap failed');
  await shutdownAndExit(bootstrapResult.exitCode);
}

console.log('🧪 Running localnet smoke tests...');
const testResult =
  await $`bun test ./packages/testing/integration/agent0-localnet.test.ts ./packages/testing/deployment/localnet.test.ts`.env(
    LOCAL_TEST_ENV
  );

await shutdownAndExit(testResult.exitCode);
