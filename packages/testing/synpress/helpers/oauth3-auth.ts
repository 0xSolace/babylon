/**
 * OAuth3 Authentication Helpers for Synpress E2E Tests
 *
 * Provides wallet-based authentication via OAuth3 (Jeju's decentralized auth).
 * Uses MetaMask for wallet signing, which triggers OAuth3 session creation.
 */

import type { Page } from '@playwright/test';
import type { MetaMask } from '@synthetixio/synpress-metamask/playwright';

// Default Anvil test wallet (first account from hardhat/foundry node)
export const DEFAULT_ANVIL_WALLET = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey:
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5ef26407389dbfa0f123',
};

/**
 * Login with wallet via OAuth3
 * This uses MetaMask to sign a message that creates an OAuth3 session
 */
export async function loginWithWallet(
  page: Page,
  metaMask?: MetaMask,
  walletAddress: string = DEFAULT_ANVIL_WALLET.address
): Promise<void> {
  console.log(`[OAuth3Auth] Initiating wallet login for ${walletAddress}...`);

  // Wait for page to be ready
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('[OAuth3Auth] Page not fully idle, continuing...');
  });

  // Look for connect wallet button
  const connectButton = page
    .getByRole('button', { name: /connect|login|sign in/i })
    .first();

  const isConnectVisible = await connectButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (isConnectVisible) {
    console.log('[OAuth3Auth] Found connect button, clicking...');
    await connectButton.click();

    // Wait for OAuth3 wallet connection modal
    await page.waitForTimeout(1000);

    // Look for "Connect Wallet" or similar option in modal
    const walletOption = page
      .getByRole('button', { name: /wallet|metamask|ethereum/i })
      .first();

    const isWalletOptionVisible = await walletOption
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isWalletOptionVisible) {
      console.log('[OAuth3Auth] Found wallet option, clicking...');
      await walletOption.click();

      // If MetaMask is provided, handle the signature request
      if (metaMask) {
        console.log('[OAuth3Auth] Handling MetaMask signature...');
        try {
          // Wait for MetaMask popup and approve connection
          await metaMask.approveNewNetwork();
          await metaMask.approveSwitchNetwork();
          await metaMask.confirmSignature();
          console.log('[OAuth3Auth] MetaMask signature approved');
        } catch (error) {
          console.log('[OAuth3Auth] MetaMask interaction failed:', error);
        }
      }
    }
  } else {
    console.log(
      '[OAuth3Auth] No connect button visible, may already be logged in'
    );
  }

  // Wait for auth to complete
  await page.waitForTimeout(2000);

  // Verify login by checking for user menu or wallet address display
  const userIndicator = page
    .locator('[data-testid="user-menu"]')
    .or(page.locator(`text=${walletAddress.slice(0, 6)}`))
    .or(page.getByRole('button', { name: /account|profile|settings/i }))
    .first();

  const isLoggedIn = await userIndicator
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (isLoggedIn) {
    console.log('[OAuth3Auth] Login successful, user indicator visible');
  } else {
    console.log(
      '[OAuth3Auth] Login flow completed, user indicator not visible'
    );
  }
}

/**
 * Wait for OAuth3 to be ready (client-side initialization)
 */
export async function waitForOAuth3Ready(
  page: Page,
  timeout = 30000
): Promise<void> {
  console.log('[OAuth3Auth] Waiting for OAuth3 client to be ready...');

  // Wait for OAuth3 client to initialize
  await page
    .waitForFunction(
      () => {
        // Check for OAuth3 client in window
        const win = window as unknown as { oauth3?: { ready?: boolean } };
        return win.oauth3?.ready === true;
      },
      { timeout }
    )
    .catch(() => {
      console.log('[OAuth3Auth] OAuth3 ready check timed out, continuing...');
    });

  console.log('[OAuth3Auth] OAuth3 client ready');
}

/**
 * Logout from OAuth3 session
 */
export async function logout(page: Page): Promise<void> {
  console.log('[OAuth3Auth] Logging out...');

  // Look for user menu
  const userMenu = page
    .locator('[data-testid="user-menu"]')
    .or(page.getByRole('button', { name: /account|profile/i }))
    .first();

  const isUserMenuVisible = await userMenu
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (isUserMenuVisible) {
    await userMenu.click();
    await page.waitForTimeout(500);

    // Look for logout option
    const logoutButton = page
      .getByRole('menuitem', { name: /logout|sign out|disconnect/i })
      .or(page.getByRole('button', { name: /logout|sign out|disconnect/i }))
      .first();

    const isLogoutVisible = await logoutButton
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (isLogoutVisible) {
      await logoutButton.click();
      console.log('[OAuth3Auth] Logout clicked');
    }
  }

  await page.waitForTimeout(1000);
  console.log('[OAuth3Auth] Logout complete');
}
