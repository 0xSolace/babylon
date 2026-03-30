import {
  BusinessLogicError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  getContractAddresses,
  getRpcUrl,
  PREDICTION_SHARES_BOUGHT_EVENT,
} from '@babylon/contracts';
import {
  CHAIN,
  getTransactionReceiptConfirmations,
  getTxExplorerUrl,
  logger,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { createPublicClient, decodeEventLog, http } from 'viem';
import { z } from 'zod';
import {
  resolvePredictionTradeContext,
  syncPredictionOnchainState,
} from '../../_onchain-sync';

const OnChainBuySchema = z.object({
  side: z.enum(['yes', 'no']),
  collateralAmount: z.number().positive(),
  txHash: z.string().startsWith('0x'),
  walletAddress: z.string().startsWith('0x'),
});

const { predictionAmmRouter: PREDICTION_AMM_ROUTER } = getContractAddresses();

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id: marketId } = await context.params;
    const body = await request.json();
    const { side, collateralAmount, txHash, walletAddress } =
      OnChainBuySchema.parse(body);

    if (!PREDICTION_AMM_ROUTER) {
      throw new BusinessLogicError(
        'Prediction AMM router is not configured',
        'PREDICTION_ROUTER_UNAVAILABLE'
      );
    }

    const { userId, marketKey, service } = await resolvePredictionTradeContext(
      request,
      marketId,
      walletAddress
    );
    const decimals = await service.getCollateralDecimals();
    const publicClient = createPublicClient({
      transport: http(getRpcUrl()),
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: getTransactionReceiptConfirmations(CHAIN.id),
      timeout: 60_000,
    });

    if (receipt.status !== 'success') {
      throw new BusinessLogicError('Transaction failed on-chain', 'TX_FAILED');
    }

    if (receipt.to?.toLowerCase() !== PREDICTION_AMM_ROUTER.toLowerCase()) {
      throw new BusinessLogicError(
        'Transaction not sent to the prediction AMM router',
        'INVALID_CONTRACT'
      );
    }

    const buyLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== PREDICTION_AMM_ROUTER.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_SHARES_BOUGHT_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionSharesBought';
      } catch {
        return false;
      }
    });

    if (!buyLog) {
      throw new BusinessLogicError(
        'Could not verify prediction market buy event',
        'BUY_EVENT_NOT_FOUND'
      );
    }

    const buyEvent = decodeEventLog({
      abi: [PREDICTION_SHARES_BOUGHT_EVENT],
      data: buyLog.data,
      topics: buyLog.topics,
    });

    const eventMarketKey = buyEvent.args.marketKey as `0x${string}`;
    const eventOutcome = Number(buyEvent.args.outcome);
    const eventSharesOut = buyEvent.args.sharesOut as bigint;
    const eventCollateralIn = buyEvent.args.collateralIn as bigint;
    const expectedOutcome = side === 'yes' ? 1 : 0;

    if (eventMarketKey.toLowerCase() !== marketKey.toLowerCase()) {
      throw new BusinessLogicError(
        'Transaction market key does not match requested market',
        'MARKET_KEY_MISMATCH'
      );
    }

    if (eventOutcome !== expectedOutcome) {
      throw new BusinessLogicError(
        'Transaction outcome does not match requested side',
        'OUTCOME_MISMATCH'
      );
    }

    const sync = await syncPredictionOnchainState({
      userId,
      marketId,
      marketKey: eventMarketKey,
      walletAddress: walletAddress.toLowerCase() as `0x${string}`,
      trade: {
        kind: 'buy',
        side: side.toUpperCase() as 'YES' | 'NO',
        sharesDelta: Number(eventSharesOut) / 10 ** decimals,
        collateralDelta: Number(eventCollateralIn) / 10 ** decimals,
      },
    });

    const normalizedShares = Number(eventSharesOut) / 10 ** sync.decimals;
    const normalizedCollateral =
      Number(eventCollateralIn) / 10 ** sync.decimals;

    logger.info('Prediction AMM buy verified from chain', {
      marketId,
      marketKey: eventMarketKey,
      txHash,
      collateralAmount,
      collateralInRaw: eventCollateralIn.toString(),
      sharesOutRaw: eventSharesOut.toString(),
      side,
      userId,
    });

    return successResponse({
      success: true,
      verified: true,
      position: {
        marketId,
        marketKey: eventMarketKey,
        side: side.toUpperCase(),
        collateralAmount: normalizedCollateral,
        shares: normalizedShares,
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
