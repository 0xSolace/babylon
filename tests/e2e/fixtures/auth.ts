/**
 * Playwright Auth Fixtures
 * Provides authenticated test contexts with mock user data
 */

import { test as base, expect, type Page, type Route } from '@playwright/test';

// Declare global types for test mode flags
declare global {
  interface Window {
    __E2E_TEST_MODE?: boolean;
    __E2E_TEST_USER?: typeof TEST_USER;
    __E2E_TEST_WALLET?: {
      address: string;
      chainId: string;
    };
    __oauth3GetAccessToken?: () => Promise<string | null>;
  }
}

// Mock test user data
export const TEST_USER = {
  id: 'test-user-12345',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  email: 'test@babylon.test',
  displayName: 'Test User',
  username: 'testuser',
  bio: 'Test user for E2E tests',
  profileComplete: true,
  reputationPoints: 1000,
  referralCode: 'TEST123',
  onChainRegistered: true,
};

// Mock OAuth3 access token
export const MOCK_ACCESS_TOKEN = 'mock-oauth3-access-token-for-testing';

/**
 * Set up authentication state in the browser
 */
export async function setupAuthState(page: Page, navigateToUrl?: string) {
  // Set up route interception BEFORE any navigation
  await page.route('**/api/users/me', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: TEST_USER,
      }),
    });
  });

  await page.route('**/api/users/*/posts*', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: [],
        },
      }),
    });
  });

  // Mock OAuth3 API calls to return authenticated state
  await page.route('**/oauth3/**', (route: Route) => {
    const url = route.request().url();

    // Mock the session validation endpoint
    if (url.includes('/session/validate')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          identityId: TEST_USER.id,
          smartAccount: TEST_USER.walletAddress,
          expiresAt: Date.now() + 3600000,
        }),
      });
    }
    // Mock the token refresh endpoint
    else if (url.includes('/token/refresh')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: MOCK_ACCESS_TOKEN,
          expiresAt: Date.now() + 3600000,
        }),
      });
    }
    // Allow other OAuth3 calls through or mock as needed
    else {
      route.continue();
    }
  });

  // Set up init script BEFORE navigation (runs on every page load)
  await page.addInitScript(
    (data) => {
      // Enable E2E test mode bypass
      window.__E2E_TEST_MODE = true;
      window.__E2E_TEST_USER = data.user;
      window.__E2E_TEST_WALLET = {
        address: data.user.walletAddress,
        chainId: 'eip155:1',
      };

      // Set OAuth3 token getter for API calls (matches packages/api/src/fetch.ts pattern)
      window.__oauth3GetAccessToken = async () => data.token;

      // Mock OAuth3 localStorage state to simulate authenticated session
      const oauth3State = {
        'oauth3:session': JSON.stringify({
          identityId: data.user.id,
          smartAccount: data.user.walletAddress,
          expiresAt: Date.now() + 3600000,
        }),
        'oauth3:user': JSON.stringify({
          id: data.user.id,
          walletAddress: data.user.walletAddress,
          email: data.user.email,
          createdAt: Date.now(),
        }),
      };

      // Set each key in localStorage
      Object.entries(oauth3State).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    },
    { user: TEST_USER, token: MOCK_ACCESS_TOKEN }
  );

  // Set cookies (oauth3-token matches packages/api/src/auth-middleware.ts)
  await page.context().addCookies([
    {
      name: 'oauth3-token',
      value: MOCK_ACCESS_TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  // If navigateToUrl is provided, navigate and then inject test mode flags
  if (navigateToUrl) {
    await page.goto(navigateToUrl);

    // Inject test mode flags directly after page load
    await page.evaluate(
      (data) => {
        window.__E2E_TEST_MODE = true;
        window.__E2E_TEST_USER = data.user;
        window.__E2E_TEST_WALLET = {
          address: data.user.walletAddress,
          chainId: 'eip155:1',
        };
        window.__oauth3GetAccessToken = async () => data.token;
      },
      { user: TEST_USER, token: MOCK_ACCESS_TOKEN }
    );

    // Force a re-render by dispatching a storage event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('storage'));
    });
  }
}

/**
 * Extended Playwright test with authenticated context
 */
type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    await setupAuthState(page);
    await use(page);
  },
});

export { expect };
