import { logger } from '@babylon/shared';
import { getPrivyOfflineConfig } from './offline-config';
import {
  type EnsureOfflineWalletReadyResult,
  ensureOfflineWalletReady,
} from './offline-wallet-provisioning';
import { getPrivyNodeClient } from './privy-node';
import {
  type PrivyUserWalletsLite,
  pickEmbeddedEvmWallet,
} from './user-wallets';

type PrivyCreateUserResponse = PrivyUserWalletsLite & {
  id?: string | null;
};

export type ProvisionAgentPrivyWalletInput = {
  agentUserId: string;
  existingPrivyId?: string | null;
};

export type ProvisionAgentPrivyWalletResult = EnsureOfflineWalletReadyResult & {
  privyId: string;
  createdPrivyUser: boolean;
};

export async function provisionAgentPrivyWallet({
  agentUserId,
  existingPrivyId,
}: ProvisionAgentPrivyWalletInput): Promise<ProvisionAgentPrivyWalletResult> {
  if (existingPrivyId) {
    const readyWallet = await ensureOfflineWalletReady({
      privyId: existingPrivyId,
    });

    return {
      privyId: existingPrivyId,
      createdPrivyUser: false,
      ...readyWallet,
    };
  }

  const privy = getPrivyNodeClient();
  const offlineConfig = getPrivyOfflineConfig();

  const createdUser = (await privy.users().create({
    // Backend-managed agent users intentionally have no end-user linked accounts.
    linked_accounts: [],
    custom_metadata: {
      babylon_agent_user_id: agentUserId,
      babylon_user_type: 'agent',
    },
    wallets: [
      {
        chain_type: 'ethereum',
        additional_signers: [
          {
            signer_id: offlineConfig.offlineSignerId,
            override_policy_ids: [offlineConfig.offlinePolicyId],
          },
        ],
        policy_ids: [],
      },
    ],
  })) as PrivyCreateUserResponse;

  const privyId = createdUser.id?.trim();
  if (!privyId) {
    throw new Error('Failed to create Privy user for agent');
  }

  const embeddedWallet = pickEmbeddedEvmWallet(createdUser);
  logger.info(
    'Created server-managed Privy user for agent',
    {
      agentUserId,
      privyId,
      walletId: embeddedWallet?.walletId ?? null,
      walletAddress: embeddedWallet?.address ?? null,
    },
    'provisionAgentPrivyWallet'
  );

  const readyWallet = await ensureOfflineWalletReady({ privyId });

  return {
    privyId,
    createdPrivyUser: true,
    ...readyWallet,
  };
}
