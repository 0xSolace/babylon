import { BusinessLogicError } from '@babylon/api';
import { getContractAddresses, getRpcUrl } from '@babylon/contracts';
import { CHAIN, getTransactionReceiptConfirmations } from '@babylon/shared';
import {
  type Abi,
  createPublicClient,
  decodeEventLog,
  http,
  type Log,
} from 'viem';

const { predictionAmmRouter: PREDICTION_AMM_ROUTER } = getContractAddresses();

export function requireRouterAddress(): string {
  if (!PREDICTION_AMM_ROUTER) {
    throw new BusinessLogicError(
      'Prediction AMM router is not configured',
      'PREDICTION_ROUTER_UNAVAILABLE'
    );
  }
  return PREDICTION_AMM_ROUTER;
}

export async function verifyPredictionTxReceipt(txHash: string) {
  const routerAddress = requireRouterAddress();
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

  if (receipt.to?.toLowerCase() !== routerAddress.toLowerCase()) {
    throw new BusinessLogicError(
      'Transaction not sent to the prediction AMM router',
      'INVALID_CONTRACT'
    );
  }

  return { receipt, routerAddress };
}

export function findAndDecodeEvent<T>(
  logs: Log[],
  routerAddress: string,
  eventAbi: Abi[number],
  expectedEventName: string,
  errorCode: string
): T {
  const matchingLog = logs.find((log) => {
    if (log.address.toLowerCase() !== routerAddress.toLowerCase()) {
      return false;
    }
    try {
      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics,
      });
      return decoded.eventName === expectedEventName;
    } catch {
      return false;
    }
  });

  if (!matchingLog) {
    throw new BusinessLogicError(
      `Could not verify prediction market ${expectedEventName} event`,
      errorCode
    );
  }

  return decodeEventLog({
    abi: [eventAbi],
    data: matchingLog.data,
    topics: matchingLog.topics,
  }) as T;
}
