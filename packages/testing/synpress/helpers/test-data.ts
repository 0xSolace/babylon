/**
 * Test data constants for Babylon synpress tests
 *
 * Extends the canonical Jeju test data with Babylon-specific routes,
 * selectors, and test data.
 *
 * @module @babylon/testing/synpress/helpers/test-data
 */

// Re-export base test data from Jeju
export {
  generateTestEmail,
  generateTestId,
  generateTestUsername,
  HTTP_STATUS,
  sleep,
  TEST_FORM_DATA,
  TEST_NUMBERS,
  TIMEOUTS,
  TRADING_TEST_DATA,
  VIEWPORTS,
} from '@jejunetwork/tests'

// Import for extending
import {
  BASE_SELECTORS as JEJU_BASE_SELECTORS,
  TEST_WALLET_ADDRESS,
} from '@jejunetwork/tests'

// ============================================================================
// Babylon-Specific Routes
// ============================================================================

/**
 * All page routes in the Babylon application
 */
export const ROUTES = {
  // Core routes
  HOME: '/',
  FEED: '/feed',
  CHATS: '/chats',

  // Profile routes
  PROFILE: '/profile',
  PROFILE_BY_ID: (id: string) => `/profile/${id}`,

  // Markets routes
  MARKETS: '/markets',
  MARKETS_PERPS: '/markets/perps',
  MARKETS_PERPS_BY_TICKER: (ticker: string) => `/markets/perps/${ticker}`,
  MARKETS_PREDICTIONS: '/markets/predictions',
  MARKETS_PREDICTIONS_BY_ID: (id: string) => `/markets/predictions/${id}`,

  // Other main pages
  BETTING: '/betting',
  GAME: '/game',
  LEADERBOARD: '/leaderboard',
  NOTIFICATIONS: '/notifications',
  REWARDS: '/rewards',
  REPUTATION: '/reputation',
  REGISTRY: '/registry',
  DAO: '/dao',
  LAUNCH: '/launch',

  // Settings
  SETTINGS: '/settings',
  SETTINGS_MODERATION: '/settings/moderation',

  // Agents
  AGENTS: '/agents',
  AGENTS_CREATE: '/agents/create',
  AGENTS_BY_ID: (id: string) => `/agents/${id}`,

  // Content
  POST_BY_ID: (id: string) => `/post/${id}`,
  ARTICLE_BY_ID: (id: string) => `/article/${id}`,
  COMMENT_BY_ID: (id: string) => `/comment/${id}`,
  TRENDING_BY_TAG: (tag: string) => `/trending/${tag}`,
  TRENDING_GROUP: '/trending/group',

  // Admin
  ADMIN: '/admin',
  ADMIN_GROUPS: '/admin/groups',
  ADMIN_ICO: '/admin/ico',
  ADMIN_PERFORMANCE: '/admin/performance',
  ADMIN_RL_TRAINING: '/admin/rl-training',
  ADMIN_TRAINING: '/admin/training',

  // Share
  SHARE_PNL: (userId: string) => `/share/pnl/${userId}`,
  SHARE_REFERRAL: (userId: string) => `/share/referral/${userId}`,

  // Auth
  AUTH_CALLBACK: '/auth/callback',

  // API docs
  API_DOCS: '/api-docs',
} as const

/**
 * All routes that should be accessible without authentication
 */
export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.FEED,
  ROUTES.MARKETS,
  ROUTES.LEADERBOARD,
  ROUTES.REGISTRY,
  ROUTES.REPUTATION,
  ROUTES.PROFILE,
  ROUTES.AGENTS,
  ROUTES.DAO,
  ROUTES.GAME,
  ROUTES.BETTING,
  ROUTES.LAUNCH,
  ROUTES.API_DOCS,
] as const

/**
 * Routes that require authentication
 */
export const AUTHENTICATED_ROUTES = [
  ROUTES.CHATS,
  ROUTES.NOTIFICATIONS,
  ROUTES.REWARDS,
  ROUTES.SETTINGS,
  ROUTES.SETTINGS_MODERATION,
  ROUTES.AGENTS_CREATE,
] as const

/**
 * Admin-only routes
 */
export const ADMIN_ROUTES = [
  ROUTES.ADMIN,
  ROUTES.ADMIN_GROUPS,
  ROUTES.ADMIN_ICO,
  ROUTES.ADMIN_PERFORMANCE,
  ROUTES.ADMIN_RL_TRAINING,
  ROUTES.ADMIN_TRAINING,
] as const

// ============================================================================
// Babylon-Specific Selectors
// ============================================================================

/**
 * Babylon-specific UI selectors
 *
 * Extends the Jeju base selectors with Babylon-specific elements.
 */
export const SELECTORS = {
  // Include all base selectors from Jeju
  ...JEJU_BASE_SELECTORS,

  // Authentication (Babylon-specific overrides)
  LOGIN_BUTTON:
    'button:has-text("Log in"), button:has-text("Login"), button:has-text("Connect Wallet"), button:has-text("Connect")',
  USER_MENU: '[data-testid="user-menu"]',
  EMAIL_INPUT: 'input[type="email"], input[name="email"]',
  PASSWORD_INPUT: 'input[type="password"]',

  // Navigation
  BOTTOM_NAV: '[data-testid="bottom-nav"], nav.fixed.bottom-0',

  // Feed
  POST_CARD: '[data-testid="post-card"], article, .post-card',
  CREATE_POST_BUTTON:
    'button[aria-label="Create Post"], button:has-text("Post")',
  FEED_TOGGLE: '[data-testid="feed-toggle"]',

  // Markets
  MARKET_TAB: '[role="tab"]',
  MARKET_CARD: 'button:has-text("$"), [data-testid="market-card"]',
  PREDICTION_CARD: '[data-testid="prediction-card"]',
  SORT_BUTTON: 'button:has-text("Trending"), button:has-text("Volume")',

  // Profile
  PROFILE_AVATAR: '[data-testid="profile-avatar"], img[alt*="avatar" i]',
  FOLLOW_BUTTON: 'button:has-text("Follow")',
  MESSAGE_BUTTON: 'button:has-text("Message")',
  EDIT_PROFILE_BUTTON: 'button:has-text("Edit")',

  // Settings
  SETTINGS_TAB: 'button[role="tab"], .settings-tab',
  SAVE_BUTTON: 'button:has-text("Save")',
  THEME_RADIO: 'input[type="radio"][name="theme"]',

  // Chat
  CHAT_LIST: '[data-testid="chat-list"]',
  CHAT_INPUT:
    'textarea[placeholder*="message" i], input[placeholder*="message" i]',
  SEND_BUTTON: 'button[aria-label*="send" i], button:has-text("Send")',

  // Admin
  ADMIN_TAB: '[data-testid="admin-tab"], button.admin-tab',
  ADMIN_TABLE: 'table, [role="table"]',
} as const

// ============================================================================
// Babylon-Specific Test Data
// ============================================================================

/**
 * Default test account - uses canonical Jeju test wallet
 */
export const DEFAULT_ANVIL_ACCOUNT = {
  address: TEST_WALLET_ADDRESS,
  privateKey:
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  mnemonic: 'test test test test test test test test test test test junk',
} as const

/**
 * Babylon-specific form data
 */
export const BABYLON_FORM_DATA = {
  // Agent creation
  AGENT_NAME: 'Test Agent',
  AGENT_DESCRIPTION: 'This is a test agent for E2E testing.',
  AGENT_PERSONA: 'A helpful test assistant',

  // Market creation (admin)
  MARKET_QUESTION: 'Will the test pass?',
  MARKET_DESCRIPTION: 'A test prediction market',

  // Post creation
  POST_CONTENT: 'This is a test post from E2E tests',
  ARTICLE_TITLE: 'Test Article Title',
  ARTICLE_CONTENT: 'This is test article content for E2E testing.',
} as const
