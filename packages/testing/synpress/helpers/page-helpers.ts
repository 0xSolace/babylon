/**
 * Page navigation helpers for Babylon synpress tests.
 *
 * This module re-exports the canonical Jeju navigation helpers
 * and adds Babylon-specific configuration.
 *
 * @module @babylon/testing/synpress/helpers/page-helpers
 */

// Re-export all navigation helpers from Jeju
export {
  cooldownBetweenTests,
  getCurrentRoute,
  hideNextDevOverlay,
  isAtRoute,
  navigateTo,
  navigateToRoute,
  waitForPageLoad,
  waitForRoute,
  waitForServerHealthy,
} from '@jejunetwork/tests'

import { navigateTo as jejuNavigateTo } from '@jejunetwork/tests'
import type { Page } from '@playwright/test'

// Babylon-specific port configuration
const WEB_PORT = process.env.BABYLON_WEB_PORT ?? '5008'
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${WEB_PORT}`

/**
 * Navigate to a Babylon route using the configured base URL
 *
 * This is a Babylon-specific wrapper that ensures the correct base URL is used.
 *
 * @param page - Playwright page instance
 * @param route - Route path to navigate to
 */
export async function navigateToBabylon(
  page: Page,
  route: string,
): Promise<void> {
  const fullUrl = route.startsWith('http') ? route : `${BASE_URL}${route}`
  await jejuNavigateTo(page, fullUrl)
}

/**
 * Get the Babylon base URL from environment
 */
export function getBabylonBaseUrl(): string {
  return BASE_URL
}
