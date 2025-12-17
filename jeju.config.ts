/**
 * Jeju Vendor App Configuration
 *
 * This file configures Babylon as a Jeju vendor application.
 * When running `jeju dev`, this configuration tells Jeju how to:
 * - Start Babylon's development server
 * - Configure required services (CQL, Cache, Storage, OAuth3)
 * - Deploy static assets to IPFS
 */

import type { JejuVendorConfig } from '@jeju/types';

const config: JejuVendorConfig = {
  name: 'babylon',
  displayName: 'Babylon',
  description: 'AI-driven prediction markets and social trading platform',
  version: '0.1.0',

  // Development configuration
  dev: {
    // Command to start the dev server
    command: 'bun run dev:web',
    // Port the dev server runs on
    port: 5007,
    // Pre-dev setup script
    setup: 'bun run scripts/pre-dev/pre-dev-decentralized.ts',
    // Health check endpoint
    healthCheck: '/api/health',
  },

  // Required Jeju services
  services: {
    cql: {
      required: true,
      databaseId: 'babylon',
      schemaPath: 'packages/db/src/decentralized/cql-schema.ts',
    },
    cache: {
      required: true,
      namespace: 'babylon',
    },
    storage: {
      required: false, // Storage is optional but recommended
      namespace: 'babylon',
    },
    oauth3: {
      required: false, // OAuth3 optional for local dev
      appId: 'babylon',
      redirectUri: 'http://localhost:5007/auth/callback',
    },
    kms: {
      required: false, // KMS optional for local dev
    },
  },

  // Build configuration
  build: {
    command: 'bun run build',
    outputDir: 'apps/web/.next',
    staticDir: 'apps/web/.next/static',
  },

  // Deployment configuration
  deploy: {
    // Deploy static assets to IPFS
    ipfs: {
      enabled: true,
      pin: true,
      directories: ['apps/web/.next/static', 'apps/web/public'],
    },
    // Environment-specific configurations
    environments: {
      localnet: {
        chainId: 31337,
      },
      testnet: {
        chainId: 420690,
        domain: 'testnet.babylon.game',
      },
      mainnet: {
        chainId: 420691,
        domain: 'babylon.game',
      },
    },
  },

  // Environment variables that Jeju should inject
  env: {
    // Required - Jeju will set these automatically
    CQL_BLOCK_PRODUCER_ENDPOINT: '${JEJU_CQL_ENDPOINT}',
    CQL_DATABASE_ID: 'babylon',
    JEJU_CACHE_SERVICE_URL: '${JEJU_CACHE_ENDPOINT}',
    JEJU_STORAGE_SERVICE_URL: '${JEJU_STORAGE_ENDPOINT}',
    JEJU_OAUTH3_SERVICE_URL: '${JEJU_OAUTH3_ENDPOINT}',
    JEJU_KMS_ENDPOINT: '${JEJU_KMS_ENDPOINT}',
    JEJU_NETWORK: '${JEJU_NETWORK}',

    // App-specific defaults
    NEXT_PUBLIC_APP_NAME: 'Babylon',
    NEXT_PUBLIC_CHAIN_ID: '${CHAIN_ID}',
  },

  // Hooks for custom logic
  hooks: {
    // Called before dev starts
    preDev: async () => {
      console.log('[Babylon] Preparing development environment...');
    },
    // Called after build completes
    postBuild: async () => {
      console.log('[Babylon] Build complete, deploying static assets...');
      // The deploy-static-to-ipfs.ts script is called automatically
    },
    // Called on file changes in dev mode
    onFileChange: async (paths: string[]) => {
      // Handle hot reload for specific file types
      const schemaChanged = paths.some((p) => p.includes('cql-schema'));
      if (schemaChanged) {
        console.log('[Babylon] Schema changed, running migrations...');
      }
    },
  },
};

export default config;
