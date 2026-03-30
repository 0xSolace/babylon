#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

function resolveBunBinary(): string {
  const userInstallBinary = `${process.env.HOME ?? ''}/.bun/bin/bun`;
  if (userInstallBinary && Bun.file(userInstallBinary).size > 0) {
    return userInstallBinary;
  }

  const whichResult = Bun.spawnSync(['which', 'bun'], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
  });
  const resolved = whichResult.stdout.toString().trim();

  return resolved || process.execPath;
}

const BUN_BINARY = resolveBunBinary();
const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8547';
const LOCAL_RPC = new URL(LOCAL_RPC_URL);
const LOCAL_ORACLE_PRIVATE_KEY =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const LOCAL_ORACLE_ADDRESS = privateKeyToAccount(
  LOCAL_ORACLE_PRIVATE_KEY as Hex
).address;
const LOCALNET_TEST_FILES = [
  './packages/testing/integration/agent0-localnet.test.ts',
  './packages/testing/integration/onchain-perp-read-model.localnet.test.ts',
  './packages/testing/integration/prediction-pm-amm.localnet.test.ts',
  './packages/testing/deployment/localnet.test.ts',
];

function buildLocalTestEnv(
  overrides: Record<string, string> = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    BUN_ENV: 'test',
    BABYLON_RUN_LOCALNET_TESTS: '1',
    DEPLOYMENT_ENV: 'localnet',
    NEXT_PUBLIC_CHAIN_ID: '31337',
    CHAIN_ID: '31337',
    NEXT_PUBLIC_RPC_URL: LOCAL_RPC_URL,
    RPC_URL: LOCAL_RPC_URL,
    LOCAL_RPC_URL,
    NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS: 'true',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'onchain',
    PERP_SETTLEMENT_MODE: 'onchain',
    DEPLOYER_PRIVATE_KEY:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    ORACLE_PRIVATE_KEY: LOCAL_ORACLE_PRIVATE_KEY,
    ORACLE_SIGNER: LOCAL_ORACLE_ADDRESS,
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

async function waitForLocalRpcShutdown(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isLocalRpcReady())) {
      return true;
    }
    await Bun.sleep(250);
  }

  return false;
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

async function runBunCommand(
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<number> {
  const child = Bun.spawn([BUN_BINARY, ...args], {
    cwd: process.cwd(),
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  return await child.exited;
}

async function shutdownAndExit(code: number): Promise<never> {
  if (anvilProcess) {
    anvilProcess.kill('SIGTERM');
    await anvilProcess.exited;
  }

  process.exit(code);
}

async function stopDedicatedLocalAnvil(): Promise<void> {
  const result = Bun.spawnSync(['lsof', '-ti', `tcp:${LOCAL_RPC.port}`], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
  });
  const pids = result.stdout
    .toString()
    .split('\n')
    .map((value) => Number(value.trim()))
    .filter(Number.isInteger);

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      continue;
    }
  }

  if (pids.length > 0) {
    await waitForLocalRpcShutdown(10_000);
  }
}

async function ensureDedicatedLocalAnvil(): Promise<void> {
  if (await isLocalRpcReady()) {
    console.log('♻️ Restarting dedicated localnet test Anvil node');
    await stopDedicatedLocalAnvil();
  } else {
    console.log('🔨 Starting local Anvil node for localnet tests...');
  }

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
}

await ensureDedicatedLocalAnvil();

console.log('🔄 Bootstrapping local contracts and onchain market state...');
const bootstrapExitCode = await runBunCommand(
  ['run', 'scripts/wait-for-local-chain-and-deploy.ts', '--once'],
  buildLocalTestEnv({
    BABYLON_LOCAL_BOOTSTRAP_ONCE: '1',
    BABYLON_FORCE_LOCAL_REDEPLOY: '1',
  })
);

if (bootstrapExitCode !== 0) {
  console.error('❌ Local bootstrap failed');
  await shutdownAndExit(bootstrapExitCode);
}

console.log('🧪 Running localnet smoke tests...');
const localDeploymentEnv = loadLocalDeploymentEnv();

for (const testFile of LOCALNET_TEST_FILES) {
  console.log(`▶️  ${testFile}`);
  const exitCode = await runBunCommand(
    ['test', testFile],
    buildLocalTestEnv(localDeploymentEnv)
  );
  if (exitCode !== 0) {
    await shutdownAndExit(exitCode);
  }
}

await shutdownAndExit(0);
