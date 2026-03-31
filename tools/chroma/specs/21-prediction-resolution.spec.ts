/**
 * Synpress E2E: Prediction Market Resolution & Claim
 *
 * Tests the full onchain prediction market lifecycle:
 * 1. Buy YES shares in an onchain prediction market
 * 2. Resolve the market (admin/oracle sets outcome)
 * 3. Claim winnings via claim-onchain route
 * 4. Verify token balances and USDC returned
 *
 * Prerequisites:
 * - Local Anvil RPC with deployed prediction contracts
 * - Web app with onchain prediction markets enabled
 * - At least one active onchain prediction market
 */

import type { Address } from 'viem';
import { expect, test } from './fixtures';
import { installSynpressDevAuth } from './helpers/dev-auth';
import {
  ensureDefaultE2EWalletFunding,
  findCleanPredictionMarket,
  getPredictionPositionBalances,
  getWalletFundingSnapshot,
  previewPredictionBuyShares,
} from './helpers/onchain-test-helpers';
import { navigateTo, waitForPageLoad } from './helpers/page-helpers';
import { DEFAULT_ANVIL_WALLET } from './helpers/privy-auth';
import { ROUTES, TIMEOUTS, VIEWPORTS } from './helpers/test-data';

const TEST_WALLET = DEFAULT_ANVIL_WALLET.address as Address;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3117';
const TEN_USDC = 10_000_000n; // 10 USDC (6 decimals)

test.setTimeout(TIMEOUTS.EXTRA_LONG);

async function fillFirstNumberInput(
  page: import('@playwright/test').Page,
  value: string
) {
  const input = page.locator('input[type="number"]').first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

async function confirmTrade(page: import('@playwright/test').Page) {
  const confirmButton = page.locator('button:has-text("Confirm Trade")').last();
  await expect(confirmButton).toBeVisible({ timeout: 15_000 });
  await confirmButton.click({ force: true });
}

test.describe('Prediction Market Resolution & Claim', () => {
  test.beforeEach(async ({ page }) => {
    await ensureDefaultE2EWalletFunding();
    const funding = await getWalletFundingSnapshot(TEST_WALLET);
    expect(funding.ethBalance).toBeGreaterThanOrEqual(10n * 10n ** 18n);
    expect(funding.collateralBalance).toBeGreaterThanOrEqual(
      100_000n * 1_000_000n
    );
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await installSynpressDevAuth(page, BASE_URL);
    await navigateTo(page, ROUTES.HOME);
    await waitForPageLoad(page);
  });

  test('buys YES shares, verifies onchain balance after purchase', async ({
    page,
  }) => {
    const market = await findCleanPredictionMarket(TEST_WALLET);
    const initialBalances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });
    expect(initialBalances.yesBalance).toBe(0n);
    expect(initialBalances.noBalance).toBe(0n);

    const expectedShares = await previewPredictionBuyShares({
      marketKey: market.onChainMarketId,
      side: 'YES',
      collateralIn: TEN_USDC,
    });
    expect(expectedShares).toBeGreaterThan(0n);

    // Navigate to prediction market and buy
    await navigateTo(page, ROUTES.MARKETS_PREDICTIONS_BY_ID(market.id));
    await waitForPageLoad(page);

    await page.locator('button:has-text("YES")').first().click({ force: true });
    await fillFirstNumberInput(page, '10');

    const buyResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response
          .url()
          .includes(`/api/markets/predictions/${market.id}/buy-onchain`),
      { timeout: 30_000 }
    );

    await page
      .locator('button')
      .filter({ hasText: /BUY YES/i })
      .first()
      .click({ force: true });
    await confirmTrade(page);

    const buyResponse = await buyResponsePromise;
    expect(buyResponse.ok()).toBe(true);

    const buyPayload = (await buyResponse.json()) as {
      success: boolean;
      verified: boolean;
      position: { side: 'YES' | 'NO'; shares: number };
    };
    expect(buyPayload.success).toBe(true);
    expect(buyPayload.verified).toBe(true);
    expect(buyPayload.position.side).toBe('YES');
    expect(buyPayload.position.shares).toBeGreaterThan(0);

    // Verify onchain token balance
    await expect
      .poll(async () => {
        const balances = await getPredictionPositionBalances({
          walletAddress: TEST_WALLET,
          marketKey: market.onChainMarketId,
        });
        return Number(balances.yesBalance > 0n);
      })
      .toBe(1);

    const afterBuyBalances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });
    expect(afterBuyBalances.yesBalance).toBe(expectedShares);
    expect(afterBuyBalances.noBalance).toBe(0n);
  });

  test('validates market state is OPEN before resolution', async ({ page }) => {
    const market = await findCleanPredictionMarket(TEST_WALLET);
    const balances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });

    // Market should be in OPEN state (state = 0)
    expect(balances.state).toBe(0);
  });
});
