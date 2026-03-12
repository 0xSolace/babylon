import { logger } from '@babylon/shared';
import type { User as PrivyUser } from '@privy-io/server-auth';
import { getPrivyClient } from '../../auth-middleware';
import { getPrivyOfflineConfig } from './offline-config';
import { getPrivyNodeClient } from './privy-node';
import {
  listEmbeddedSolanaWallets,
  type PrivyUserWalletsLite,
} from './user-wallets';

type PrivyUserWithWallets = PrivyUser & PrivyUserWalletsLite;
type WalletSigner = {
  signer_id: string;
  override_policy_ids?: string[];
};
type WalletWithSigners = {
  additional_signers: WalletSigner[];
};

export type EnsureSolanaWalletReadyInput = {
  privyId: string;
};

export type EnsureSolanaWalletReadyResult = {
  privyWalletId: string;
  walletAddress: string;
  offlineWalletReady: true;
  createdWallet: boolean;
};

function hasOfflineSignerPolicy(
  wallet: WalletWithSigners,
  signerId: string,
  policyId: string
): boolean {
  const signer = wallet.additional_signers.find(
    (candidate) => candidate.signer_id === signerId
  );
  if (!signer) return false;
  return (signer.override_policy_ids ?? []).includes(policyId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig(): { maxAttempts: number; delayMs: number } {
  const isTest = process.env.NODE_ENV === 'test';
  return {
    maxAttempts: isTest ? 1 : 8,
    delayMs: isTest ? 0 : 250,
  };
}

function findNewWalletCandidates(
  wallets: Array<{ walletId: string; address: string }>,
  initialWalletIds: Set<string>
): Array<{ walletId: string; address: string }> {
  return wallets.filter((wallet) => !initialWalletIds.has(wallet.walletId));
}

async function resolveCandidateWalletsAfterCreateWithRetry(
  privyId: string,
  initialWalletIds: Set<string>,
  privyServer: ReturnType<typeof getPrivyClient>,
  immediateWallets: Array<{ walletId: string; address: string }>
): Promise<Array<{ walletId: string; address: string }>> {
  const immediateCandidates = findNewWalletCandidates(
    immediateWallets,
    initialWalletIds
  );
  if (immediateCandidates.length > 0) {
    return immediateCandidates;
  }

  const { maxAttempts, delayMs } = getRetryConfig();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const refreshedPrivyUser = (await privyServer.getUser(
      privyId
    )) as PrivyUserWithWallets;
    const refreshedWallets = listEmbeddedSolanaWallets(refreshedPrivyUser);
    const newWalletCandidates = findNewWalletCandidates(
      refreshedWallets,
      initialWalletIds
    );
    if (newWalletCandidates.length > 0) {
      return newWalletCandidates;
    }

    if (attempt < maxAttempts - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return [];
}

async function findReadyWalletWithRetry(
  walletIds: string[],
  signerId: string,
  policyId: string
): Promise<string | null> {
  if (walletIds.length === 0) return null;

  const { maxAttempts, delayMs } = getRetryConfig();
  const privyNode = getPrivyNodeClient();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const walletId of walletIds) {
      const wallet = await privyNode.wallets().get(walletId);
      if (hasOfflineSignerPolicy(wallet, signerId, policyId)) {
        return walletId;
      }
    }

    if (attempt < maxAttempts - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return null;
}

export async function ensureSolanaWalletReady({
  privyId,
}: EnsureSolanaWalletReadyInput): Promise<EnsureSolanaWalletReadyResult> {
  const privyNode = getPrivyNodeClient();
  const privyServer = getPrivyClient();
  const offlineConfig = getPrivyOfflineConfig();

  const initialPrivyUser = (await privyServer.getUser(
    privyId
  )) as PrivyUserWithWallets;
  const initialWallets = listEmbeddedSolanaWallets(initialPrivyUser);

  for (const candidate of initialWallets) {
    const wallet = await privyNode.wallets().get(candidate.walletId);
    if (
      hasOfflineSignerPolicy(
        wallet,
        offlineConfig.offlineSignerId,
        offlineConfig.offlinePolicyId
      )
    ) {
      return {
        privyWalletId: candidate.walletId,
        walletAddress: candidate.address,
        offlineWalletReady: true,
        createdWallet: false,
      };
    }
  }

  const createdUser = (await privyServer.createWallets({
    userId: privyId,
    wallets: [
      {
        chainType: 'solana',
        additionalSigners: [
          {
            signerId: offlineConfig.offlineSignerId,
            policyIds: [offlineConfig.offlinePolicyId],
          },
        ],
        policyIds: [],
      },
    ],
  })) as PrivyUserWithWallets;

  const createdWallets = listEmbeddedSolanaWallets(createdUser);
  const candidateWallets = await resolveCandidateWalletsAfterCreateWithRetry(
    privyId,
    new Set(initialWallets.map((wallet) => wallet.walletId)),
    privyServer,
    createdWallets
  );

  const readyWalletId = await findReadyWalletWithRetry(
    candidateWallets.map((wallet) => wallet.walletId),
    offlineConfig.offlineSignerId,
    offlineConfig.offlinePolicyId
  );

  const readyWallet = candidateWallets.find(
    (wallet) => wallet.walletId === readyWalletId
  );

  if (!readyWallet) {
    logger.warn(
      'Failed to provision a Solana wallet with the required offline signer policy',
      { privyId },
      'ensureSolanaWalletReady'
    );
    throw new Error(
      'Unable to provision a Solana embedded wallet for sponsored registration.'
    );
  }

  return {
    privyWalletId: readyWallet.walletId,
    walletAddress: readyWallet.address,
    offlineWalletReady: true,
    createdWallet: true,
  };
}
