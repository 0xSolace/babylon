#!/usr/bin/env bun
/**
 * Build Babylon Static Frontend
 *
 * Builds the frontend for static deployment to IPFS/CloudFront.
 * Excludes server-side code and produces a client-side SPA.
 *
 * Usage: bun run scripts/build-static.ts [--env local|testnet|mainnet]
 * Output: apps/web/out/
 */

import { spawn } from 'bun';
import { cpSync, existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

type Environment = 'local' | 'testnet' | 'mainnet';

interface BuildConfig {
  env: Environment;
  apiBaseUrl: string;
  domain: string;
  ipfsGateway: string;
}

const ENV_CONFIGS: Record<Environment, BuildConfig> = {
  local: {
    env: 'local',
    apiBaseUrl: 'http://localhost:5007',
    domain: 'localhost:5007',
    ipfsGateway: 'http://localhost:5001',
  },
  testnet: {
    env: 'testnet',
    apiBaseUrl: 'https://api.testnet.babylon.market',
    domain: 'testnet.babylon.market',
    ipfsGateway: 'https://ipfs.testnet.babylon.market',
  },
  mainnet: {
    env: 'mainnet',
    apiBaseUrl: 'https://api.babylon.market',
    domain: 'babylon.market',
    ipfsGateway: 'https://ipfs.babylon.market',
  },
};

interface MovedPath {
  src: string;
  backup: string;
}

function parseEnvArg(args: string[]): Environment {
  const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1];
  const envIndex = args.indexOf('--env');
  const envValue = envIndex !== -1 ? args[envIndex + 1] : undefined;
  return (envFlag ?? envValue ?? 'mainnet') as Environment;
}

function cleanBuild(outDir: string, nextDir: string): void {
  console.log('🧹 Cleaning previous build...');
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  if (existsSync(nextDir)) rmSync(nextDir, { recursive: true });
}

function movePath(src: string, backup: string, label: string): boolean {
  if (!existsSync(src)) return false;
  console.log(`📂 Moving ${label}: ${src}`);
  cpSync(src, backup, { recursive: true });
  rmSync(src, { recursive: true });
  return true;
}

function restorePath({ src, backup }: MovedPath): void {
  if (!existsSync(backup)) return;
  cpSync(backup, src, { recursive: true });
  rmSync(backup, { recursive: true });
  console.log(`📂 Restored: ${src}`);
}

async function buildStatic(): Promise<void> {
  const targetEnv = parseEnvArg(process.argv.slice(2));
  const config = ENV_CONFIGS[targetEnv];

  if (!config) {
    console.error(`Unknown environment: ${targetEnv}`);
    console.error('Valid: local, testnet, mainnet');
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║              🏛️  BABYLON STATIC BUILD                                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Environment:  ${config.env.padEnd(56)}║
║  API URL:      ${config.apiBaseUrl.padEnd(56)}║
║  Domain:       ${config.domain.padEnd(56)}║
║  IPFS Gateway: ${config.ipfsGateway.padEnd(56)}║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

  const webDir = join(process.cwd(), 'apps/web');
  const outDir = join(webDir, 'out');

  cleanBuild(outDir, join(webDir, '.next'));

  // Write environment file
  const envPath = join(webDir, '.env.static');
  writeFileSync(
    envPath,
    `# Generated for ${config.env} deployment
NEXT_PUBLIC_STATIC_BUILD=true
NEXT_PUBLIC_API_BASE_URL=${config.apiBaseUrl}
NEXT_PUBLIC_DOMAIN=${config.domain}
NEXT_PUBLIC_IPFS_GATEWAY=${config.ipfsGateway}
SKIP_ENV_VALIDATION=1`
  );
  console.log(`📝 Generated ${envPath}`);

  // Paths to temporarily move during build
  const pathsToMove: Array<{ src: string; backup: string; label: string }> = [
    {
      src: join(webDir, 'src/app/api'),
      backup: join(webDir, 'src/app/_api_backup'),
      label: 'API routes',
    },
    {
      src: join(webDir, 'src/app/mcp'),
      backup: join(webDir, 'src/app/_mcp_backup'),
      label: 'MCP routes',
    },
    {
      src: join(webDir, 'src/app/debug'),
      backup: join(webDir, 'src/app/_debug_backup'),
      label: 'debug routes',
    },
    {
      src: join(webDir, 'src/app/.well-known'),
      backup: join(webDir, 'src/app/_well-known_backup'),
      label: '.well-known',
    },
    {
      src: join(webDir, 'instrumentation.ts'),
      backup: join(webDir, '_instrumentation.ts.bak'),
      label: 'instrumentation',
    },
    {
      src: join(webDir, 'middleware.ts'),
      backup: join(webDir, '_middleware.ts.bak'),
      label: 'middleware',
    },
    // All loading.tsx files in dynamic routes cause issues with static export
    {
      src: join(webDir, 'src/app/markets/perps/[ticker]/loading.tsx'),
      backup: join(webDir, 'src/app/markets/perps/[ticker]/_loading.tsx.bak'),
      label: 'perps loading.tsx',
    },
    {
      src: join(webDir, 'src/app/markets/predictions/[id]/loading.tsx'),
      backup: join(webDir, 'src/app/markets/predictions/[id]/_loading.tsx.bak'),
      label: 'predictions loading.tsx',
    },
    {
      src: join(webDir, 'src/app/post/[id]/loading.tsx'),
      backup: join(webDir, 'src/app/post/[id]/_loading.tsx.bak'),
      label: 'post loading.tsx',
    },
    {
      src: join(webDir, 'src/app/profile/[id]/loading.tsx'),
      backup: join(webDir, 'src/app/profile/[id]/_loading.tsx.bak'),
      label: 'profile loading.tsx',
    },
    {
      src: join(webDir, 'src/app/trending/[tag]/loading.tsx'),
      backup: join(webDir, 'src/app/trending/[tag]/_loading.tsx.bak'),
      label: 'trending loading.tsx',
    },
  ];

  const movedPaths: MovedPath[] = [];
  for (const { src, backup, label } of pathsToMove) {
    if (movePath(src, backup, label)) {
      movedPaths.push({ src, backup });
    }
  }

  // Swap config files
  const mainConfig = join(webDir, 'next.config.ts');
  const staticConfig = join(webDir, 'next.config.static.ts');
  const backupConfig = join(webDir, 'next.config.ts.bak');

  if (existsSync(mainConfig)) cpSync(mainConfig, backupConfig);
  cpSync(staticConfig, mainConfig);
  console.log(`📋 Using static config`);

  // Run build with Turbopack (default for Next.js 16)
  console.log('📦 Building...');
  const proc = spawn(['bun', 'x', 'next', 'build'], {
    cwd: webDir,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_STATIC_BUILD: 'true',
      NEXT_PUBLIC_API_BASE_URL: config.apiBaseUrl,
      NEXT_PUBLIC_DOMAIN: config.domain,
      NEXT_PUBLIC_IPFS_GATEWAY: config.ipfsGateway,
      SKIP_ENV_VALIDATION: '1',
      NODE_OPTIONS: '--max-old-space-size=8192',
      // Use single worker to avoid race condition in page data collection
      NEXT_WORKER_COUNT: '1',
    },
  });

  const exitCode = await proc.exited;

  // Restore everything
  if (existsSync(backupConfig)) {
    cpSync(backupConfig, mainConfig);
    rmSync(backupConfig);
  }
  movedPaths.forEach(restorePath);

  if (exitCode !== 0) {
    console.error('❌ Build failed');
    process.exit(exitCode);
  }

  if (!existsSync(outDir)) {
    console.error('❌ Static export not found at apps/web/out');
    process.exit(1);
  }

  // Create SPA routing files
  const indexPath = join(outDir, 'index.html');
  if (existsSync(indexPath)) {
    cpSync(indexPath, join(outDir, '404.html'));
    console.log('📄 Created 404.html');
  }

  writeFileSync(join(outDir, '_redirects'), '/*    /index.html   200\n');
  writeFileSync(join(outDir, '.nojekyll'), '');
  writeFileSync(
    join(outDir, 'build-info.json'),
    JSON.stringify(
      {
        environment: config.env,
        apiBaseUrl: config.apiBaseUrl,
        domain: config.domain,
        ipfsGateway: config.ipfsGateway,
        buildTime: new Date().toISOString(),
        commit: process.env.GITHUB_SHA ?? 'local',
      },
      null,
      2
    )
  );

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ✅ STATIC BUILD COMPLETE                                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Output: apps/web/out/                                                        ║
║  Deploy: bun run deploy:frontend:${config.env.padEnd(43)}║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
}

buildStatic().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});
