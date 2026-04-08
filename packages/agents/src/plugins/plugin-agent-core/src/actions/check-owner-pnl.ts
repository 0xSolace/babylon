/**
 * CHECK_OWNER_PNL Action
 *
 * Returns the owner's balance, P&L, open positions, and recent trades.
 * This shows the owner's trading performance, not the agent's.
 */

import {
  selectActivePredictionPositionsWithMarketForUser,
  selectOpenPerpPositionsForUser,
  selectOwnerHeaderForPnl,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { calculatePortfolioBreakdown, WalletService } from '@babylon/engine';
import type { MessageTag } from '@babylon/shared';
import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { logger } from '../../../../shared/logger';

/** Extended ActionResult with optional tag for UI */
interface ActionResultWithTag extends ActionResult {
  tag?: MessageTag;
}

export const checkOwnerPnlAction: Action = {
  name: 'CHECK_OWNER_PNL',
  description:
    "Check your OWNER's balance, P&L, and open positions. This shows your owner's trading performance, not yours. Useful for understanding their strategy or coordinating trades.",

  parameters: {},

  examples: [
    [
      {
        name: 'user',
        content: { text: "What's my P&L?" },
      },
      {
        name: 'assistant',
        content: { text: 'Let me check your trading performance...' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'Show me my positions' },
      },
      {
        name: 'assistant',
        content: { text: "I'll pull up your current positions..." },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'How am I doing on trades?' },
      },
      {
        name: 'assistant',
        content: { text: 'Let me check your trading stats...' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: "What's your owner's balance?" },
      },
      {
        name: 'assistant',
        content: { text: "I'll check my owner's balance..." },
      },
    ],
  ],

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<boolean> => {
    // Always valid - handler checks for ownerId and returns helpful error if missing
    // Note: ownerId is added to state AFTER composeState/validate runs
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    _callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const ownerId = state?.values?.ownerId as string | undefined;

    if (!ownerId) {
      return {
        success: false,
        text: 'Owner ID not available in this context.',
        error: 'No owner ID provided',
      };
    }

    try {
      const owner = await selectOwnerHeaderForPnl(db, ownerId);

      if (!owner) {
        return {
          success: false,
          text: 'Owner not found.',
          error: 'Owner not found',
        };
      }

      const ownerName = owner.displayName || owner.username || 'Owner';

      // Get portfolio breakdown for accurate P&L (same as profile page)
      const portfolio = await calculatePortfolioBreakdown(ownerId);

      // Get wallet balance (for cash balance display)
      let balance = portfolio?.wallet ?? 0;
      let lifetimePnL = 0;
      try {
        const walletBalance = await WalletService.getBalance(ownerId);
        balance = walletBalance.balance;
        lifetimePnL = walletBalance.lifetimePnL;
      } catch {
        lifetimePnL = Number(owner?.lifetimePnL ?? 0);
      }

      // Use portfolio-based total P&L (accurate), fall back to lifetimePnL
      const totalPnL = portfolio?.totalPnL ?? lifetimePnL;
      const totalAssets = portfolio?.totalAssets ?? balance;
      const positionsValue = portfolio?.positions ?? 0;
      const available = portfolio?.available ?? balance;

      const predictionPositions =
        await selectActivePredictionPositionsWithMarketForUser(db, ownerId);

      const perpPositionsList = await selectOpenPerpPositionsForUser(
        db,
        ownerId
      );

      const totalPositions =
        predictionPositions.length + perpPositionsList.length;

      logger.info(
        `[CHECK_OWNER_PNL] Retrieved P&L for owner ${ownerName}`,
        { positions: totalPositions, ownerId },
        'CheckOwnerPnL'
      );

      // Format data for tag
      const formattedPredictionPositions = predictionPositions.map((p) => ({
        id: p.id,
        marketId: p.marketId,
        side: p.side ? 'YES' : 'NO',
        shares: Number(p.shares),
        avgPrice: Number(p.avgPrice),
        question: p.question?.substring(0, 80) || 'Unknown',
      }));

      const formattedPerpPositions = perpPositionsList.map((p) => ({
        id: p.id,
        ticker: p.ticker,
        side: p.side,
        size: Number(p.size),
        entryPrice: Number(p.entryPrice),
        leverage: Number(p.leverage),
      }));

      return {
        success: true,
        text: `Retrieved ${ownerName}'s P&L: ${balance.toFixed(2)} balance, ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} total P&L, ${totalPositions} open positions.`,
        data: {
          ownerName,
          ownerId,
          balance,
          lifetimePnL,
          totalPnL,
          totalAssets,
          positionsValue,
          available,
          predictionPositions: formattedPredictionPositions,
          perpPositions: formattedPerpPositions,
        },
        values: {
          ownerName,
          balance,
          lifetimePnL,
          totalPnL,
          totalAssets,
          positionsValue,
          available,
          predictionPositions: formattedPredictionPositions.map((p) => ({
            id: p.id,
            question: p.question,
            side: p.side,
            shares: p.shares,
          })),
          perpPositions: formattedPerpPositions.map((p) => ({
            id: p.id,
            ticker: p.ticker,
            side: p.side,
            size: p.size,
          })),
        },
        // Tag for sidebar display
        tag: {
          type: 'owner-pnl',
          label: 'My Portfolio',
          icon: 'PiggyBank',
          data: {
            ownerName,
            balance,
            lifetimePnL,
            totalPnL,
            totalAssets,
            positionsValue,
            available,
            predictionPositions: formattedPredictionPositions,
            perpPositions: formattedPerpPositions,
          },
        },
      } as ActionResultWithTag;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CHECK_OWNER_PNL] Error:', errorMsg);

      return {
        success: false,
        text: `Failed to retrieve owner's P&L: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};
