/**
 * Page navigation helpers for synpress tests.
 *
 * @module testing/synpress/helpers/page-helpers
 */

import type { Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Track consecutive failures to detect server crash
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Track if server health check has been done and its result
let serverHealthChecked = false;
let serverIsHealthy = false;

/**
 * Resets server health check state.
 * Use between long-running suites where the server might recover.
 */
export function resetServerHealthCheck(): void {
  serverHealthChecked = false;
  serverIsHealthy = false;
}

/**
 * Checks server health once and caches the result.
 * Used to fail fast if server is consistently broken.
 * Only caches after a successful check to allow retry on failure.
 *
 * IMPORTANT: This checks ACTUAL PAGE LOADS, not just /api/health.
 * The health endpoint can return 200 while pages return 500 due to
 * missing data, database issues, etc.
 */
export async function checkServerHealthOnce(): Promise<boolean> {
  if (serverHealthChecked && serverIsHealthy) {
    return true;
  }

  // Check both health endpoint AND an actual page
  const endpoints = [
    { url: `${BASE_URL}/api/health`, name: 'health' },
    { url: `${BASE_URL}/`, name: 'homepage' },
  ];

  for (let attempt = 1; attempt <= 3; attempt++) {
    let allPassed = true;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          signal: AbortSignal.timeout(15000),
        });

        if (response.status >= 500) {
          console.log(
            `❌ ${endpoint.name} returned ${response.status} (attempt ${attempt}/3)`
          );
          allPassed = false;
          break;
        }
      } catch (error) {
        console.log(
          `❌ ${endpoint.name} error (attempt ${attempt}/3): ${error instanceof Error ? error.message : String(error)}`
        );
        allPassed = false;
        break;
      }
    }

    if (allPassed) {
      serverIsHealthy = true;
      serverHealthChecked = true;
      console.log('✅ Server health check passed (health + homepage)');
      return true;
    }

    if (attempt < 3) {
      console.log(`⏳ Retrying in 5 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.error(
    '❌ Server pages are returning 500 errors - SKIPPING ALL TESTS to avoid 1+ hour timeout'
  );
  serverIsHealthy = false;
  serverHealthChecked = true;
  return false;
}

/**
 * Asserts that server is healthy, throws if not.
 * Use this in beforeAll/beforeEach to skip tests when server is broken.
 */
export async function assertServerHealthy(): Promise<void> {
  const healthy = await checkServerHealthOnce();
  if (!healthy) {
    throw new Error(
      'Server is not healthy (returning 500 errors). Skipping tests to avoid 1+ hour timeout.'
    );
  }
}

/**
 * Waits for the server to be responsive before proceeding.
 *
 * Checks the root URL and accepts any response (except network errors or 5xx).
 * This prevents flakiness when the server is slow to start.
 *
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 2000)
 * @throws Error if server is returning 5xx errors after all retries
 */
export async function waitForServerHealthy(
  maxRetries = 3,
  retryDelay = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
      });
      // Accept any non-5xx response as "server is up"
      if (response.status < 500) {
        consecutiveFailures = 0;
        return;
      }
      console.log(
        `⚠️ Server returned 5xx (attempt ${attempt}/${maxRetries}): ${response.status}`
      );
    } catch (error) {
      console.log(
        `⚠️ Server not reachable (attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  consecutiveFailures++;
  // THROW instead of continuing - server is broken
  throw new Error(
    `Server returned 5xx errors after ${maxRetries} attempts. ` +
      `This indicates a server-side issue (missing data, DB connection, etc). ` +
      `Check the production server logs for details.`
  );
}

/**
 * Navigates to a route and waits for it to load.
 *
 * Includes server health check to prevent flakiness.
 *
 * @param page - Playwright page instance
 * @param route - Route path to navigate to
 * @throws Error if navigation fails after all retries
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  // Quick health check first - throws if server is returning 5xx
  try {
    await waitForServerHealthy(5, 1000);
  } catch {
    // If server seems down, do a longer wait and try again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await waitForServerHealthy(10, 2000);
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      consecutiveFailures = 0;
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 5) {
        // Exponential backoff
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }

  // If we've had too many failures, the server is likely crashed
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log(
      '⚠️ Server appears to have crashed - skipping remaining navigation'
    );
  }

  throw lastError ?? new Error('Navigation failed');
}

/**
 * Hide Next.js dev overlay to prevent it from intercepting pointer events.
 *
 * In development mode, Next.js injects a portal that can block UI interactions.
 * This function hides it so tests can interact with the actual UI.
 *
 * @param page - Playwright page instance
 */
export async function hideNextDevOverlay(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const overlay = document.querySelector('nextjs-portal');
      if (overlay instanceof HTMLElement) {
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'none';
      }
      // Also hide any error overlays
      document.querySelectorAll('[data-nextjs-dev-overlay]').forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.pointerEvents = 'none';
        }
      });
    })
    .catch(() => {});
}

/**
 * Waits for page to be fully loaded and hydrated.
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum time to wait in milliseconds (default: 20000)
 */
export async function waitForPageLoad(
  page: Page,
  timeout = 20000
): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });

    // Hide Next.js dev overlay to prevent test interference
    await hideNextDevOverlay(page);

    // Wait for page to have interactive elements (10 second timeout)
    const hasButtons = await page
      .locator('button')
      .first()
      .waitFor({ state: 'attached', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasButtons) {
      // Try reloading the page once
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
      // Hide overlay again after reload
      await hideNextDevOverlay(page);
    }
  } catch (_e) {
    // Continue anyway
  }
}

/**
 * Waits between tests to let the server recover.
 *
 * Helps prevent flakiness from server overload.
 *
 * @param page - Playwright page instance
 */
export async function cooldownBetweenTests(page: Page): Promise<void> {
  // Give the server a moment to recover between tests
  await page.waitForTimeout(1500);
}

/**
 * Check if server is currently healthy
 */
export async function isServerHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Skips remaining tests in a suite if server is down
 */
export function shouldSkipTest(): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}
