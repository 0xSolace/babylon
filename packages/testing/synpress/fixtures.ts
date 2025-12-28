/**
 * Synpress test fixtures for MetaMask wallet integration
 *
 * This module provides test fixtures for Babylon E2E testing with MetaMask.
 * It re-exports the Jeju test infrastructure and adds Babylon-specific configuration.
 *
 * @module @babylon/testing/synpress/fixtures
 *
 * @example
 * ```typescript
 * import { test, expect } from '@babylon/testing/synpress/fixtures';
 *
 * test('should connect wallet', async ({ page, metamask }) => {
 *   await page.goto('/');
 *   await page.click('button:has-text("Connect")');
 *   await metamask.connectToDapp();
 *   await expect(page.getByText(/0x/)).toBeVisible();
 * });
 * ```
 *
 * @see https://docs.synpress.io/docs/playwright/metamask/fixtures
 */

import { PASSWORD } from '@jejunetwork/tests'
import { metaMaskFixtures } from '@synthetixio/synpress-metamask/playwright'
import basicSetup from './wallet.setup'

/**
 * Extended test with MetaMask fixtures
 *
 * Provides:
 * - metamask: MetaMask instance for wallet interactions
 * - context: Playwright browser context with extension
 * - extensionId: MetaMask extension ID
 */
export const test = metaMaskFixtures(basicSetup, 0)

// Re-export from Playwright for convenience
export { expect } from '@playwright/test'

// Re-export wallet password for MetaMask initialization
export const walletPassword = PASSWORD

// Re-export the basic setup for apps that need it
export { basicSetup }
