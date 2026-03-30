import {
  authenticateWithDbUser,
  getDevCredentials,
  sendSponsoredEvmTransaction,
} from '@babylon/api';
import { asPublic, db, eq, users } from '@babylon/db';
import {
  logOnchainPerpMode,
  OnchainPerpService,
  type OnchainPerpTxCall,
} from '@babylon/engine';
import {
  CHAIN,
  getTransactionReceiptConfirmations,
  isOnchainPerpSettlementMode,
  logger,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { type Address, createWalletClient, type Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

type PerpUserWallet = {
  userId: string;
  walletAddress: Address;
  privyWalletId: string | null;
  isLocalDevWallet: boolean;
};

type ManagedWallet = {
  userId: string;
  displayName: string | null;
  walletAddress: Address;
};

let cachedOnchainPerpService: OnchainPerpService | null = null;

export function isOnchainPerpModeEnabled(): boolean {
  return isOnchainPerpSettlementMode();
}

export function getOnchainPerpService(): OnchainPerpService {
  if (!cachedOnchainPerpService) {
    cachedOnchainPerpService = new OnchainPerpService();
  }

  return cachedOnchainPerpService;
}

export async function authenticateOnchainPerpUser(request: NextRequest) {
  return await authenticateWithDbUser(request);
}

export async function resolvePerpUserWallet(
  dbUserId: string,
  fallbackWalletAddress?: string
): Promise<PerpUserWallet> {
  const [user] = await db
    .select({
      id: users.id,
      privyWalletId: users.privyWalletId,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.id, dbUserId))
    .limit(1);

  const devCredentials = getDevCredentials();
  const candidateWalletAddress = (
    user?.walletAddress ??
    fallbackWalletAddress ??
    devCredentials?.walletAddress
  )?.toLowerCase();

  if (!candidateWalletAddress) {
    throw new Error('No EVM wallet is associated with this user');
  }

  const isLocalDevWallet =
    CHAIN.id === 31337 &&
    devCredentials !== null &&
    candidateWalletAddress === devCredentials.walletAddress.toLowerCase();

  if (!isLocalDevWallet && !user?.privyWalletId) {
    throw new Error(
      'User does not have a Privy embedded wallet for on-chain perps'
    );
  }

  return {
    userId: user?.id ?? dbUserId,
    walletAddress: candidateWalletAddress as Address,
    privyWalletId: user?.privyWalletId ?? null,
    isLocalDevWallet,
  };
}

export async function resolveManagedWalletsForUser(
  dbUserId: string
): Promise<ManagedWallet[]> {
  const rows = await asPublic(async () => {
    return await db
      .select({
        id: users.id,
        displayName: users.displayName,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(eq(users.managedBy, dbUserId));
  });

  return rows
    .filter(
      (row): row is typeof row & { walletAddress: string } =>
        typeof row.walletAddress === 'string' && row.walletAddress.length > 0
    )
    .map((row) => ({
      userId: row.id,
      displayName: row.displayName,
      walletAddress: row.walletAddress.toLowerCase() as Address,
    }));
}

export async function submitPerpTransactionCalls(params: {
  wallet: PerpUserWallet;
  calls: OnchainPerpTxCall[];
  context: string;
}): Promise<Hex[]> {
  const service = getOnchainPerpService();
  const txHashes: Hex[] = [];
  const confirmations = getTransactionReceiptConfirmations(CHAIN.id);

  if (params.wallet.isLocalDevWallet) {
    const devCredentials = getDevCredentials();
    if (!devCredentials) {
      throw new Error('Development wallet credentials are unavailable');
    }

    const account = privateKeyToAccount(devCredentials.privateKey as Hex);
    const localChain = CHAIN as Parameters<
      typeof createWalletClient
    >[0]['chain'];
    const walletClient = createWalletClient({
      account,
      chain: localChain,
      transport: http(service.rpcUrl),
    });

    for (const call of params.calls) {
      const hash = await walletClient.sendTransaction({
        account,
        to: call.to,
        data: call.data,
        chain: localChain,
      });

      await service.publicClient.waitForTransactionReceipt({
        hash,
        confirmations,
      });
      txHashes.push(hash);
    }

    return txHashes;
  }

  for (const [index, call] of params.calls.entries()) {
    const { hash } = await sendSponsoredEvmTransaction({
      walletId: params.wallet.privyWalletId!,
      to: call.to,
      data: call.data,
      chainId: CHAIN.id,
      idempotencyKey: `${params.context}:${index}:${call.description}:${Date.now()}`,
    });

    await service.publicClient.waitForTransactionReceipt({
      hash,
      confirmations,
    });
    txHashes.push(hash);
  }

  return txHashes;
}

export function logOnchainPerpRoute(context: string): void {
  logOnchainPerpMode(context);
  logger.info(
    'Routing perp API request to on-chain settlement',
    { chainId: CHAIN.id },
    context
  );
}
