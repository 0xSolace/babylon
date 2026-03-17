import { spawnSync } from 'node:child_process';
import withSerwistInit from '@serwist/next';
import { config } from 'dotenv';
import type { NextConfig } from 'next';
import * as path from 'path';

// Use process.cwd() which works reliably in Next.js config context
// This is the app directory (apps/web), so go up two levels to get monorepo root
const monorepoRoot = path.resolve(process.cwd(), '../..');

// Serwist PWA — service worker generation
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  }).stdout?.trim() || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  disable: process.env.NODE_ENV === 'development',
});

// Capture any Sentry auth token explicitly provided by the environment before dotenv runs.
// We intentionally ignore tokens sourced from local `.env` files to avoid stale/invalid tokens
// breaking developer builds when CI is set in the environment (common in some shells/CI runners).
const sentryAuthTokenFromProcessEnv = process.env.SENTRY_AUTH_TOKEN;

// Load .env files from monorepo root before Next.js processes them
// This ensures env vars are available during config evaluation and at runtime
config({ path: path.join(monorepoRoot, '.env') });
config({ path: path.join(monorepoRoot, '.env.local') });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Specify workspace root for monorepo
  outputFileTracingRoot: monorepoRoot,
  // Use standalone output for dynamic routes and API endpoints
  // Temporarily disabled for Next.js 16 compatibility
  // output: 'standalone',
  // Transpile internal workspace packages to resolve TypeScript imports properly
  // This is necessary because these packages are not pre-built and use TypeScript source directly
  transpilePackages: [
    '@babylon/shared',
    '@babylon/engine',
    '@babylon/agents',
    '@babylon/api',
    '@babylon/db',
    '@babylon/training',
    '@babylon/contracts',
    '@babylon/a2a',
  ],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      'date-fns',
      'ethers',
      'viem',
      'react-hook-form',
      '@hookform/resolvers',
      '@tanstack/react-query',
      'class-variance-authority',
      'zod',
      'ai',
    ],
    // instrumentationHook removed - available by default in Next.js 15+
    // Reduce peak memory during webpack build (Next.js 15+)
    webpackMemoryOptimizations: true,
    // Run webpack in a worker to lower main process memory (can help with 14GB+ builds)
    webpackBuildWorker: true,
    // Cap parallelism to avoid dozens of jest-worker children and load average 200+
    cpus: 4,
    // Disable parallel worker threads so we don't spawn 50+ jest-worker processes (slower build, sane load)
    workerThreads: false,
  },
  typescript: {
    // Ignore type errors during build - we run typecheck separately via turbo
    ignoreBuildErrors: true,
  },
  // Skip prerendering for feed page (client-side only)
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: false,
  // Farcaster Mini App manifest serving
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/farcaster.json',
      },
      {
        source: '/.well-known/agent-card.json',
        destination: '/api/game/card',
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: '/assetlinks.json',
      },
    ];
  },
  // Externalize packages with native Node.js dependencies for server-side
  // Note: @babylon/* packages are in transpilePackages, so they can't be here
  //
  // @elizaos/* packages are ESM-only ("type": "module"). Listing them here tells
  // Next.js 16 to resolve them via native import() at runtime — NOT via the manual
  // webpack externals callback below (which emits 'commonjs require()' calls and
  // causes ERR_REQUIRE_ESM on Vercel). serverExternalPackages is necessary but NOT
  // sufficient to solve the 250 MB Lambda limit; see outputFileTracingExcludes below.
  serverExternalPackages: [
    'ipfs-http-client',
    '@helia/unixfs',
    'helia',
    'blockstore-core',
    'datastore-core',
    '@libp2p/interface',
    'electron-fetch',
    'swagger-jsdoc',
    'postgres',
    'drizzle-orm',
    'drizzle-orm/postgres-js',
    'ioredis', // Node.js Redis client - requires tls/net modules not available in edge runtime
    // ESM-only ElizaOS runtime packages — resolved via import() at runtime.
    '@elizaos/core',
    '@elizaos/plugin-anthropic',
    '@elizaos/plugin-openai',
    '@elizaos/plugin-sql',
    '@elizaos/prompts',
  ],
  //
  // Vercel 250 MB Lambda size fix — two-layer approach:
  //
  // Layer 1 (serverExternalPackages above): tells webpack NOT to bundle @elizaos/* —
  //   instead it emits `import('@elizaos/core')` calls in the output. Necessary for
  //   ESM-only packages, but Vercel's @vercel/nft file tracer still sees those import()
  //   references and physically copies all @elizaos/* files into every Lambda ZIP.
  //
  // Layer 2 (outputFileTracingExcludes below): tells @vercel/nft NOT to trace @elizaos/*
  //   files for routes that never execute the ElizaOS runtime. Only 7 of the ~39 routes
  //   that import @babylon/agents actually call agentRuntimeManager or @elizaos/core at
  //   runtime; the rest only reach DB/service code through the @babylon/agents barrel.
  //   Excluding @elizaos from the other 32 routes' Lambdas eliminates the size bloat.
  //
  // Routes confirmed to execute @elizaos/core at runtime (NOT excluded):
  //   /api/cron/agent-tick
  //   /api/cron/npc-tick
  //   /api/agents/[agentId]/chat
  //   /api/agents/team-chat/coordinator
  //   /api/agents/[agentId]/benchmark
  //   /api/agents/generate-field
  //   /api/debug/clear-agent-cache
  //
  // All other routes import only types/DB-services from @babylon/agents and are safe
  // to exclude. The barrel import side-effect is a known Next.js limitation with
  // transpilePackages; outputFileTracingExcludes is the documented workaround (see
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/outputFileTracingExcludes).
  outputFileTracingExcludes: {
    // Agent CRUD and listing routes — DB queries only, no ElizaOS inference
    '/api/agents': ['./node_modules/@elizaos/**/*'],
    '/api/agents/activity': ['./node_modules/@elizaos/**/*'],
    '/api/agents/auth': ['./node_modules/@elizaos/**/*'],
    '/api/agents/discover': ['./node_modules/@elizaos/**/*'],
    '/api/agents/generate-profile': ['./node_modules/@elizaos/**/*'],
    '/api/agents/onboard': ['./node_modules/@elizaos/**/*'],
    '/api/agents/team-chat': ['./node_modules/@elizaos/**/*'],
    '/api/agents/team-chat/conversations': ['./node_modules/@elizaos/**/*'],
    '/api/agents/team-chat/conversations/[chatId]': [
      './node_modules/@elizaos/**/*',
    ],
    '/api/agents/team-chat/message': ['./node_modules/@elizaos/**/*'],
    '/api/agents/team-chat/typing': ['./node_modules/@elizaos/**/*'],
    // Per-agent detail routes — DB queries only
    '/api/agents/[agentId]': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/.well-known/agent-card': [
      './node_modules/@elizaos/**/*',
    ],
    '/api/agents/[agentId]/a2a': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/activity': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/alerts': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/card': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/goals': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/goals/[goalId]': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/logs': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/recent-trades': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/trading-balance': ['./node_modules/@elizaos/**/*'],
    '/api/agents/[agentId]/wallet': ['./node_modules/@elizaos/**/*'],
    // External agent adapter — HTTP bridge, no local inference
    '/api/agents/external/[externalId]/revoke': [
      './node_modules/@elizaos/**/*',
    ],
    '/api/agents/external/connect': ['./node_modules/@elizaos/**/*'],
    '/api/agents/external/discover': ['./node_modules/@elizaos/**/*'],
    '/api/agents/external/register': ['./node_modules/@elizaos/**/*'],
    // Agent templates — pure static JSON, no runtime
    '/api/agent-templates': ['./node_modules/@elizaos/**/*'],
    '/api/agent-templates/[archetype]': ['./node_modules/@elizaos/**/*'],
    // Registry — DB queries only
    '/api/registry/all': ['./node_modules/@elizaos/**/*'],
    // Reputation — DB sync, no inference
    '/api/reputation/sync': ['./node_modules/@elizaos/**/*'],
    '/api/cron/reputation-sync': ['./node_modules/@elizaos/**/*'],
    // Feedback routes — scoring/storage, no inference
    '/api/feedback/auto-generate': ['./node_modules/@elizaos/**/*'],
    '/api/feedback/game-to-agent': ['./node_modules/@elizaos/**/*'],
    '/api/feedback/submit': ['./node_modules/@elizaos/**/*'],
    '/api/feedback/user-to-agent': ['./node_modules/@elizaos/**/*'],
    // Admin agent management — DB queries only
    '/api/admin/agents': ['./node_modules/@elizaos/**/*'],
    '/api/admin/users/[userId]/ban': ['./node_modules/@elizaos/**/*'],
  },
  images: {
    qualities: [100, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Turbopack config for monorepo
  // Explicitly set root to suppress Next.js warning about multiple lockfiles.
  // The monorepo root contains the main bun.lock at /Users/shawwalters/babylon/bun.lock.
  // Nested packages (apps/docs, packages/examples) may have their own lockfiles, but this
  // is the correct root for the web app's workspace.
  turbopack: {
    root: monorepoRoot,
  },
  // Webpack configuration for backward compatibility
  webpack: (config, { isServer, webpack }) => {
    // Enable WebAssembly experiments for tiktoken
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    // Fix for IPFS, electron-fetch, and React Native dependencies
    // Also handle Node.js built-ins that server-only packages require
    config.resolve.fallback = {
      ...config.resolve.fallback,
      electron: false,
      fs: false,
      'node:fs': false,
      'node:fs/promises': false,
      'node:path': false,
      'node:os': false,
      'node:crypto': false,
      'node:stream': false,
      'node:util': false,
      'node:url': false,
      'node:net': false,
      'node:tls': false,
      'node:dns': false,
      'node:perf_hooks': false,
      net: false,
      tls: false,
      dns: false,
      perf_hooks: false,
      path: false,
      crypto: false,
      stream: false,
      util: false,
      url: false,
      os: false,
      '@react-native-async-storage/async-storage': false,
    };

    // Alias electron to stub module to prevent webpack from trying to resolve it
    // electron-fetch checks process.versions.electron at runtime, so the stub is safe
    const electronStubPath = path.join(
      process.cwd(),
      'webpack-electron-stub.js'
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      electron: electronStubPath,
    };

    // Ignore electron module completely - electron-fetch will handle it at runtime
    // This prevents webpack from trying to resolve electron during bundling
    const electronFetchStubPath = path.join(
      process.cwd(),
      'webpack-electron-fetch-stub.js'
    );
    config.plugins = config.plugins || [];

    // Apply replacements early, before other plugins
    config.plugins.unshift(
      // Use NormalModuleReplacementPlugin to replace electron with our stub
      // This is more reliable than IgnorePlugin for this case
      new webpack.NormalModuleReplacementPlugin(/^electron$/, electronStubPath),
      // Replace electron-fetch with our stub to prevent electron dependency
      // electron-fetch checks process.versions.electron at runtime anyway
      new webpack.NormalModuleReplacementPlugin(
        /^electron-fetch$/,
        electronFetchStubPath
      )
    );

    // Client: ignore server-only packages so they are never bundled in the browser.
    // Server: Next.js serverExternalPackages + externals below handle runtime resolution.
    if (!isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp:
            /^@babylon\/(api|db|contracts|training|agents)(\/.*)?$|^(ioredis|postgres|electron-fetch|agent0-sdk|ipfs-http-client)$|^@elizaos\/core$/,
        })
      );
    }

    // Common: fallbacks for electron/electron-fetch (replaced above) and optional swagger-jsdoc
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(electron|electron-fetch|swagger-jsdoc)$/,
      })
    );

    // Configure externals for optional dependencies and server-only packages
    // swagger-jsdoc is optional and handled gracefully in the code with try-catch
    // electron and electron-fetch need special handling to prevent bundling issues
    if (isServer) {
      // For server-side, ensure packages in serverExternalPackages are externalized
      // They're already in serverExternalPackages, but we also configure webpack
      // to externalize them so they're resolved at runtime from node_modules
      // NOTE: Do NOT externalize @babylon/* packages - they are TypeScript source files
      // and must be transpiled by webpack via transpilePackages.
      // NOTE: Do NOT add @elizaos/* here — they use serverExternalPackages above so that
      // Next.js resolves them via import() (ESM-safe). Adding them here would emit
      // 'commonjs require()' calls and cause ERR_REQUIRE_ESM on Vercel.
      const serverExternalPackagesList = [
        'postgres',
        'drizzle-orm',
        'drizzle-orm/postgres-js',
        'ioredis',
        'swagger-jsdoc',
      ];

      if (!Array.isArray(config.externals)) {
        if (typeof config.externals === 'function') {
          const originalExternals = config.externals;
          config.externals = [
            originalExternals,
            (
              {
                request,
              }: {
                request: string | undefined;
              },
              callback: (error?: Error | null, result?: string) => void
            ) => {
              if (
                request &&
                serverExternalPackagesList.some(
                  (pkg) => request === pkg || request.startsWith(pkg + '/')
                )
              ) {
                // Externalize server-only packages - resolve at runtime
                return callback(null, 'commonjs ' + request);
              }
              callback();
            },
          ];
        } else {
          config.externals = [];
        }
      }
      if (Array.isArray(config.externals)) {
        config.externals.push(
          (
            {
              request,
            }: {
              request: string | undefined;
            },
            callback: (error?: Error | null, result?: string) => void
          ) => {
            if (
              request &&
              serverExternalPackagesList.some(
                (pkg) => request === pkg || request.startsWith(pkg + '/')
              )
            ) {
              // Externalize server-only packages - resolve at runtime
              return callback(null, 'commonjs ' + request);
            }
            callback();
          }
        );
      }
    } else {
      // Externalize agent0-sdk and related packages to prevent bundling electron-fetch
      // Also externalize postgres and Node.js-only packages
      // These should only be loaded server-side via dynamic imports
      // CRITICAL: Externalize @babylon/api and @babylon/db to prevent bundling server-only code in client
      const serverOnlyPackages = [
        'agent0-sdk',
        '@babylon/agents/agent0',
        'ipfs-http-client',
        'electron-fetch',
        'postgres',
        'ioredis',
        '@babylon/db',
        '@babylon/api',
        '@babylon/contracts',
        'swagger-jsdoc',
      ];

      const nodeBuiltIns = [
        'fs',
        'node:fs',
        'node:fs/promises',
        'net',
        'node:net',
        'tls',
        'node:tls',
        'dns',
        'node:dns',
        'path',
        'node:path',
        'crypto',
        'node:crypto',
        'stream',
        'node:stream',
        'util',
        'node:util',
        'url',
        'node:url',
        'os',
        'node:os',
        'perf_hooks',
        'node:perf_hooks',
        'electron',
      ];

      // Use function-based externals to catch all imports of server-only packages
      // Webpack externals function signature: ({context, request}, callback)
      const externalizeServerOnly = (
        { request }: { context?: string; request?: string },
        callback: (error?: Error | null, result?: string) => void
      ) => {
        // Externalize server-only packages (exact match or subpath)
        if (
          request &&
          serverOnlyPackages.some(
            (pkg) => request === pkg || request.startsWith(pkg + '/')
          )
        ) {
          return callback(null, `commonjs ${request}`);
        }
        // Externalize Node.js built-ins
        if (request && nodeBuiltIns.includes(request)) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      };

      // Combine with existing externals
      if (Array.isArray(config.externals)) {
        config.externals.push(externalizeServerOnly);
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [originalExternals, externalizeServerOnly];
      } else {
        config.externals = [config.externals, externalizeServerOnly].filter(
          Boolean
        );
      }
    }

    return config;
  },
};

// Only enable Sentry uploads in CI/Vercel builds.
// This prevents local builds from failing if a developer has a stale/invalid token set.
const sentryAuthToken =
  process.env.CI || process.env.VERCEL
    ? sentryAuthTokenFromProcessEnv
    : undefined;

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG ?? 'eliza-uv',

  project: process.env.SENTRY_PROJECT ?? 'babylon',

  // Auth token for uploading source maps and creating releases
  // Set SENTRY_AUTH_TOKEN in environment to enable source map uploads
  authToken: sentryAuthToken,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Suppress warnings when auth token is not provided (e.g., local development)
  hideSourceMaps: !sentryAuthToken,

  // Disable telemetry to suppress warnings during build
  telemetry: false,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

// Wrap Sentry config in async function to handle top-level await
async function getConfig(): Promise<NextConfig> {
  // Apply Serwist PWA wrapper first
  let resolvedConfig: NextConfig = withSerwist(nextConfig);

  // If we're not uploading sourcemaps/releases, don't wrap the config at all.
  // This prevents local builds from invoking Sentry CLI when a stale token is present.
  if (!sentryAuthToken) {
    return resolvedConfig;
  }

  try {
    const { withSentryConfig } = await import('@sentry/nextjs');
    resolvedConfig = withSentryConfig(
      resolvedConfig,
      sentryWebpackPluginOptions
    );
  } catch (error) {
    const shouldLog = process.env.CI || process.env.NODE_ENV !== 'production';
    if (shouldLog) {
      console.warn(
        '[next.config.ts] Sentry integration disabled. Falling back to base config.',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return resolvedConfig;
}

export default getConfig();
