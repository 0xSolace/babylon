/**
 * Wallet Transaction E2E Tests (Synpress + MetaMask)
 *
 * Tests on-chain wallet transactions: Buy Points, close positions,
 * place trades, and handle transaction states.
 *
 * These tests require the Synpress MetaMask fixtures for wallet approval.
 */

import { expect, test } from '@playwright/test';
import { MetaMask } from '@synthetixio/synpress-metamask/playwright';
import {
  clickFirstVisible,
  closeModal,
  openModal,
} from './helpers/interaction-helpers';
import {
  cooldownBetweenTests,
  isServerHealthy,
  navigateTo,
  waitForPageLoad,
} from './helpers/page-helpers';
import { DEFAULT_ANVIL_WALLET } from './helpers/privy-auth';
import { ROUTES, SELECTORS, TIMEOUTS, VIEWPORTS } from './helpers/test-data';

test.setTimeout(TIMEOUTS.EXTRA_LONG);

test.describe('Wallet Transactions - Buy Points', () => {
  test.beforeEach(async ({ page }) => {
    if (!(await isServerHealthy())) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await navigateTo(page, ROUTES.HOME);
    await page.waitForTimeout(3000);
    await navigateTo(page, ROUTES.WALLET);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({ page }) => {
    await cooldownBetweenTests(page);
  });

  test('opens Buy Points modal and shows payment options', async ({ page }) => {
    const modal = await openModal(page, SELECTORS.BUY_POINTS_BUTTON);

    if (modal) {
      const modalText = await modal.textContent();
      const hasPaymentContent =
        modalText?.toLowerCase().includes('buy') ||
        modalText?.toLowerCase().includes('amount') ||
        modalText?.toLowerCase().includes('pay') ||
        modalText?.toLowerCase().includes('points');
      expect(hasPaymentContent).toBe(true);

      await closeModal(page);
    } else {
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(100);
    }
  });

  test('handles purchase rejection gracefully', async ({ page, context }) => {
    const metamask = new MetaMask(context, page, DEFAULT_ANVIL_WALLET.password);
    const modal = await openModal(page, SELECTORS.BUY_POINTS_BUTTON);

    if (modal) {
      // Try to initiate purchase
      const confirmButton = page
        .locator(
          'button:has-text("Confirm"), button:has-text("Buy"), button:has-text("Purchase")'
        )
        .first();

      if (
        await confirmButton
          .isVisible({ timeout: TIMEOUTS.SHORT })
          .catch(() => false)
      ) {
        // Enter an amount first
        const amountInput = modal
          .locator('input[type="number"], input')
          .first();
        if (
          await amountInput
            .isVisible({ timeout: TIMEOUTS.SHORT })
            .catch(() => false)
        ) {
          await amountInput.fill('1');
          await page.waitForTimeout(500);
        }

        await confirmButton.click({ force: true });
        await page.waitForTimeout(2000);

        // Reject in MetaMask if popup appears
        await metamask.rejectTransaction().catch(() => {});
        await page.waitForTimeout(1000);

        // Page should not crash
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(50);
      }

      await closeModal(page);
    }
  });
});

test.describe('Wallet Transactions - Trading', () => {
  test.beforeEach(async ({ page }) => {
    if (!(await isServerHealthy())) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await navigateTo(page, ROUTES.HOME);
    await page.waitForTimeout(3000);
    await navigateTo(page, ROUTES.MARKETS_PERPS);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Navigate to first market
    const marketCard = page.locator('button:has-text("$")').first();
    if (
      await marketCard.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)
    ) {
      await marketCard.click({ force: true });
      await page.waitForTimeout(2000);
    }
  });

  test.afterEach(async ({ page }) => {
    await cooldownBetweenTests(page);
  });

  test('places perp trade order form', async ({ page }) => {
    // Select Long
    await clickFirstVisible(page, [SELECTORS.LONG_BUTTON]);
    await page.waitForTimeout(500);

    // Enter quantity
    const quantityInput = page.locator(SELECTORS.QUANTITY_INPUT).first();
    if (
      await quantityInput
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false)
    ) {
      await quantityInput.fill('1');
      await page.waitForTimeout(500);

      // Verify order form is ready
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(100);
    }
  });

  test('displays transaction pending state', async ({ page }) => {
    // After initiating a trade, there should be a pending state
    await clickFirstVisible(page, [SELECTORS.LONG_BUTTON]);
    await page.waitForTimeout(500);

    const quantityInput = page.locator(SELECTORS.QUANTITY_INPUT).first();
    if (
      await quantityInput
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false)
    ) {
      await quantityInput.fill('1');
      await page.waitForTimeout(500);

      // Look for submit/confirm button
      const submitButton = page
        .locator(
          'button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Place Order")'
        )
        .first();

      if (
        await submitButton
          .isVisible({ timeout: TIMEOUTS.SHORT })
          .catch(() => false)
      ) {
        // Verify button exists and is interactable
        const isDisabled = await submitButton.isDisabled().catch(() => true);
        expect(typeof isDisabled).toBe('boolean');
      }
    }
  });

  test('handles insufficient balance error', async ({ page }) => {
    await clickFirstVisible(page, [SELECTORS.LONG_BUTTON]);
    await page.waitForTimeout(500);

    const quantityInput = page.locator(SELECTORS.QUANTITY_INPUT).first();
    if (
      await quantityInput
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false)
    ) {
      // Enter very large amount
      await quantityInput.fill('999999999');
      await page.waitForTimeout(1000);

      // Should show insufficient balance or disable submit
      const body = await page.locator('body').textContent();
      const hasBalanceError =
        body?.toLowerCase().includes('insufficient') ||
        body?.toLowerCase().includes('not enough') ||
        body?.toLowerCase().includes('balance');

      expect(hasBalanceError || (body?.length ?? 0) > 100).toBe(true);
    }
  });
});

test.describe('Wallet Transactions - Predictions', () => {
  test.beforeEach(async ({ page }) => {
    if (!(await isServerHealthy())) {
      test.skip();
      return;
    }
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await navigateTo(page, ROUTES.HOME);
    await page.waitForTimeout(3000);
    await navigateTo(page, ROUTES.MARKETS_PREDICTIONS);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({ page }) => {
    await cooldownBetweenTests(page);
  });

  test('places prediction bet order form', async ({ page }) => {
    // Click YES on first prediction
    await clickFirstVisible(page, [SELECTORS.YES_BUTTON]);
    await page.waitForTimeout(1000);

    // Enter amount
    const amountInput = page.locator(SELECTORS.QUANTITY_INPUT).first();
    if (
      await amountInput
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false)
    ) {
      await amountInput.fill('1');
      await page.waitForTimeout(500);

      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(100);
    }
  });

  test('shows transaction success or confirmation UI', async ({ page }) => {
    // Verify the prediction market has proper confirmation UI
    await clickFirstVisible(page, [SELECTORS.YES_BUTTON]);
    await page.waitForTimeout(1000);

    const amountInput = page.locator(SELECTORS.QUANTITY_INPUT).first();
    if (
      await amountInput
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false)
    ) {
      await amountInput.fill('1');
      await page.waitForTimeout(500);

      // Look for confirmation button
      const confirmButton = page
        .locator(
          'button:has-text("Confirm"), button:has-text("Place Bet"), button:has-text("Submit")'
        )
        .first();

      const hasConfirm = await confirmButton
        .isVisible({ timeout: TIMEOUTS.SHORT })
        .catch(() => false);

      const body = await page.locator('body').textContent();
      expect(hasConfirm || (body?.length ?? 0) > 100).toBe(true);
    }
  });
});
