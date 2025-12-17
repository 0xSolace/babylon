/**
 * Next.js Static Export Configuration
 *
 * For static deployment to IPFS/CloudFront as a client-side SPA.
 */

import type { NextConfig } from 'next';
import path from 'path';

const staticConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  transpilePackages: ['@babylon/shared'],

  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  env: {
    NEXT_PUBLIC_STATIC_BUILD: 'true',
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.babylon.market',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN ?? 'babylon.market',
    NEXT_PUBLIC_IPFS_GATEWAY:
      process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://ipfs.babylon.market',
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },

  turbopack: {
    root: path.resolve(__dirname, '../../../../'),
    rules: {
      '*.md': { loaders: ['raw-loader'], as: '*.txt' },
      LICENSE: { loaders: ['raw-loader'], as: '*.txt' },
    },
    resolveAlias: {
      pino: './src/lib/pino-stub.ts',
      'thread-stream': './src/lib/thread-stream-stub.ts',
    },
  },

  typescript: { ignoreBuildErrors: true },

  webpack: (config, { isServer }) => {
    if (isServer) return config;

    config.module.rules.push({ test: /LICENSE$/, type: 'asset/source' });

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      dns: false,
      path: false,
      crypto: false,
      stream: false,
      util: false,
      worker_threads: false,
    };

    const stubDir = path.resolve(process.cwd(), 'src/lib');
    config.resolve.alias = {
      ...config.resolve.alias,
      pino: path.join(stubDir, 'pino-stub.ts'),
      'thread-stream': path.join(stubDir, 'thread-stream-stub.ts'),
    };

    return config;
  },
};

export default staticConfig;
