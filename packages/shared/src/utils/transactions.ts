import { CHAIN_ID } from '../constants';

export function getTransactionReceiptConfirmations(
  chainId: number = CHAIN_ID
): number {
  return chainId === 31337 ? 0 : 1;
}
