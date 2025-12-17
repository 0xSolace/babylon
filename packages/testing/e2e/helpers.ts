/**
 * E2E test helpers for authentication and common operations.
 *
 * Uses OAuth3 (Jeju's decentralized auth) for authentication.
 *
 * @module testing/e2e/helpers
 */

import type { Page } from '@playwright/test';

/**
 * Gets OAuth3 test account credentials from environment variables.
 *
 * @returns Object containing wallet address (or email for legacy support)
 * @throws Error if OAUTH3_TEST_WALLET is not set
 */
export function getOAuth3TestAccount() {
  const walletAddress = process.env.OAUTH3_TEST_WALLET;
  const email = process.env.OAUTH3_TEST_EMAIL; // Optional, for email-based auth

  if (!walletAddress && !email) {
    throw new Error(
      'OAUTH3_TEST_WALLET or OAUTH3_TEST_EMAIL environment variable is required for E2E tests'
    );
  }

  return { walletAddress, email };
}

/**
 * Authenticates with OAuth3 and waits for successful login.
 *
 * @param page - Playwright page instance
 */
export async function authenticateWithOAuth3(page: Page) {
  const { walletAddress } = getOAuth3TestAccount();

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Check if already logged in
  const isAlreadyLoggedIn = await page
    .evaluate(() => {
      const hasUserMenu =
        document.querySelector('[data-testid="user-menu"]') !== null;
      const hasProfile = Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent?.includes('Profile')
      );
      const hasToken = window.localStorage.getItem('oauth3:token') !== null;
      return (hasUserMenu || hasProfile) && hasToken;
    })
    .catch(() => false);

  if (isAlreadyLoggedIn) {
    console.log('✅ Already authenticated - skipping login flow');
    return;
  }

  // Find and click login button
  const loginButton = page
    .locator(
      'button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login"), button:has-text("Connect")'
    )
    .first();

  const loginButtonVisible = await loginButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (loginButtonVisible) {
    try {
      await loginButton.click({ timeout: 5000 });
    } catch (e) {
      console.log('⚠️  Normal click failed, trying force click...', e);
      await loginButton.click({ force: true });
    }
    await page.waitForTimeout(1000);
  }

  // Wait for wallet connect option
  const walletOption = page
    .locator(
      'button:has-text("Wallet"), button:has-text("MetaMask"), button:has-text("Connect Wallet")'
    )
    .first();

  const walletOptionVisible = await walletOption
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (walletOptionVisible) {
    await walletOption.click();
    await page.waitForTimeout(2000);
  }

  // Wait for authentication to complete
  type WindowWithOAuth3Token = Window & {
    __oauth3AccessToken?: unknown;
  };

  await page.waitForFunction(
    () => {
      const win = window as WindowWithOAuth3Token;
      const hasAccessToken = win.__oauth3AccessToken;
      if (hasAccessToken) return true;

      const hasUserMenu =
        document.querySelector('[data-testid="user-menu"]') !== null;
      const hasProfileButton = Array.from(
        document.querySelectorAll('button')
      ).some((b) => b.textContent?.includes('Profile'));
      const hasOAuth3Token =
        window.localStorage.getItem('oauth3:token') !== null;

      return (hasUserMenu || hasProfileButton) && hasOAuth3Token;
    },
    { timeout: 30000 }
  );

  console.log(`✅ Authentication successful for wallet: ${walletAddress}`);
}

// Legacy exports for backwards compatibility
export const getPrivyTestAccount = getOAuth3TestAccount;
export const authenticateWithPrivy = authenticateWithOAuth3;
