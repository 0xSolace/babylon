/**
 * Integration Tests Authentication Setup
 *
 * This setup script extracts authentication tokens from Playwright's authenticated
 * browser context and saves them for use in integration tests. This allows integration
 * tests to use the same authentication state as E2E tests without manual token management.
 *
 * Uses OAuth3 (Jeju's decentralized auth) for authentication.
 *
 * Prerequisites:
 * - E2E auth setup must run first
 * - Server must be running
 */

import { test as setup } from '@playwright/test';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '../../.playwright/auth.json');
const tokenFile = path.join(__dirname, '../../.playwright/test-tokens.json');
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5007';

setup('extract auth tokens for integration tests', async ({ page }) => {
  // Check if auth state exists (from E2E setup)
  if (!existsSync(authFile)) {
    throw new Error(
      `Authentication state file not found: ${authFile}\n` +
        'Please run E2E auth setup first: bunx playwright test --project=setup'
    );
  }

  // Load authenticated state
  await page.goto(baseURL);

  // Wait for OAuth3 client to be ready
  console.log('⏳ Waiting for OAuth3 client to initialize...');
  await page.waitForFunction(
    () => {
      if (typeof window === 'undefined') return false;
      const oauth3 = (
        window as {
          oauth3?: {
            ready?: boolean;
            getAccessToken?: () => Promise<string | null>;
          };
        }
      ).oauth3;
      return (
        oauth3?.ready === true && typeof oauth3.getAccessToken === 'function'
      );
    },
    { timeout: 30000 }
  );

  console.log('✅ OAuth3 client is ready');

  // Extract access token and user ID from browser
  console.log('🔑 Extracting authentication tokens...');
  const { accessToken, userId } = await page.evaluate(async (apiUrl) => {
    const oauth3 = (
      window as { oauth3?: { getAccessToken?: () => Promise<string | null> } }
    ).oauth3;
    if (!oauth3?.getAccessToken) {
      throw new Error('OAuth3 client getAccessToken not available');
    }

    const token = await oauth3.getAccessToken();
    if (!token) {
      throw new Error(
        'Could not get access token - user may not be authenticated'
      );
    }

    // Get user ID from API
    const response = await fetch(`${apiUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const userData = await response.json();
    return {
      accessToken: token,
      userId: userData.user?.id || null,
    };
  }, baseURL);

  if (!accessToken) {
    throw new Error('Failed to extract access token');
  }

  if (!userId) {
    throw new Error('Failed to extract user ID');
  }

  // Save tokens for integration tests
  const tokenData = {
    TEST_USER_ID: userId,
    TEST_ACCESS_TOKEN: accessToken,
    updatedAt: new Date().toISOString(),
    baseURL: baseURL,
  };

  writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));

  console.log(`✅ Auth tokens extracted and saved to ${tokenFile}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Token: ${accessToken.substring(0, 20)}...`);
  console.log(`   Updated: ${tokenData.updatedAt}`);
});
