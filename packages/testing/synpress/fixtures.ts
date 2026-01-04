/**
 * Synpress test fixtures for MetaMask wallet integration
 *
 * This module provides test fixtures for Babylon E2E testing with MetaMask.
 * It adds Babylon-specific configuration.
 *
 * @module @babylon/testing/synpress/fixtures
 *
 * @example
 * ```typescript
 * import { test, expect } from '@babylon/testing/synpress/fixtures';
 * import { expect } from '@playwright/test';
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

// Import directly from @playwright/test:
// import { expect } from '@playwright/test'

// Import directly from @jejunetwork/tests:
// import { PASSWORD } from '@jejunetwork/tests'
export const walletPassword = PASSWORD

export { basicSetup }
