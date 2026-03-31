import {
  BusinessLogicError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { PREDICTION_CLAIMED_EVENT } from '@babylon/contracts';
import { getTxExplorerUrl, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  resolvePredictionTradeContext,
  syncPredictionOnchainState,
} from '../../_onchain-sync';
import {
  findAndDecodeEvent,
  verifyPredictionTxReceipt,
} from '../_onchain-verification';

const OnChainClaimSchema = z.object({
  txHash: z.string().startsWith('0x'),
  walletAddress: z.string().startsWith('0x'),
});

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: marketId } = await context.params;
    const body = await request.json();
    const { txHash, walletAddress } = OnChainClaimSchema.parse(body);

    const { userId, marketKey, service } = await resolvePredictionTradeContext(
      request,
      marketId,
      walletAddress
    );
    const decimals = await service.getCollateralDecimals();

    const { receipt } = await verifyPredictionTxReceipt(txHash);

    const claimEvent = findAndDecodeEvent<{
      args: {
        marketKey: `0x${string}`;
        payout: bigint;
      };
    }>(
      receipt.logs,
      receipt.to!,
      PREDICTION_CLAIMED_EVENT,
      'PredictionClaimed',
      'CLAIM_EVENT_NOT_FOUND'
    );

    const eventMarketKey = claimEvent.args.marketKey;
    const payout = claimEvent.args.payout;

    if (eventMarketKey.toLowerCase() !== marketKey.toLowerCase()) {
      throw new BusinessLogicError(
        'Transaction market key does not match requested market',
        'MARKET_KEY_MISMATCH'
      );
    }

    const sync = await syncPredictionOnchainState({
      userId,
      marketId,
      marketKey: eventMarketKey,
      walletAddress: walletAddress.toLowerCase() as `0x${string}`,
      trade: {
        kind: 'claim',
      },
    });

    logger.info('Prediction AMM claim verified from chain', {
      marketId,
      marketKey: eventMarketKey,
      txHash,
      payoutRaw: payout.toString(),
      userId,
    });

    return successResponse({
      success: true,
      verified: true,
      claim: {
        marketId,
        marketKey: eventMarketKey,
        payout: Number(payout) / 10 ** decimals,
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        explorerUrl: getTxExplorerUrl(txHash),
      },
      market: {
        onChainMarketAddress: sync.marketAddress,
        onChainState: sync.marketState,
        onChainOutcome: sync.marketOutcome,
        yesShares: sync.yesShares,
        noShares: sync.noShares,
        liquidity: sync.liquidity,
        yesProbability: sync.yesProbability,
        noProbability: sync.noProbability,
      },
      userPosition: {
        yesShares: sync.userYesShares,
        noShares: sync.userNoShares,
      },
    });
  }
);
