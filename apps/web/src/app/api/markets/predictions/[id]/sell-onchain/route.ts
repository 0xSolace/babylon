import {
  BusinessLogicError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  getContractAddresses,
  getRpcUrl,
  PREDICTION_SHARES_SWAPPED_EVENT,
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

const OnChainSellSchema = z.object({
  side: z.enum(['yes', 'no']),
  shares: z.number().positive(),
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
    const { side, shares, txHash, walletAddress } =
      OnChainSellSchema.parse(body);

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

    const swapLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== PREDICTION_AMM_ROUTER.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_SHARES_SWAPPED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionSharesSwapped';
      } catch {
        return false;
      }
    });

    if (!swapLog) {
      throw new BusinessLogicError(
        'Could not verify prediction market swap event',
        'SWAP_EVENT_NOT_FOUND'
      );
    }

    const swapEvent = decodeEventLog({
      abi: [PREDICTION_SHARES_SWAPPED_EVENT],
      data: swapLog.data,
      topics: swapLog.topics,
    });

    const eventMarketKey = swapEvent.args.marketKey as `0x${string}`;
    const eventOutcomeIn = Number(swapEvent.args.outcomeIn);
    const eventOutcomeOut = Number(swapEvent.args.outcomeOut);
    const eventSharesIn = swapEvent.args.sharesIn as bigint;
    const eventSharesOut = swapEvent.args.sharesOut as bigint;
    const expectedOutcomeIn = side === 'yes' ? 1 : 0;
    const receivedSide = side === 'yes' ? 'NO' : 'YES';

    if (eventMarketKey.toLowerCase() !== marketKey.toLowerCase()) {
      throw new BusinessLogicError(
        'Transaction market key does not match requested market',
        'MARKET_KEY_MISMATCH'
      );
    }

    if (eventOutcomeIn !== expectedOutcomeIn) {
      throw new BusinessLogicError(
        'Transaction side does not match requested position',
        'OUTCOME_MISMATCH'
      );
    }

    const sync = await syncPredictionOnchainState({
      userId,
      marketId,
      marketKey: eventMarketKey,
      walletAddress: walletAddress.toLowerCase() as `0x${string}`,
      trade: {
        kind: 'switch',
        fromSide: side.toUpperCase() as 'YES' | 'NO',
        sharesIn: Number(eventSharesIn) / 10 ** decimals,
        sharesOut: Number(eventSharesOut) / 10 ** decimals,
      },
    });

    const normalizedSharesIn = Number(eventSharesIn) / 10 ** sync.decimals;
    const normalizedSharesOut = Number(eventSharesOut) / 10 ** sync.decimals;

    logger.info('Prediction AMM share swap verified from chain', {
      marketId,
      marketKey: eventMarketKey,
      txHash,
      requestedShares: shares,
      sharesInRaw: eventSharesIn.toString(),
      sharesOutRaw: eventSharesOut.toString(),
      side,
      userId,
    });

    return successResponse({
      success: true,
      verified: true,
      trade: {
        marketId,
        marketKey: eventMarketKey,
        side: side.toUpperCase(),
        receivedSide,
        sharesIn: normalizedSharesIn,
        sharesOut: normalizedSharesOut,
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        explorerUrl: getTxExplorerUrl(txHash),
        outcomeOut: eventOutcomeOut,
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
