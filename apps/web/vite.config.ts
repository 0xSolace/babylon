import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Load manifest for port config
const manifestPath = resolve(__dirname, './jeju-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const PORT =
  Number(process.env.BABYLON_WEB_PORT) || manifest.ports?.frontend || 5008
const API_PORT =
  Number(process.env.BABYLON_API_PORT) || manifest.ports?.api || 5009

export default defineConfig({
  // Use relative paths for IPFS/decentralized deployment
  base: process.env.VITE_BASE_URL ?? './',
  plugins: [react()],
  // Production optimizations
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
  },
  resolve: {
    // Ensure only one React instance is used (critical for hooks to work)
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    alias: {
      // Force React to use the same instance across all packages
      'react': resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/stores': resolve(__dirname, './src/stores'),
      '@/app': resolve(__dirname, './src/app'),
      '@/contexts': resolve(__dirname, './src/contexts'),
      // Browser-safe exports only (excludes elysia plugins, dev-server)
      '@babylon/shared': resolve(__dirname, '../../packages/shared/src/browser.ts'),
      '@babylon/core': resolve(__dirname, '../../packages/core'),
      '@babylon/core/markets': resolve(
        __dirname,
        '../../packages/core/markets',
      ),
      '@babylon/agents': resolve(__dirname, '../../packages/agents/src'),
      '@babylon/api': resolve(__dirname, '../../packages/api/src'),
      // Jeju network packages
      '@jejunetwork/auth': resolve(__dirname, '../../../../packages/auth/src'),
      '@jejunetwork/config': resolve(__dirname, '../../../../packages/config'),
      '@jejunetwork/kms': resolve(__dirname, '../../../../packages/kms/src'),
      '@jejunetwork/shared': resolve(
        __dirname,
        '../../../../packages/shared/src',
      ),
      '@jejunetwork/types': resolve(
        __dirname,
        '../../../../packages/types/src',
      ),
      '@babylon/client': resolve(__dirname, '../../packages/client/src'),
      // Engine client - only the browser-safe exports
      '@babylon/engine/client': resolve(
        __dirname,
        '../../packages/engine/src/client.ts',
      ),
      '@babylon/engine': resolve(__dirname, '../../packages/engine/src'),
    },
  },
  server: {
    port: PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: 'hidden', // External sourcemaps for production
    minify: 'esbuild',
    target: 'es2022',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      external: [
        'elysia',
        '@elysiajs/cors',
        '@elysiajs/jwt',
        'bun',
        'bun:sqlite',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:crypto',
        'node:http',
        'node:url',
        'fs',
        'fs/promises',
        'path',
        'crypto',
        'http',
        'child_process',
        'net',
        'tls',
        'dgram',
        'dns',
        'stream',
      ],
      output: {
        // Single bundle for simpler DWS deployment
        manualChunks: undefined,
        inlineDynamicImports: true,
        compact: true,
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
  },
  define: {
    // Define process.env for browser - must define the whole object
    // Use ?? (nullish coalescing) to allow empty string for relative API paths
    'process.env': JSON.stringify({
      PUBLIC_API_BASE_URL: process.env.PUBLIC_API_BASE_URL ?? `http://localhost:${API_PORT}`,
      PUBLIC_WAITLIST_MODE: process.env.PUBLIC_WAITLIST_MODE ?? 'false',
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      NETWORK: process.env.NETWORK ?? 'testnet',
    }),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    exclude: [
      '@babylon/db',
      '@babylon/engine',
      '@babylon/training',
      '@babylon/testing',
      '@grpc/grpc-js',
      'google-gax',
      'google-auth-library',
    ],
  },
  ssr: {
    noExternal: [],
  },
})
