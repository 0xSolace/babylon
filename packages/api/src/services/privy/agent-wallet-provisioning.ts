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

function getAgentCustomAuthId(agentUserId: string): string {
  return `babylon-agent:${agentUserId}`;
}

function isPrivyNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('404') || message.includes('not found');
}

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
  const customUserId = getAgentCustomAuthId(agentUserId);

  let createdPrivyUser = false;
  let createdUser: PrivyCreateUserResponse | null = null;

  try {
    createdUser = (await privy.users().getByCustomAuthID({
      custom_user_id: customUserId,
    })) as PrivyCreateUserResponse;
  } catch (error) {
    if (!isPrivyNotFoundError(error)) {
      throw error;
    }

    createdPrivyUser = true;
    createdUser = (await privy.users().create({
      linked_accounts: [
        {
          type: 'custom_auth',
          custom_user_id: customUserId,
        },
      ],
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
  }

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
    createdPrivyUser,
    ...readyWallet,
  };
}
