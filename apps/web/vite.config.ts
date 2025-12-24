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
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/stores': resolve(__dirname, './src/stores'),
      '@/app': resolve(__dirname, './src/app'),
      '@/contexts': resolve(__dirname, './src/contexts'),
      // Workspace packages - using directory paths to support subpath imports
      '@babylon/shared': resolve(__dirname, '../../packages/shared/src'),
      '@babylon/core': resolve(__dirname, '../../packages/core'),
      '@babylon/core/markets': resolve(
        __dirname,
        '../../packages/core/markets',
      ),
      '@babylon/agents': resolve(__dirname, '../../packages/agents/src'),
      '@babylon/api': resolve(__dirname, '../../packages/api/src'),
      '@babylon/auth': resolve(__dirname, '../../packages/auth/src'),
      '@babylon/messaging': resolve(__dirname, '../../packages/messaging/src'),
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          radix: [
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  define: {
    'process.env.PUBLIC_API_BASE_URL': JSON.stringify(
      process.env.PUBLIC_API_BASE_URL || `http://localhost:${API_PORT}`,
    ),
    'process.env.PUBLIC_WAITLIST_MODE': JSON.stringify(
      process.env.PUBLIC_WAITLIST_MODE || 'false',
    ),
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
