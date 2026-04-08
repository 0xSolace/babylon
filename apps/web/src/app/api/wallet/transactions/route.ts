/**
 * Wallet Transaction History API
 *
 * @route GET /api/wallet/transactions?address=0x...&page=1&limit=20
 * @access Authenticated
 *
 * @description
 * Returns transaction history for a given wallet address.
 * Data sources:
 *   - walletTransferLog table (token/ETH/NFT transfers initiated through Babylon)
 *   - NFT mint events from nftClaims table
 *   - NFT ownership transfers from nftOwnership table
 *
 * Each source is capped at MAX_RECORDS_PER_SOURCE before the in-memory
 * merge-sort to prevent unbounded memory allocation for heavy users.
 */

import {
  authenticateUser,
  checkRateLimitAsync,
  RATE_LIMIT_CONFIGS,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  selectNftMintHistoryRowsForClaimerOrderClaimedDescLimit,
  selectNftOwnershipHistoryRowsForOwnerOrderAcquiredDescLimit,
  selectWalletTransferLogsForAddressOrderCreatedDescLimit,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import {
  CHAIN_ID,
  getTokenListForChain,
  getTxExplorerUrl,
  logger,
  toISO,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

// Maximum records fetched per source before in-memory merge. Prevents
// unbounded queries for users with large transaction histories.
const MAX_RECORDS_PER_SOURCE = 500;

import { walletOptionsResponse } from '../_cors';

// OPTIONS wrapped for consistency: same error/Sentry path as GET/POST; overhead negligible.
export const OPTIONS = withErrorHandling(async () => walletOptionsResponse());

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticateUser(request);

  const rateLimit = await checkRateLimitAsync(
    user.id,
    RATE_LIMIT_CONFIGS.WALLET_READ
  );
  if (!rateLimit.allowed) {
    const retryAfterSeconds = rateLimit.retryAfter || 60;
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  const address = request.nextUrl.searchParams.get('address');
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing address parameter' },
      { status: 400 }
    );
  }

  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get('page')) || 1
  );
  const limit = Math.min(
    50,
    Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20)
  );
  const offset = (page - 1) * limit;

  const walletAddress = address.toLowerCase();

  // Build a lookup map from the token list for ERC-20 metadata enrichment
  const tokenMap = new Map(
    getTokenListForChain(CHAIN_ID).map((t) => [t.address.toLowerCase(), t])
  );

  const { transferRecords, mintRecords, ownershipRecords } = await asUser(
    user.id,
    async (tx) => {
      const [transferRows, mintRows, ownershipRows] = await Promise.all([
        selectWalletTransferLogsForAddressOrderCreatedDescLimit(
          tx,
          walletAddress,
          MAX_RECORDS_PER_SOURCE
        ),
        selectNftMintHistoryRowsForClaimerOrderClaimedDescLimit(
          tx,
          walletAddress,
          MAX_RECORDS_PER_SOURCE
        ),
        selectNftOwnershipHistoryRowsForOwnerOrderAcquiredDescLimit(
          tx,
          walletAddress,
          MAX_RECORDS_PER_SOURCE
        ),
      ]);

      return {
        transferRecords: transferRows,
        mintRecords: mintRows,
        ownershipRecords: ownershipRows,
      };
    }
  );

  const transactions: TransactionRecord[] = [];
  const seenTxHashes = new Set<string>();

  for (const record of transferRecords) {
    const isSend = record.fromAddress === walletAddress;
    const tx: TransactionRecord = {
      txHash: record.txHash ?? record.id,
      type: isSend ? 'send' : 'receive',
      from: record.fromAddress,
      to: record.toAddress,
      value: record.amount,
      timestamp: toISO(record.createdAt),
      status: record.status as 'confirmed' | 'pending' | 'failed',
      explorerUrl: record.txHash ? getTxExplorerUrl(record.txHash) : '',
    };

    if (record.type === 'erc20' && record.tokenAddress) {
      const tokenMeta = tokenMap.get(record.tokenAddress.toLowerCase());
      tx.token = {
        symbol: tokenMeta?.symbol ?? '',
        address: record.tokenAddress,
        decimals: tokenMeta?.decimals ?? 18,
      };
    }
    if (record.type === 'erc721' && record.tokenId) {
      tx.nft = {
        collection: '',
        tokenId: record.tokenId,
        name: `NFT #${record.tokenId}`,
        imageUrl: '',
      };
    }

    transactions.push(tx);
    if (record.txHash) seenTxHashes.add(record.txHash);
  }

  for (const mint of mintRecords) {
    if (seenTxHashes.has(mint.txHash)) continue;
    seenTxHashes.add(mint.txHash);
    transactions.push({
      txHash: mint.txHash,
      type: 'mint',
      from: '0x0000000000000000000000000000000000000000',
      to: mint.claimerAddress,
      value: '0',
      nft: {
        collection: 'ProtoMonkeys',
        tokenId: String(mint.tokenId),
        name: mint.nftName ?? `ProtoMonkey #${mint.tokenId}`,
        imageUrl: mint.nftImageUrl ?? '',
      },
      timestamp: toISO(mint.claimedAt),
      status: 'confirmed',
      explorerUrl: getTxExplorerUrl(mint.txHash),
    });
  }

  for (const record of ownershipRecords) {
    if (record.txHash && !seenTxHashes.has(record.txHash)) {
      seenTxHashes.add(record.txHash);
      transactions.push({
        txHash: record.txHash,
        type: 'receive',
        from: '0x0000000000000000000000000000000000000000',
        to: record.ownerAddress,
        value: '0',
        nft: {
          collection: 'ProtoMonkeys',
          tokenId: String(record.tokenId),
          name: record.nftName ?? `ProtoMonkey #${record.tokenId}`,
          imageUrl: record.nftImageUrl ?? '',
        },
        timestamp: toISO(record.acquiredAt),
        status: 'confirmed',
        explorerUrl: record.txHash ? getTxExplorerUrl(record.txHash) : '',
      });
    }
  }

  // Sort all merged transactions by timestamp descending, then paginate
  transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = transactions.length;
  const paginated = transactions.slice(offset, offset + limit);

  logger.debug(
    'Wallet transactions fetched',
    { address: walletAddress, total, page, limit },
    'GET /api/wallet/transactions'
  );

  return successResponse({
    transactions: paginated,
    pagination: { page, limit, total },
  });
});

interface TransactionRecord {
  txHash: string;
  type: 'send' | 'receive' | 'mint' | 'approve' | 'contract_interaction';
  from: string;
  to: string;
  value: string;
  token?: { symbol: string; address: string; decimals: number };
  nft?: {
    collection: string;
    tokenId: string;
    name: string;
    imageUrl: string;
  };
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  explorerUrl: string;
}
