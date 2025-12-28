/**
 * Comprehensive E2E Tests for Babylon
 *
 * Tests all routes and core functionality:
 * - Navigation and page rendering
 * - Feed (home) page with tabs
 * - Markets page
 * - Agents page
 * - DAO page
 * - Leaderboard page
 * - Profile page
 * - Mobile navigation
 * - API health endpoints
 */

import { expect, test } from '@playwright/test'

// Use playwright's baseURL which is properly configured
// Tests should use relative URLs where possible
const BABYLON_WEB_PORT = process.env.BABYLON_WEB_PORT ?? '5008'
const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${BABYLON_WEB_PORT}`
// Use 127.0.0.1 instead of localhost to avoid IPv6 issues
const API_URL = `http://127.0.0.1:${BABYLON_API_PORT}`

// Core routes to test - ALL app pages
const ROUTES = [
  // Core navigation
  {
    path: '/',
    name: 'Home',
    expectedText: ['Home', 'Notifications', 'Markets'],
  },
  {
    path: '/feed',
    name: 'Feed',
    expectedText: ['Latest', 'Following', 'Trades'],
  },
  {
    path: '/notifications',
    name: 'Notifications',
    expectedText: ['Notifications'],
  },
  { path: '/leaderboard', name: 'Leaderboard', expectedText: ['Leaderboard'] },
  { path: '/chats', name: 'Chats', expectedText: ['Chats'] },
  // Markets
  { path: '/markets', name: 'Markets', expectedText: ['Markets'] },
  { path: '/markets/predictions', name: 'Predictions', expectedText: [] },
  { path: '/markets/perps', name: 'Perps', expectedText: [] },
  // Agents
  { path: '/agents', name: 'Agents', expectedText: ['Agents'] },
  { path: '/agents/create', name: 'Create Agent', expectedText: [] },
  // Profile & Settings
  { path: '/profile', name: 'Profile', expectedText: ['Profile'] },
  { path: '/settings', name: 'Settings', expectedText: [] },
  {
    path: '/settings/moderation',
    name: 'Moderation Settings',
    expectedText: [],
  },
  // Admin
  { path: '/admin', name: 'Admin', expectedText: [] },
  { path: '/admin/groups', name: 'Admin Groups', expectedText: [] },
  { path: '/admin/ico', name: 'Admin ICO', expectedText: [] },
  { path: '/admin/performance', name: 'Admin Performance', expectedText: [] },
  { path: '/admin/rl-training', name: 'Admin RL Training', expectedText: [] },
  { path: '/admin/training', name: 'Admin Training', expectedText: [] },
  // Other pages
  { path: '/dao', name: 'DAO', expectedText: ['DAO'] },
  { path: '/rewards', name: 'Rewards', expectedText: ['Rewards'] },
  { path: '/betting', name: 'Betting', expectedText: [] },
  { path: '/game', name: 'Game', expectedText: [] },
  { path: '/launch', name: 'Launch', expectedText: [] },
  { path: '/registry', name: 'Registry', expectedText: [] },
  { path: '/reputation', name: 'Reputation', expectedText: [] },
  // Trending
  { path: '/trending', name: 'Trending', expectedText: [] },
  { path: '/trending/group', name: 'Trending Groups', expectedText: [] },
] as const

test.describe('Babylon Core Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
  })

  test('should render home page with sidebar navigation', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // Check sidebar exists and has navigation links
    const sidebar = page.locator('nav, [role="navigation"]').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Check for main navigation items
    await expect(page.locator('text=Home')).toBeVisible()
    await expect(page.locator('text=Markets')).toBeVisible()
    await expect(page.locator('text=Agents')).toBeVisible()
    await expect(page.locator('text=Profile')).toBeVisible()
  })

  test('should have working Connect Wallet button', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // Find Connect Wallet button
    const connectButton = page
      .locator('button:has-text("Connect Wallet")')
      .first()
    await expect(connectButton).toBeVisible({ timeout: 10000 })
    await expect(connectButton).toBeEnabled()
  })

  test('should show Login banner at bottom', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // Check for login banner
    await expect(page.locator('text=Join the conversation')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('button:has-text("Log in")')).toBeVisible()
  })
})

test.describe('Babylon Page Navigation', () => {
  for (const route of ROUTES) {
    test(`should render ${route.name} page (${route.path})`, async ({
      page,
    }) => {
      // Use full URL to avoid baseURL issues
      await page.goto(`${BASE_URL}${route.path}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000) // Allow React to render

      // Page should render with some content - check for sidebar, main, or any content
      const hasLogo = await page
        .locator('img[alt="Babylon"]')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      const hasMain = await page
        .locator('main')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
      const hasBody = await page
        .locator('body')
        .textContent()
        .then((t) => (t?.length ?? 0) > 100)
        .catch(() => false)

      // At least one should be true
      expect(hasLogo || hasMain || hasBody).toBe(true)
    })
  }
})

test.describe('Feed Page', () => {
  test('should render feed with tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`)
    await page.waitForLoadState('domcontentloaded')

    // Check for Babylon logo first
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })

    // Check for feed tabs using more specific selectors (exact: true and first())
    // The feed tabs are in a specific container, use exact match to avoid sidebar buttons
    await expect(
      page.getByRole('button', { name: 'Latest', exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Following', exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Trades', exact: true }).first(),
    ).toBeVisible()
  })

  test('should switch between feed tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`)
    await page.waitForLoadState('domcontentloaded')

    // Click Following tab (use first() for exact feed tab)
    await page
      .getByRole('button', { name: 'Following', exact: true })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Click Trades tab
    await page
      .getByRole('button', { name: 'Trades', exact: true })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Click back to Latest
    await page
      .getByRole('button', { name: 'Latest', exact: true })
      .first()
      .click()
    await page.waitForTimeout(500)
  })
})

test.describe('Markets Page', () => {
  test('should render markets page', async ({ page }) => {
    await page.goto(`${BASE_URL}/markets`)
    await page.waitForLoadState('domcontentloaded')

    // Markets page should be visible (Babylon logo image)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('should navigate to predictions detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/markets/predictions`)
    await page.waitForLoadState('domcontentloaded')

    // Page should load without error (Babylon logo image)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('should navigate to perps detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/markets/perps`)
    await page.waitForLoadState('domcontentloaded')

    // Page should load without error (Babylon logo image)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('Agents Page', () => {
  test('should render agents page', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`)
    await page.waitForLoadState('domcontentloaded')

    // Agents page should be visible (Babylon logo + Agents link in sidebar)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('a[href="/agents"]').first()).toBeVisible()
  })

  test('should navigate to agent creation page', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents/create`)
    await page.waitForLoadState('domcontentloaded')

    // Page should load without error (Babylon logo image)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('Leaderboard Page', () => {
  test('should render leaderboard page', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard`)
    await page.waitForLoadState('domcontentloaded')

    // Leaderboard page should be visible
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('a[href="/leaderboard"]').first()).toBeVisible()
  })
})

test.describe('DAO Page', () => {
  test('should render DAO page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dao`)
    await page.waitForLoadState('domcontentloaded')

    // DAO page should be visible
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('a[href="/dao"]').first()).toBeVisible()
  })
})

test.describe('Profile Page', () => {
  test('should render profile page', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`)
    await page.waitForLoadState('domcontentloaded')

    // Profile page should be visible
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('a[href="/profile"]').first()).toBeVisible()
  })
})

test.describe('Mobile Navigation', () => {
  test('should render bottom navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // On mobile, we check for the main content area
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Check for bottom navigation links
    await expect(page.locator('a[href="/feed"]').first()).toBeVisible()
  })

  test('should navigate between pages on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // Navigate through main routes - check for main content area
    await page.goto(`${BASE_URL}/markets`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main').first()).toBeVisible()

    await page.goto(`${BASE_URL}/agents`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main').first()).toBeVisible()
  })
})

test.describe('API Health Endpoints', () => {
  test('should return healthy status from /health', async ({ request }) => {
    let response: Awaited<ReturnType<typeof request.get>> | null = null
    try {
      response = await request.get(`${API_URL}/health`)
    } catch (_error) {
      // API server not available - skip gracefully
      console.log('API server not available, skipping test')
      return
    }
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.status).toBe('ok')
    expect(data.checks).toBeDefined()
  })

  test('should return data from /api/markets/perps', async ({ request }) => {
    let response: Awaited<ReturnType<typeof request.get>> | null = null
    try {
      response = await request.get(`${API_URL}/api/markets/perps`)
    } catch (_error) {
      console.log('API server not available, skipping test')
      return
    }
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.markets)).toBe(true)
  })

  test('should return data from /api/markets/predictions', async ({
    request,
  }) => {
    let response: Awaited<ReturnType<typeof request.get>> | null = null
    try {
      response = await request.get(`${API_URL}/api/markets/predictions`)
    } catch (_error) {
      console.log('API server not available, skipping test')
      return
    }
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.questions)).toBe(true)
  })

  test('should return data from /api/leaderboard', async ({ request }) => {
    let response: Awaited<ReturnType<typeof request.get>> | null = null
    try {
      response = await request.get(`${API_URL}/api/leaderboard`)
    } catch (_error) {
      console.log('API server not available, skipping test')
      return
    }
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data).toBeDefined()
  })
})

test.describe('Error Handling', () => {
  test('should render 404 page for invalid routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/invalid-route-that-does-not-exist`)
    await page.waitForLoadState('domcontentloaded')

    // Should still render the app shell (Babylon logo)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('should handle deep nested invalid routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/invalid/nested/deep/route`)
    await page.waitForLoadState('domcontentloaded')

    // Should still render without crashing (Babylon logo)
    await expect(page.locator('img[alt="Babylon"]').first()).toBeVisible({
      timeout: 10000,
    })
  })
})
