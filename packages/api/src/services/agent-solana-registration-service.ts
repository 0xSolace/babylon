import {
  buildAgentSolanaRegistrationFile,
  deriveDeterministicAgentSolanaAsset,
  getAgentSolanaRegistration,
  prepareAgentSolanaRegistrationTransaction,
} from '@babylon/agents';
import { and, balanceTransactions, db, eq, sql, users } from '@babylon/db';
import {
  BusinessLogicError,
  generateSnowflakeId,
  getBaseUrl,
  getMCPEndpoint,
  logger,
  POINTS,
} from '@babylon/shared';
import { sendSponsoredSolanaTransaction } from './privy/solana-send-transaction';
import { ensureSolanaWalletReady } from './privy/solana-wallet-provisioning';

export interface AgentSolanaRegistrationStatus {
  isRegistered: boolean;
  assetId: string | null;
  metadataUri: string | null;
  txHash: string | null;
  walletAddress: string | null;
  walletReady: boolean;
  cost: number;
}

export interface AgentSolanaRegistrationResult {
  message: string;
  alreadyRegistered: boolean;
  agentUserId: string;
  assetId: string;
  metadataUri: string;
  txHash?: string;
  walletAddress: string;
  cost: number;
}

type AgentSolanaRecord = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  isAgent: boolean;
  managedBy: string | null;
  privyId: string | null;
  privySolanaWalletId: string | null;
  solanaWalletAddress: string | null;
  solanaOfflineWalletReady: boolean;
  solanaRegistered: boolean;
  solanaRegistryAssetId: string | null;
  solanaMetadataUri: string | null;
  solanaRegistrationTxHash: string | null;
};

const AGENT_SOLANA_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  profileImageUrl: users.profileImageUrl,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
  privyId: users.privyId,
  privySolanaWalletId: users.privySolanaWalletId,
  solanaWalletAddress: users.solanaWalletAddress,
  solanaOfflineWalletReady: users.solanaOfflineWalletReady,
  solanaRegistered: users.solanaRegistered,
  solanaRegistryAssetId: users.solanaRegistryAssetId,
  solanaMetadataUri: users.solanaMetadataUri,
  solanaRegistrationTxHash: users.solanaRegistrationTxHash,
} as const;

async function getAgentForOwner(
  ownerUserId: string,
  agentUserId: string
): Promise<AgentSolanaRecord> {
  const [agent] = await db
    .select(AGENT_SOLANA_SELECT)
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);

  if (!agent || !agent.isAgent) {
    throw new BusinessLogicError('Agent not found', 'AGENT_NOT_FOUND');
  }

  if (agent.managedBy !== ownerUserId) {
    throw new BusinessLogicError(
      'You do not manage this agent',
      'AGENT_ACCESS_DENIED'
    );
  }

  return agent;
}

async function deductRegistrationCost(
  ownerUserId: string,
  agentUserId: string,
  cost: number
): Promise<{ balanceBefore: number; balanceAfter: number }> {
  const [deducted] = await db
    .update(users)
    .set({
      virtualBalance: sql`(${users.virtualBalance})::numeric - ${cost}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, ownerUserId),
        sql`(${users.virtualBalance})::numeric >= ${cost}`
      )
    )
    .returning({ virtualBalance: users.virtualBalance });

  if (!deducted) {
    const [owner] = await db
      .select({ virtualBalance: users.virtualBalance })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);

    const currentBalance = Number(owner?.virtualBalance ?? '0');
    throw new BusinessLogicError(
      `Insufficient balance. Solana agent registration costs ${cost} points. You have ${Math.floor(currentBalance)} points.`,
      'INSUFFICIENT_BALANCE'
    );
  }

  const balanceAfter = Number(deducted.virtualBalance);
  const balanceBefore = balanceAfter + cost;

  await db.insert(balanceTransactions).values({
    id: await generateSnowflakeId(),
    userId: ownerUserId,
    type: 'withdrawal',
    amount: String(cost),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    relatedId: agentUserId,
    description: 'Agent Solana registration',
    createdAt: new Date(),
  });

  return { balanceBefore, balanceAfter };
}

async function refundRegistrationCost(
  ownerUserId: string,
  agentUserId: string,
  cost: number
): Promise<void> {
  const [refunded] = await db
    .update(users)
    .set({
      virtualBalance: sql`(${users.virtualBalance})::numeric + ${cost}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, ownerUserId))
    .returning({ virtualBalance: users.virtualBalance });

  const balanceAfter = Number(refunded?.virtualBalance ?? '0');
  const balanceBefore = balanceAfter - cost;

  await db.insert(balanceTransactions).values({
    id: await generateSnowflakeId(),
    userId: ownerUserId,
    type: 'deposit',
    amount: String(cost),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    relatedId: agentUserId,
    description: 'Refund - agent Solana registration failed',
    createdAt: new Date(),
  });
}

async function persistSolanaWalletState(
  agentUserId: string,
  wallet: { privyWalletId: string; walletAddress: string }
): Promise<void> {
  await db
    .update(users)
    .set({
      privySolanaWalletId: wallet.privyWalletId,
      solanaWalletAddress: wallet.walletAddress,
      solanaOfflineWalletReady: true,
      solanaOfflineWalletReadyAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, agentUserId));
}

async function persistSolanaRegistrationState({
  agentUserId,
  walletAddress,
  walletId,
  assetId,
  metadataUri,
  txHash,
}: {
  agentUserId: string;
  walletAddress: string;
  walletId: string;
  assetId: string;
  metadataUri: string;
  txHash?: string | null;
}): Promise<void> {
  await db
    .update(users)
    .set({
      privySolanaWalletId: walletId,
      solanaWalletAddress: walletAddress,
      solanaOfflineWalletReady: true,
      solanaOfflineWalletReadyAt: new Date(),
      solanaRegistered: true,
      solanaRegistryAssetId: assetId,
      solanaMetadataUri: metadataUri,
      solanaRegistrationTxHash: txHash ?? null,
      solanaRegisteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, agentUserId));
}

export async function getAgentSolanaRegistrationStatus({
  ownerUserId,
  agentUserId,
}: {
  ownerUserId: string;
  agentUserId: string;
}): Promise<AgentSolanaRegistrationStatus> {
  const agent = await getAgentForOwner(ownerUserId, agentUserId);

  return {
    isRegistered:
      agent.solanaRegistered && agent.solanaRegistryAssetId !== null,
    assetId: agent.solanaRegistryAssetId,
    metadataUri: agent.solanaMetadataUri,
    txHash: agent.solanaRegistrationTxHash,
    walletAddress: agent.solanaWalletAddress,
    walletReady:
      agent.solanaOfflineWalletReady &&
      agent.solanaWalletAddress !== null &&
      agent.privySolanaWalletId !== null,
    cost: POINTS.ONCHAIN_REGISTRATION,
  };
}

export async function registerAgentOnSolanaForOwner({
  ownerUserId,
  agentUserId,
}: {
  ownerUserId: string;
  agentUserId: string;
}): Promise<AgentSolanaRegistrationResult> {
  let costCharged = false;
  let prepared: {
    assetId: string;
    metadataUri: string;
    metadataCid: string;
    transaction: string;
  } | null = null;

  const agent = await getAgentForOwner(ownerUserId, agentUserId);
  const deterministicAssetId =
    deriveDeterministicAgentSolanaAsset(agentUserId).publicKey.toBase58();

  if (agent.solanaRegistered && agent.solanaRegistryAssetId) {
    return {
      message: 'Agent already registered on Solana',
      alreadyRegistered: true,
      agentUserId,
      assetId: agent.solanaRegistryAssetId,
      metadataUri: agent.solanaMetadataUri ?? '',
      txHash: agent.solanaRegistrationTxHash ?? undefined,
      walletAddress: agent.solanaWalletAddress ?? '',
      cost: 0,
    };
  }

  try {
    const existingOnchain =
      await getAgentSolanaRegistration(deterministicAssetId);
    if (existingOnchain) {
      await db
        .update(users)
        .set({
          solanaRegistered: true,
          solanaRegistryAssetId: deterministicAssetId,
          solanaRegisteredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, agentUserId));

      return {
        message: 'Agent already registered on Solana',
        alreadyRegistered: true,
        agentUserId,
        assetId: deterministicAssetId,
        metadataUri: agent.solanaMetadataUri ?? '',
        txHash: agent.solanaRegistrationTxHash ?? undefined,
        walletAddress: agent.solanaWalletAddress ?? '',
        cost: 0,
      };
    }
  } catch {
    // If the on-chain lookup fails, continue with the normal registration path.
  }

  if (!agent.privyId) {
    throw new BusinessLogicError(
      'Agent wallet identity is not ready yet. Try again after the agent wallet has been provisioned.',
      'AGENT_IDENTITY_NOT_READY'
    );
  }

  const cost = POINTS.ONCHAIN_REGISTRATION;
  await deductRegistrationCost(ownerUserId, agentUserId, cost);
  costCharged = true;

  try {
    const wallet = await ensureSolanaWalletReady({ privyId: agent.privyId });
    await persistSolanaWalletState(agentUserId, wallet);

    const registrationFile = buildAgentSolanaRegistrationFile({
      name: agent.displayName || agent.username || agentUserId,
      description:
        agent.bio || `Autonomous AI agent: ${agent.username || agentUserId}`,
      image: agent.profileImageUrl,
      walletAddress: wallet.walletAddress,
      a2aEndpoint: `${getBaseUrl()}/api/agents/${agentUserId}/a2a`,
      mcpEndpoint: getMCPEndpoint(),
      metadata: {
        platform: 'babylon',
        userType: 'agent',
        managerUserId: ownerUserId,
        network: 'solana',
      },
      skills: [
        'trade',
        'analyze',
        'chat',
        'post',
        'comment',
        'prediction-markets',
        'social-interaction',
      ],
      domains: ['prediction-markets', 'trading', 'social'],
    });

    prepared = await prepareAgentSolanaRegistrationTransaction({
      agentUserId,
      ownerWalletAddress: wallet.walletAddress,
      registrationFile,
    });

    const existingOnchain = await getAgentSolanaRegistration(prepared.assetId);
    if (existingOnchain) {
      await persistSolanaRegistrationState({
        agentUserId,
        walletAddress: wallet.walletAddress,
        walletId: wallet.privyWalletId,
        assetId: prepared.assetId,
        metadataUri: prepared.metadataUri,
      });

      return {
        message: 'Agent already registered on Solana',
        alreadyRegistered: true,
        agentUserId,
        assetId: prepared.assetId,
        metadataUri: prepared.metadataUri,
        walletAddress: wallet.walletAddress,
        cost: 0,
      };
    }

    const tx = await sendSponsoredSolanaTransaction({
      walletId: wallet.privyWalletId,
      transaction: prepared.transaction,
      idempotencyKey: `agent-solana-registration:${agentUserId}`,
    });

    await persistSolanaRegistrationState({
      agentUserId,
      walletAddress: wallet.walletAddress,
      walletId: wallet.privyWalletId,
      assetId: prepared.assetId,
      metadataUri: prepared.metadataUri,
      txHash: tx.hash,
    });

    logger.info(
      'Agent registered on the Solana Agent Registry',
      {
        ownerUserId,
        agentUserId,
        assetId: prepared.assetId,
        txHash: tx.hash,
        cost,
      },
      'AgentSolanaRegistration'
    );

    return {
      message: 'Successfully registered agent on Solana',
      alreadyRegistered: false,
      agentUserId,
      assetId: prepared.assetId,
      metadataUri: prepared.metadataUri,
      txHash: tx.hash,
      walletAddress: wallet.walletAddress,
      cost,
    };
  } catch (error) {
    if (prepared?.assetId) {
      try {
        const existingOnchain = await getAgentSolanaRegistration(
          prepared.assetId
        );
        if (existingOnchain) {
          const wallet = await ensureSolanaWalletReady({
            privyId: agent.privyId,
          });
          await persistSolanaRegistrationState({
            agentUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.privyWalletId,
            assetId: prepared.assetId,
            metadataUri: prepared.metadataUri,
          });

          return {
            message: 'Successfully registered agent on Solana',
            alreadyRegistered: false,
            agentUserId,
            assetId: prepared.assetId,
            metadataUri: prepared.metadataUri,
            walletAddress: wallet.walletAddress,
            cost,
          };
        }
      } catch {
        // Surface the original registration error below.
      }
    }

    if (costCharged) {
      await refundRegistrationCost(ownerUserId, agentUserId, cost);
    }

    throw error;
  }
}
