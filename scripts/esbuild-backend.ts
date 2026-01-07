#!/usr/bin/env bun
/**
 * Build Babylon backend worker using esbuild
 * 
 * esbuild handles path aliases better than Bun's bundler
 */

import { build } from 'esbuild'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dir, '..')
const MONOREPO_ROOT = resolve(ROOT_DIR, '../..')
const DIST_DIR = resolve(ROOT_DIR, 'dist/worker')

const network = process.env.NETWORK ?? process.env.JEJU_NETWORK ?? 'testnet'

console.log(`Building Babylon Backend Worker for ${network}...\n`)

// Clean dist directory
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true })
}
mkdirSync(DIST_DIR, { recursive: true })

// Shim plugin for packages that need stubbing (native bindings, WASM, etc.)
const shimPlugin = {
  name: 'shim-plugin',
  setup(build: { onResolve: (opts: {filter: RegExp}, cb: (args: {path: string}) => {path: string, namespace?: string} | undefined) => void; onLoad: (opts: {filter: RegExp, namespace?: string}, cb: () => {contents: string, loader: string}) => void }) {
    // Shim tiktoken with a no-op implementation
    build.onResolve({ filter: /^tiktoken$/ }, () => ({
      path: 'tiktoken',
      namespace: 'tiktoken-shim',
    }))
    build.onResolve({ filter: /^js-tiktoken$/ }, () => ({
      path: 'js-tiktoken',
      namespace: 'tiktoken-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'tiktoken-shim' }, () => ({
      contents: `
        // Tiktoken shim - provides dummy tokenization for DWS workers
        export function encodingForModel() {
          return {
            encode: (text) => text ? text.split(' ') : [],
            decode: (tokens) => tokens.join(' '),
            free: () => {},
          };
        }
        export function getEncoding() {
          return encodingForModel();
        }
        export function get_encoding() {
          return encodingForModel();
        }
        export default { encodingForModel, getEncoding, get_encoding };
      `,
      loader: 'js',
    }))

    // Shim html-to-image (uses canvas which needs native bindings)
    build.onResolve({ filter: /^html-to-image$/ }, () => ({
      path: 'html-to-image',
      namespace: 'html-to-image-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'html-to-image-shim' }, () => ({
      contents: `
        // html-to-image shim - not available in serverless environment
        export const toPng = async () => { throw new Error('html-to-image not available in DWS worker'); };
        export const toJpeg = async () => { throw new Error('html-to-image not available in DWS worker'); };
        export const toBlob = async () => { throw new Error('html-to-image not available in DWS worker'); };
        export const toCanvas = async () => { throw new Error('html-to-image not available in DWS worker'); };
        export const toSvg = async () => { throw new Error('html-to-image not available in DWS worker'); };
        export default { toPng, toJpeg, toBlob, toCanvas, toSvg };
      `,
      loader: 'js',
    }))

    // Shim canvas and @napi-rs/canvas
    build.onResolve({ filter: /^canvas$|^@napi-rs\/canvas$/ }, () => ({
      path: 'canvas',
      namespace: 'canvas-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'canvas-shim' }, () => ({
      contents: `
        // Canvas shim - not available in serverless environment
        export const createCanvas = () => { throw new Error('canvas not available in DWS worker'); };
        export default { createCanvas };
      `,
      loader: 'js',
    }))

    // Shim @xmtp packages (require native Rust bindings)
    build.onResolve({ filter: /^@xmtp\/node-bindings$/ }, () => ({
      path: '@xmtp/node-bindings',
      namespace: 'xmtp-shim',
    }))
    build.onResolve({ filter: /^@xmtp\/node-sdk$/ }, () => ({
      path: '@xmtp/node-sdk',
      namespace: 'xmtp-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'xmtp-shim' }, () => ({
      contents: `
        // XMTP shim - native bindings not available in DWS workers
        // Stub all known exports from @xmtp/node-bindings and @xmtp/node-sdk
        const notAvailable = () => { throw new Error('XMTP native bindings not available in DWS worker'); };
        
        // Function exports
        export const generateInboxId = notAvailable;
        export const getInboxIdForIdentifier = notAvailable;
        export const revokeInstallationsSignatureRequest = notAvailable;
        export const applySignatureRequest = notAvailable;
        export const inboxStateFromInboxIds = notAvailable;
        export const verifySignedWithPublicKey = notAvailable;
        export const isAddressAuthorized = notAvailable;
        export const isInstallationAuthorized = notAvailable;
        export const createClient = notAvailable;
        
        // Enum/type exports
        export const ConsentEntityType = {};
        export const ConsentState = {};
        export const ConversationType = {};
        export const DeliveryStatus = {};
        export const GroupMember = {};
        export const GroupMembershipState = {};
        export const GroupMessageKind = {};
        export const GroupMetadata = {};
        export const GroupPermissions = {};
        export const GroupPermissionsOptions = {};
        export const IdentifierKind = {};
        export const LogLevel = {};
        export const MetadataField = {};
        export const PermissionLevel = {};
        export const PermissionPolicy = {};
        export const PermissionUpdateType = {};
        export const SignatureRequestHandle = {};
        export const SortDirection = {};
        
        // Class exports
        export class Client { constructor() { notAvailable(); } }
        export class Signer { constructor() { notAvailable(); } }
        
        export default { Client, Signer, createClient };
      `,
      loader: 'js',
    }))
  },
}

// Path alias plugin for workspace packages
const pathAliasPlugin = {
  name: 'path-alias',
  setup(build: { onResolve: (opts: {filter: RegExp}, cb: (args: {path: string, importer: string}) => {path: string} | undefined) => void }) {
    // @babylon/* packages
    build.onResolve({ filter: /^@babylon\/db$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/db/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/engine$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/engine/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/shared$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/shared/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/shared\/config$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/shared/src/config/index.ts') }))
    build.onResolve({ filter: /^@babylon\/agents$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/agents/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/a2a$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/a2a/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/mcp$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/mcp/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/api$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/api/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/auth$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/auth/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/training$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/training/src/index.ts') }))
    build.onResolve({ filter: /^@babylon\/core$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/core/index.ts') }))
    build.onResolve({ filter: /^@babylon\/core\/markets$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/core/markets/index.ts') }))
    build.onResolve({ filter: /^@babylon\/client$/ }, () => ({ path: resolve(ROOT_DIR, 'packages/client/src/index.ts') }))
    // CRITICAL: @babylon/server must resolve to app.ts NOT index.ts
    // index.ts has startServer() auto-call which causes double listen() errors
    // NOTE: Server consolidated into apps/api
    build.onResolve({ filter: /^@babylon\/server$/ }, () => ({ path: resolve(ROOT_DIR, 'apps/api/src/app.ts') }))

    // @jejunetwork/* packages
    build.onResolve({ filter: /^@jejunetwork\/config$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/config/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/shared$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/shared/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/types$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/types/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/auth$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/auth/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/kms$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/kms/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/db$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/db/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/sdk$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/sdk/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/training$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/training/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/messaging$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/messaging/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/mcp$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/mcp/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/agents$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/agents/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/a2a$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/a2a/src/index.ts') }))
    build.onResolve({ filter: /^@jejunetwork\/bots$/ }, () => ({ path: resolve(MONOREPO_ROOT, 'packages/bots/src/index.ts') }))
  },
}

const result = await build({
  // Use dws-worker.ts - the canonical worker entry point
  entryPoints: [resolve(ROOT_DIR, 'apps/api/dws-worker.ts')],
  outfile: resolve(DIST_DIR, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  plugins: [shimPlugin, pathAliasPlugin],
  // Tell esbuild where to find node_modules
  nodePaths: [
    resolve(MONOREPO_ROOT, 'node_modules'),
    resolve(ROOT_DIR, 'node_modules'),
    resolve(ROOT_DIR, 'apps/api/node_modules'),
  ],
  external: [
    'bun',
    'bun:sqlite',
    'child_process',
    'node:child_process',
    'http2',
    'tls',
    'dgram',
    'net',
    'dns',
    'cluster',
    'fs',
    'path',
    'crypto',
    'http',
    'https',
    'stream',
    'os',
    'url',
    'util',
    'events',
    'buffer',
    'querystring',
    'zlib',
    'assert',
    'worker_threads',
    'node:fs',
    'node:path',
    'node:crypto',
    'node:url',
    'node:util',
    'node:stream',
    'node:events',
    'node:buffer',
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.JEJU_NETWORK': JSON.stringify(network),
    'process.env.NETWORK': JSON.stringify(network),
    // CRITICAL: Set import.meta.main to false for ALL bundled modules
    // This prevents side-effect code in libraries (like startAtroposServer, GRPOTrainer auto-start)
    // from executing when they're imported as dependencies rather than run directly
    'import.meta.main': 'false',
  },
  logLevel: 'info',
  metafile: true,
})

if (result.errors.length > 0) {
  console.error('Build failed:')
  for (const error of result.errors) {
    console.error(error)
  }
  process.exit(1)
}

// Report bundle size
const outputPath = resolve(DIST_DIR, 'index.js')
const { size } = await Bun.file(outputPath)
const sizeStr = size > 1024 * 1024 
  ? `${(size / 1024 / 1024).toFixed(2)} MB`
  : `${(size / 1024).toFixed(1)} KB`

console.log(`\n📊 Bundle Size: ${sizeStr}`)
console.log(`✅ Backend worker built successfully`)
console.log(`   Output: ${outputPath}`)
