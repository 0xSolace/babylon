import {
  BusinessLogicError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  getContractAddresses,
  getRpcUrl,
  PREDICTION_CLAIMED_EVENT,
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

const OnChainClaimSchema = z.object({
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
    const { txHash, walletAddress } = OnChainClaimSchema.parse(body);

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

    const claimLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== PREDICTION_AMM_ROUTER.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_CLAIMED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionClaimed';
      } catch {
        return false;
      }
    });

    if (!claimLog) {
      throw new BusinessLogicError(
        'Could not verify prediction claim event',
        'CLAIM_EVENT_NOT_FOUND'
      );
    }

    const claimEvent = decodeEventLog({
      abi: [PREDICTION_CLAIMED_EVENT],
      data: claimLog.data,
      topics: claimLog.topics,
    });

    const eventMarketKey = claimEvent.args.marketKey as `0x${string}`;
    const payout = claimEvent.args.payout as bigint;

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
