/**
 * OAuth3 Authentication Helper for Synpress E2E Tests
 *
 * Provides utilities for authenticating with OAuth3 test accounts
 * Migrated from Privy to Jeju's decentralized OAuth3 authentication.
 */

import { type Page } from '@playwright/test';

export interface OAuth3TestAccount {
  email: string;
  otp: string;
}

/**
 * Get OAuth3 test account credentials from environment variables
 */
export function getOAuth3TestAccount(): OAuth3TestAccount {
  const email = process.env.OAUTH3_TEST_EMAIL || process.env.PRIVY_TEST_EMAIL;
  const otp = process.env.OAUTH3_TEST_OTP || process.env.PRIVY_TEST_OTP;

  if (!email || !otp) {
    throw new Error(
      'OAuth3 test credentials not configured. Please set OAUTH3_TEST_EMAIL and OAUTH3_TEST_OTP environment variables.'
    );
  }

  return { email, otp };
}

/**
 * @deprecated Use getOAuth3TestAccount instead
 */
export function getPrivyTestAccount(): OAuth3TestAccount {
  return getOAuth3TestAccount();
}

/**
 * Login to the app using OAuth3 email authentication
 */
export async function loginWithOAuth3Email(
  page: Page,
  testAccount: OAuth3TestAccount = getOAuth3TestAccount()
): Promise<void> {
  console.log('🔐 Starting OAuth3 email login...');

  // Navigate to home page
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Click login button - look for various possible selectors
  const loginSelectors = [
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button:has-text("Connect")',
    '[data-testid="login-button"]',
    '[data-testid="connect-button"]',
  ];

  let loginButton = null;
  for (const selector of loginSelectors) {
    loginButton = page.locator(selector).first();
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      break;
    }
  }

  if (loginButton && (await loginButton.isVisible().catch(() => false))) {
    await loginButton.click();
    console.log('✅ Clicked login button');
  } else {
    console.log(
      'ℹ️ No login button found - may already be logged in or on a public page'
    );
  }

  // Wait for auth modal to appear
  await page
    .waitForSelector('[data-auth-modal], [data-testid="auth-modal"]', {
      timeout: 10000,
    })
    .catch(() => {
      console.log(
        '⚠️ Auth modal did not appear - checking if already authenticated'
      );
    });

  // Look for email input in modal
  const emailInput = page
    .locator('input[type="email"], input[placeholder*="email" i]')
    .first();

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Enter email
    await emailInput.fill(testAccount.email);
    console.log(`✅ Entered test email: ${testAccount.email}`);

    // Click continue/submit button
    const continueButton = page
      .locator(
        'button:has-text("Continue"), button:has-text("Submit"), button[type="submit"]'
      )
      .first();
    await continueButton.click();
    console.log('✅ Clicked continue');

    // Wait for OTP input
    await page.waitForSelector(
      'input[type="text"], input[placeholder*="code" i], input[placeholder*="otp" i]',
      { timeout: 10000 }
    );

    // Enter OTP
    const otpInput = page
      .locator(
        'input[type="text"], input[placeholder*="code" i], input[placeholder*="otp" i]'
      )
      .first();
    await otpInput.fill(testAccount.otp);
    console.log(`✅ Entered OTP: ${testAccount.otp}`);

    // Click submit/verify button
    const submitButton = page
      .locator(
        'button:has-text("Submit"), button:has-text("Verify"), button:has-text("Continue"), button[type="submit"]'
      )
      .first();
    await submitButton.click();
    console.log('✅ Clicked submit');

    // Wait for authentication to complete
    await page.waitForTimeout(3000);

    // Check if we need to create wallet
    const createWalletButton = page
      .locator('button:has-text("Create wallet"), button:has-text("Continue")')
      .first();
    if (
      await createWalletButton.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await createWalletButton.click();
      console.log('✅ Created smart wallet');
      await page.waitForTimeout(2000);
    }

    console.log('✅ OAuth3 email login successful');
  } else {
    console.log('ℹ️ Email input not found - may already be authenticated');
  }

  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
}

/**
 * @deprecated Use loginWithOAuth3Email instead
 */
export async function loginWithPrivyEmail(
  page: Page,
  testAccount?: OAuth3TestAccount
): Promise<void> {
  await loginWithOAuth3Email(page, testAccount);
}

/**
 * Setup OAuth3 auth (alias for loginWithOAuth3Email)
 */
export async function setupOAuth3Auth(page: Page): Promise<void> {
  await loginWithOAuth3Email(page);
}

/**
 * @deprecated Use setupOAuth3Auth instead
 */
export async function setupPrivyAuth(page: Page): Promise<void> {
  await setupOAuth3Auth(page);
}

/**
 * Check if OAuth3 auth is working
 */
export async function checkOAuth3Auth(page: Page): Promise<boolean> {
  return await isAuthenticated(page);
}

/**
 * @deprecated Use checkOAuth3Auth instead
 */
export async function checkPrivyAuth(page: Page): Promise<boolean> {
  return await checkOAuth3Auth(page);
}

/**
 * Login to the app using wallet connection
 */
export async function loginWithWallet(
  page: Page,
  metamask: {
    connectToDapp: () => Promise<void>;
    confirmSignature: () => Promise<void>;
  }
): Promise<void> {
  console.log('🔐 Starting wallet login...');

  // Navigate to home page
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Click login button
  const loginSelectors = [
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button:has-text("Connect")',
    '[data-testid="login-button"]',
    '[data-testid="connect-button"]',
  ];

  let loginButton = null;
  for (const selector of loginSelectors) {
    loginButton = page.locator(selector).first();
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      break;
    }
  }

  if (loginButton && (await loginButton.isVisible().catch(() => false))) {
    await loginButton.click();
    console.log('✅ Clicked login button');
  }

  // Wait for auth modal
  await page.waitForSelector('[data-auth-modal], [data-testid="auth-modal"]', {
    timeout: 10000,
  });

  // Click wallet option
  const walletButton = page
    .locator('button:has-text("Wallet"), button:has-text("MetaMask")')
    .first();
  await walletButton.click();
  console.log('✅ Selected wallet login');

  // Wait for MetaMask connection popup
  await page.waitForTimeout(2000);

  // Connect MetaMask
  await metamask.connectToDapp();
  console.log('✅ Connected MetaMask');

  // Sign message if prompted
  await metamask.confirmSignature();
  console.log('✅ Signed authentication message');

  // Wait for authentication to complete
  await page.waitForLoadState('networkidle');

  console.log('✅ Wallet login successful');
}

/**
 * @deprecated Use loginWithWallet instead
 */
export async function loginWithPrivyWallet(
  page: Page,
  metamask: {
    connectToDapp: () => Promise<void>;
    confirmSignature: () => Promise<void>;
  }
): Promise<void> {
  await loginWithWallet(page, metamask);
}

/**
 * Logout from the app
 */
export async function logout(page: Page): Promise<void> {
  console.log('🔓 Logging out...');

  // Look for logout/disconnect button
  const logoutSelectors = [
    'button:has-text("Logout")',
    'button:has-text("Sign out")',
    'button:has-text("Disconnect")',
    '[data-testid="logout-button"]',
    '[data-testid="disconnect-button"]',
  ];

  for (const selector of logoutSelectors) {
    const logoutButton = page.locator(selector).first();
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click();
      console.log('✅ Clicked logout button');
      await page.waitForTimeout(2000);
      return;
    }
  }

  // If no direct logout button, look for profile menu
  const profileMenuSelectors = [
    '[data-testid="profile-menu"]',
    'button[aria-label*="profile" i]',
    'button[aria-label*="account" i]',
    '[data-testid="user-menu"]',
  ];

  for (const selector of profileMenuSelectors) {
    const menuButton = page.locator(selector).first();
    if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuButton.click();
      console.log('✅ Opened profile menu');
      await page.waitForTimeout(1000);

      // Look for logout in menu
      for (const logoutSelector of logoutSelectors) {
        const logoutButton = page.locator(logoutSelector).first();
        if (
          await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await logoutButton.click();
          console.log('✅ Clicked logout from menu');
          await page.waitForTimeout(2000);
          return;
        }
      }
    }
  }

  console.log('⚠️ Logout button not found');
}

/**
 * @deprecated Use logout instead
 */
export async function logoutFromPrivy(page: Page): Promise<void> {
  await logout(page);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Look for indicators of authentication
  const authenticatedIndicators = [
    '[data-testid="user-profile"]',
    '[data-testid="user-menu"]',
    'button:has-text("Logout")',
    'button:has-text("Sign out")',
    '[data-authenticated="true"]',
  ];

  for (const selector of authenticatedIndicators) {
    if (
      await page
        .locator(selector)
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Wait for authentication to complete
 */
export async function waitForAuthentication(
  page: Page,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isAuthenticated(page)) {
      console.log('✅ Authentication confirmed');
      return;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(
    'Authentication timeout: User not authenticated after ' + timeout + 'ms'
  );
}
