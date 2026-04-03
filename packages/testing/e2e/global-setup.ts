/**
 * Playwright Global Setup
 *
 * Runs once before all tests. Deploys contracts to the local Anvil chain
 * started by the webServer config. The deploy script waits for Anvil to be
 * ready and exits after bootstrapping.
 */

import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, '../../..');

  // Deploy contracts to the local chain (Anvil is started by webServer config)
  console.log('🔧 Deploying contracts to local Anvil chain...');
  try {
    execSync(
      'BABYLON_LOCAL_BOOTSTRAP_ONCE=1 bun run scripts/wait-for-local-chain-and-deploy.ts',
      {
        cwd: rootDir,
        stdio: 'inherit',
        timeout: 180_000,
      }
    );
    console.log('✅ Contract deployment complete');
  } catch (error) {
    console.warn(
      '⚠️ Contract deployment failed (on-chain tests may be skipped):',
      error instanceof Error ? error.message : error
    );
  }
}
