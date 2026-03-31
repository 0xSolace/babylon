import type { Address, Hex } from 'viem';
import type { Page } from './fixtures';
import { expect, test } from './fixtures';
import { installSynpressDevAuth } from './helpers/dev-auth';
import {
  ensureDefaultE2EWalletFunding,
  findCleanPerpMarket,
  findCleanPredictionMarket,
  getPerpFreeCollateral,
  getPerpPosition,
  getPredictionPositionBalances,
  settlePerpOrder,
  waitForToastText,
} from './helpers/onchain-test-helpers';
import { navigateTo, waitForPageLoad } from './helpers/page-helpers';
import { DEFAULT_ANVIL_WALLET } from './helpers/privy-auth';
import { ROUTES, TIMEOUTS, VIEWPORTS } from './helpers/test-data';

const TEST_WALLET = DEFAULT_ANVIL_WALLET.address as Address;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.setTimeout(TIMEOUTS.EXTRA_LONG);

async function confirmTrade(page: Page) {
  const confirmButton = page.locator('button:has-text("Confirm Trade")').last();
  await expect(confirmButton).toBeVisible({ timeout: 15_000 });
  await confirmButton.click({ force: true });
}

async function fillFirstNumberInput(page: Page, value: string) {
  const input = page.locator('input[type="number"]').first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

test.describe('Wallet Transactions - Onchain Trading', () => {
  test.beforeEach(async ({ page }) => {
    await ensureDefaultE2EWalletFunding();
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await installSynpressDevAuth(page, BASE_URL);
    await navigateTo(page, ROUTES.HOME);
    await waitForPageLoad(page);
  });

  test('buys and sells a perp position and validates the onchain position lifecycle', async ({
    page,
  }) => {
    const market = await findCleanPerpMarket(TEST_WALLET);
    const initialFreeCollateral = await getPerpFreeCollateral(TEST_WALLET);
    expect(initialFreeCollateral).toBeGreaterThanOrEqual(0n);
    expect(
      await getPerpPosition(TEST_WALLET, market.organizationId)
    ).toBeNull();

    await navigateTo(page, ROUTES.MARKETS_PERPS_BY_TICKER(market.ticker));
    await waitForPageLoad(page);

    await page
      .locator('button:has-text("Long")')
      .first()
      .click({ force: true });
    await fillFirstNumberInput(page, '1000');

    const openResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/markets/perps/open'),
      { timeout: 30_000 }
    );

    await page
      .locator('button')
      .filter({ hasText: /PLACE LONG ORDER|ADD TO POSITION|FLIP POSITION/i })
      .first()
      .click({ force: true });
    await confirmTrade(page);

    const openResponse = await openResponsePromise;
    expect(openResponse.ok()).toBe(true);
    const openPayload = (await openResponse.json()) as {
      settlementMode: 'onchain';
      order: { id: Hex; marketId: Hex; status: string };
      position: { ticker: string; side: 'long' | 'short' };
    };
    expect(openPayload.settlementMode).toBe('onchain');
    expect(openPayload.order.status).toBe('queued');
    expect(openPayload.position.ticker).toBe(market.ticker);
    expect(openPayload.position.side).toBe('long');

    await settlePerpOrder({
      marketId: openPayload.order.marketId,
      orderId: openPayload.order.id,
    });

    await expect
      .poll(async () => {
        const position = await getPerpPosition(
          TEST_WALLET,
          market.organizationId
        );
        return position ? Number(position.size > 0n) : 0;
      })
      .toBe(1);

    const openedPosition = await getPerpPosition(
      TEST_WALLET,
      market.organizationId
    );
    expect(openedPosition).not.toBeNull();
    expect(openedPosition?.side).toBe(0);
    expect(openedPosition?.size ?? 0n).toBeGreaterThan(0n);
    expect(openedPosition?.collateral ?? 0n).toBeGreaterThan(0n);

    await navigateTo(page, ROUTES.WALLET_POSITIONS);
    await waitForPageLoad(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const perpRow = page
      .locator(`div:has-text("${market.ticker}")`)
      .filter({ has: page.locator('button:has-text("Close")') })
      .first();
    await expect(perpRow).toBeVisible({ timeout: 20_000 });

    const closeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/markets\/perps\/position\/.+\/close$/.test(response.url()),
      { timeout: 30_000 }
    );

    await perpRow.locator('button:has-text("Close")').click({ force: true });
    await confirmTrade(page);

    const closeResponse = await closeResponsePromise;
    expect(closeResponse.ok()).toBe(true);
    const closePayload = (await closeResponse.json()) as {
      settlementMode: 'onchain';
      order: { id: Hex; marketId: Hex; status: string };
      position: { id: string; ticker: string };
      pnl: number;
    };
    expect(closePayload.settlementMode).toBe('onchain');
    expect(closePayload.order.status).toBe('queued');
    expect(closePayload.position.ticker).toBe(market.ticker);

    await settlePerpOrder({
      marketId: closePayload.order.marketId,
      orderId: closePayload.order.id,
    });

    await expect
      .poll(async () => {
        const position = await getPerpPosition(
          TEST_WALLET,
          market.organizationId
        );
        return position ? Number(position.size > 0n) : 0;
      })
      .toBe(0);

    const settledFreeCollateral = await getPerpFreeCollateral(TEST_WALLET);
    expect(settledFreeCollateral).toBeGreaterThan(0n);

    await navigateTo(page, ROUTES.WALLET_POSITIONS);
    await waitForPageLoad(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    await expect(
      page
        .locator(`div:has-text("${market.ticker}")`)
        .filter({ has: page.locator('button:has-text("Close")') })
        .first()
    ).toBeHidden({ timeout: 20_000 });
  });

  test('buys and switches a prediction position and validates the onchain token balances', async ({
    page,
  }) => {
    const market = await findCleanPredictionMarket(TEST_WALLET);
    const initialBalances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });

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

    await waitForToastText(page, /Bought YES shares|verified on-chain/i);

    await expect
      .poll(async () => {
        const balances = await getPredictionPositionBalances({
          walletAddress: TEST_WALLET,
          marketKey: market.onChainMarketId,
        });
        return Number(balances.yesBalance > initialBalances.yesBalance);
      })
      .toBe(1);

    const afterBuyBalances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });
    expect(afterBuyBalances.yesBalance).toBeGreaterThan(
      initialBalances.yesBalance
    );
    expect(afterBuyBalances.noBalance).toBe(initialBalances.noBalance);

    await navigateTo(page, ROUTES.WALLET_POSITIONS);
    await waitForPageLoad(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const questionSnippet = market.question.slice(0, 40);
    const predictionRow = page
      .locator(`div:has-text("${questionSnippet}")`)
      .filter({ has: page.locator('button:has-text("Switch")') })
      .first();
    await expect(predictionRow).toBeVisible({ timeout: 20_000 });

    const sellResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response
          .url()
          .includes(`/api/markets/predictions/${market.id}/sell-onchain`),
      { timeout: 30_000 }
    );

    await predictionRow
      .locator('button:has-text("Switch")')
      .click({ force: true });
    await confirmTrade(page);

    const sellResponse = await sellResponsePromise;
    expect(sellResponse.ok()).toBe(true);
    const sellPayload = (await sellResponse.json()) as {
      success: boolean;
      verified: boolean;
      trade: {
        side: 'YES' | 'NO';
        receivedSide: 'YES' | 'NO';
        sharesIn: number;
        sharesOut: number;
      };
    };
    expect(sellPayload.success).toBe(true);
    expect(sellPayload.verified).toBe(true);
    expect(sellPayload.trade.side).toBe('YES');
    expect(sellPayload.trade.receivedSide).toBe('NO');
    expect(sellPayload.trade.sharesIn).toBeGreaterThan(0);
    expect(sellPayload.trade.sharesOut).toBeGreaterThan(0);

    await waitForToastText(page, /Position switched on-chain|Swapped/i);

    await expect
      .poll(async () => {
        const balances = await getPredictionPositionBalances({
          walletAddress: TEST_WALLET,
          marketKey: market.onChainMarketId,
        });
        return JSON.stringify({
          yes: balances.yesBalance < afterBuyBalances.yesBalance,
          no: balances.noBalance > afterBuyBalances.noBalance,
        });
      })
      .toBe(JSON.stringify({ yes: true, no: true }));

    const afterSwitchBalances = await getPredictionPositionBalances({
      walletAddress: TEST_WALLET,
      marketKey: market.onChainMarketId,
    });
    expect(afterSwitchBalances.yesBalance).toBeLessThan(
      afterBuyBalances.yesBalance
    );
    expect(afterSwitchBalances.noBalance).toBeGreaterThan(
      afterBuyBalances.noBalance
    );
  });
});
