/**
 * Centralized Frontend Configuration for Babylon Web App
 *
 * All configuration is defined statically here - NO process.env in browser code.
 * The build system injects values at build time, or we use sensible defaults.
 *
 * For different environments, rebuild with different config values.
 */

import {
  type EnvironmentName,
  getAPIBaseUrl,
  getCurrentChainId,
  getCurrentEndpoints,
  getCurrentEnvironment,
  getCurrentRpcUrl,
  getIpfsGateway,
} from '@babylon/shared'
import type { Address } from 'viem'

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Feature flags for the application.
 * These control visibility of features across the app.
 */
export const FEATURE_FLAGS = {
  /** Enable waitlist mode - shows coming soon page */
  waitlistMode: false,

  /** Enable static build mode - rewrites API URLs */
  staticBuild: false,

  /** Enable development mode features */
  isDev: false,
} as const

// =============================================================================
// External URLs
// =============================================================================

/**
 * External URLs for the application.
 */
export const EXTERNAL_URLS = {
  /** Blog URL */
  blog: 'https://blog.babylon.market',

  /** Discord invite URL */
  discordInvite: 'https://discord.gg/4DYsFgyp',

  /** Documentation URL */
  docs: 'https://docs.babylon.market',

  /** GitHub repository */
  github: 'https://github.com/BabylonSocial/babylon',

  /** Twitter/X profile */
  twitter: 'https://x.com/PlayBabylon',

  /** Farcaster profile */
  farcaster: 'https://warpcast.com/babylon',
} as const

// =============================================================================
// Analytics Configuration
// =============================================================================

/**
 * PostHog analytics configuration.
 * Set these values at build time for production.
 */
export const ANALYTICS_CONFIG = {
  /** PostHog API key - empty string disables analytics */
  posthogKey: '',

  /** PostHog API host */
  posthogHost: 'https://us.i.posthog.com',
} as const

// =============================================================================
// OAuth Configuration
// =============================================================================

/**
 * OAuth provider configuration.
 * These are optional - wallet auth works without them.
 */
export const OAUTH_CONFIG = {
  /** Twitter OAuth client ID */
  twitterClientId: undefined as string | undefined,

  /** Discord OAuth client ID */
  discordClientId: undefined as string | undefined,

  /** Neynar API key for Farcaster */
  neynarApiKey: undefined as string | undefined,
} as const

// =============================================================================
// Network & Chain Configuration
// =============================================================================

/**
 * Get the current environment name.
 */
export function getEnvironment(): EnvironmentName {
  return getCurrentEnvironment()
}

/**
 * Get the current chain ID.
 */
export function getChainId(): number {
  return getCurrentChainId()
}

/**
 * Get the current RPC URL.
 */
export function getRpcUrl(): string {
  return getCurrentRpcUrl()
}

/**
 * Get the API base URL.
 */
export function getApiBaseUrl(): string {
  return getAPIBaseUrl()
}

/**
 * Get the IPFS gateway URL.
 */
export function getIpfsGatewayUrl(): string {
  return getIpfsGateway()
}

/**
 * Get the WebSocket base URL.
 */
export function getWsBaseUrl(): string {
  const apiUrl = getApiBaseUrl()
  return apiUrl.replace(/^http/, 'ws')
}

/**
 * Get the storage API URL.
 */
export function getStorageApiUrl(): string {
  const endpoints = getCurrentEndpoints()
  // Use IPFS gateway as storage API for now
  return endpoints.ipfsGateway
}

// =============================================================================
// MPC Configuration
// =============================================================================

/**
 * Get MPC endpoints based on environment.
 */
export function getMpcEndpoints(): string[] {
  const env = getEnvironment()
  switch (env) {
    case 'mainnet':
      return ['https://mpc.jejunetwork.org']
    case 'testnet':
      return ['https://mpc.testnet.jejunetwork.org']
    default:
      return ['http://localhost:4010']
  }
}

/**
 * Get the OAuth redirect URI.
 */
export function getRedirectUri(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5008/auth/callback'
  }
  return `${window.location.origin}/auth/callback`
}

// =============================================================================
// Contract Addresses (ICO/Presale specific)
// =============================================================================

/**
 * Presale-specific contract addresses.
 * These are separate from the core contracts in shared config.
 */
export const PRESALE_CONTRACTS = {
  /** BBLN Presale contract address - set at build time */
  bblnPresale: undefined as Address | undefined,

  /** Moderation marketplace address */
  moderationMarketplace:
    '0x0000000000000000000000000000000000000000' as Address,

  /** Ban manager address */
  banManager: '0x0000000000000000000000000000000000000000' as Address,
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if we're in a browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Check if we're in development mode.
 */
export function isDevelopment(): boolean {
  return FEATURE_FLAGS.isDev
}

/**
 * Check if we're running on localhost.
 */
export function isLocalhost(): boolean {
  if (!isBrowser()) return false
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Check if waitlist mode is enabled.
 */
export function isWaitlistMode(): boolean {
  return FEATURE_FLAGS.waitlistMode
}

/**
 * Check if static build mode is enabled.
 */
export function isStaticBuild(): boolean {
  return FEATURE_FLAGS.staticBuild
}

/**
 * Check if analytics is enabled.
 */
export function isAnalyticsEnabled(): boolean {
  return ANALYTICS_CONFIG.posthogKey !== ''
}
