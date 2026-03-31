import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import basicSetup from './synpress/wallet.setup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(
  __dirname,
  `.cache-synpress/${basicSetup.hash}`
);

async function ensureWalletCache(): Promise<void> {
  try {
    await access(cacheDir);
    return;
  } catch {}

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['synpress', 'synpress'],
      {
        cwd: __dirname,
        env: process.env,
        stdio: 'inherit',
      }
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`synpress cache build failed with exit code ${code ?? -1}`));
    });
    child.on('error', reject);
  });
}

export default async function globalSetup(): Promise<void> {
  await ensureWalletCache();
}
