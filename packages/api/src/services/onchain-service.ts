/**
 * On-Chain Registration Service
 *
 * Handles ERC-8004 identity registration via the Agent0 SDK on Ethereum mainnet.
 * All registrations (users and agents) go through Agent0's canonical ERC-8004
 * Identity Registry. The Babylon Base Sepolia custom registry is deprecated.
 *
 * Architecture:
 * - Agent0 SDK handles contract interactions, IPFS metadata, and event parsing
 * - Privy embedded wallets provide gas-sponsored signing for users
 * - Registration is opt-in and costs POINTS.ONCHAIN_REGISTRATION (100 pts)
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004 - ERC-8004 Trustless Agents
 */

import { getAgent0SDK } from '@babylon/agents';
import { getContractAddresses, getRpcUrl } from '@babylon/contracts';
import {
  clearStaleOnchainRegistrationFlags,
  clearUserAgent0RegistrationState,
  ensureFollowFromReferral,
  findConflictingUserByAgent0TokenId,
  insertOnchainAgentUser,
  insertOnchainHumanUser,
  type OnchainRegistrationUserRow,
  persistAgent0RegistrationToUser,
  resolveOnchainReferrerFromCode,
  selectOnchainRegistrationUserById,
  selectOnchainRegistrationUserByUsernameCaseInsensitive,
  updateHumanUserProfileForOnchainRegistration,
  upsertCompletedReferralAfterOnchain,
  upsertRejectedReferralAfterOnchain,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import type {
  AgentCapabilities,
  AuthenticatedUser,
  JsonValue,
  PointsReason,
  StringRecord,
} from '@babylon/shared';
import {
  BusinessLogicError,
  generateSnowflakeId,
  IDENTITY_REGISTRY_ABI,
  InternalServerError,
  identityRegistryAbi,
  logger,
  POINTS,
  ValidationError,
} from '@babylon/shared';
import {
  type Address,
  type Chain,
  createPublicClient,
  decodeEventLog,
  http,
} from 'viem';
import { baseSepolia, foundry, mainnet } from 'viem/chains';
import { cachedDb } from '../cache/cached-database-service';

function resolveViemChain(chainId: number): Chain {
  switch (chainId) {
    case 1:
      return mainnet;
    case 84532:
      return baseSepolia;
    case 31337:
      return foundry;
    default:
      throw new BusinessLogicError(
        `Unsupported chain ID for on-chain registration: ${chainId}`,
        'UNSUPPORTED_CHAIN'
      );
  }
}

import { notifyNewAccount } from './notification-service';
import { PointsService } from './points-service';
import { getOrCreateReferralCode } from './referral-service';

type OnboardingServices = {
  notifyNewAccount: (userId: string) => Promise<void>;
  pointsService: {
    awardReferralSignup: (
      referrerId: string,
      referredUserId: string
    ) => Promise<{
      success: boolean;
      pointsAwarded: number;
      error?: string;
    }>;
    awardPoints: (
      userId: string,
      amount: number,
      reason: PointsReason,
      metadata?: StringRecord<JsonValue>
    ) => Promise<{
      success: boolean;
      pointsAwarded: number;
      newTotal: number;
    }>;
  };
  getOrCreateReferralCode: (userId: string) => Promise<string>;
};

let onboardingServicesInstance: OnboardingServices | null = null;
let onboardingServicesFallbackLogged = false;

export function setOnboardingServices(services: OnboardingServices): void {
  onboardingServicesInstance = services;
}

function getOnboardingServices(): OnboardingServices {
  if (onboardingServicesInstance) {
    return onboardingServicesInstance;
  }

  if (!onboardingServicesFallbackLogged) {
    logger.warn(
      'OnboardingServices not explicitly initialized, using default service bindings',
      undefined,
      'OnboardingOnchain'
    );
    onboardingServicesFallbackLogged = true;
  }

  const fallback: OnboardingServices = {
    notifyNewAccount,
    pointsService: {
      awardReferralSignup: PointsService.awardReferralSignup,
      awardPoints: PointsService.awardPoints,
    },
    getOrCreateReferralCode,
  };
  onboardingServicesInstance = fallback;

  return fallback;
}

const contracts = getContractAddresses();
export const IDENTITY_REGISTRY = contracts.identityRegistry;

export interface OnchainRegistrationInput {
  user: AuthenticatedUser;
  walletAddress?: string | null;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  endpoint?: string | null;
  referralCode?: string | null;
}

export interface OnchainRegistrationResult {
  message: string;
  tokenId?: number;
  txHash?: string;
  pointsAwarded?: number;
  alreadyRegistered: boolean;
  userId: string;
}

/**
 * Register a user or agent on-chain via Agent0 SDK (canonical ERC-8004).
 *
 * This function handles the complete registration flow:
 * 1. Resolve or create user record in DB
 * 2. Check if already registered via Agent0 SDK
 * 3. Register via Agent0 SDK (creates ERC-721 token + publishes IPFS metadata)
 * 4. Sync registration state to DB (agent0TokenId, onChainRegistered)
 * 5. Process referrals if applicable
 *
 * Welcome bonus is NOT awarded here — it is awarded at profile completion (signup).
 */
export async function processOnchainRegistration({
  user,
  walletAddress,
  username,
  displayName,
  bio,
  profileImageUrl,
  coverImageUrl,
  endpoint,
  referralCode,
}: OnchainRegistrationInput): Promise<OnchainRegistrationResult> {
  if (!user.isAgent && !walletAddress) {
    throw new BusinessLogicError(
      'Wallet address is required for non-agent users',
      'WALLET_REQUIRED'
    );
  }

  const finalUsername =
    username ||
    `user_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36).substring(2, 6)}`;

  if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new ValidationError(
      'Invalid wallet address format',
      ['walletAddress'],
      [
        {
          field: 'walletAddress',
          message: 'Must be a valid Ethereum address (0x...)',
        },
      ]
    );
  }

  let referrerId: string | null = null;
  if (referralCode) {
    const referrerResolution = await asSystem(
      (c) => resolveOnchainReferrerFromCode(c, referralCode, user.userId),
      'onchain-resolve-referrer'
    );

    if (referrerResolution.referrerId) {
      referrerId = referrerResolution.referrerId;
    } else if (referrerResolution.selfReferral) {
      logger.warn(
        'Self-referral attempt blocked',
        { userId: user.userId, referralCode },
        'OnboardingOnchain'
      );
    }
  }

  let dbUser: OnchainRegistrationUserRow | null = null;

  if (user.isAgent) {
    const existingUser = await asSystem(async (c) => {
      if (user.dbUserId) {
        return selectOnchainRegistrationUserById(c, user.dbUserId);
      }
      return selectOnchainRegistrationUserByUsernameCaseInsensitive(
        c,
        user.userId
      );
    }, 'onchain-agent-lookup');
    dbUser = existingUser ?? null;

    if (!dbUser) {
      if (user.dbUserId) {
        throw new BusinessLogicError('Agent not found', 'AGENT_NOT_FOUND');
      }

      const newId = await generateSnowflakeId();
      const createdUser = await asSystem(
        (c) =>
          insertOnchainAgentUser(c, {
            id: newId,
            privyId: user.userId,
            username: user.userId,
            displayName: displayName || username || user.userId,
            bio: bio || `Autonomous AI agent: ${user.userId}`,
            profileImageUrl: profileImageUrl || null,
            coverImageUrl: coverImageUrl || null,
          }),
        'onchain-agent-create'
      );
      dbUser = createdUser ?? null;

      // Invalidate identifier caches for the new user (clears negative cache)
      if (dbUser) {
        await cachedDb.invalidateUserIdentifierCaches({
          id: dbUser.id,
          privyId: user.userId,
          username: dbUser.username,
        });
      }
    }
  } else {
    const existingUser = await asSystem(
      (c) => selectOnchainRegistrationUserById(c, user.userId),
      'onchain-user-lookup'
    );
    dbUser = existingUser ?? null;

    if (!dbUser) {
      const createdUser = await asSystem(
        (c) =>
          insertOnchainHumanUser(c, {
            id: user.userId,
            privyId: user.privyId ?? user.userId,
            walletAddress: walletAddress?.toLowerCase() ?? null,
            username: finalUsername,
            displayName: displayName || finalUsername,
            bio: bio || '',
            profileImageUrl: profileImageUrl || null,
            coverImageUrl: coverImageUrl || null,
            referredBy: referrerId,
          }),
        'onchain-user-create'
      );
      dbUser = createdUser ?? null;

      // Invalidate identifier caches for the new user (clears negative cache)
      if (dbUser) {
        await cachedDb.invalidateUserIdentifierCaches({
          id: dbUser.id,
          privyId: user.privyId ?? user.userId,
          username: dbUser.username,
        });
      }
    } else {
      const profileSubject = dbUser;
      const updatedUser = await asSystem(
        (c) =>
          updateHumanUserProfileForOnchainRegistration(c, profileSubject, {
            walletAddress,
            finalUsername,
            displayName,
            bio,
            profileImageUrl,
            coverImageUrl,
            referrerId,
          }),
        'onchain-user-update-profile'
      );
      const oldUsername = profileSubject.username;
      dbUser = updatedUser ?? null;

      // Refresh identifier caches after any successful user update because lookups
      // now cache the full user row under identifier-based keys.
      if (dbUser) {
        await cachedDb.invalidateUserIdentifierCaches(
          {
            id: dbUser.id,
            privyId: user.privyId ?? user.userId,
            username: dbUser.username,
          },
          {
            username: oldUsername !== dbUser.username ? oldUsername : undefined,
          }
        );
      }
    }
  }

  if (!dbUser) {
    throw new InternalServerError('Failed to create or retrieve user record');
  }

  if (!referrerId && dbUser.referredBy) {
    referrerId = dbUser.referredBy;
  }

  // Check if already registered via Agent0
  if (dbUser.onChainRegistered && dbUser.agent0TokenId !== null) {
    logger.info(
      'User already registered on-chain via Agent0',
      { userId: dbUser.id, agent0TokenId: dbUser.agent0TokenId },
      'processOnchainRegistration'
    );
    return {
      message: 'Already registered on-chain',
      tokenId: dbUser.agent0TokenId,
      alreadyRegistered: true,
      userId: dbUser.id,
    };
  }

  // Clear stale registration state if DB says registered but no agent0TokenId
  if (dbUser.onChainRegistered && dbUser.agent0TokenId === null) {
    await asSystem(
      (c) => clearStaleOnchainRegistrationFlags(c, dbUser.id),
      'onchain-clear-stale-registration'
    );

    logger.warn(
      'Cleared stale registration state (no agent0TokenId)',
      { userId: dbUser.id },
      'processOnchainRegistration'
    );
  }

  const name = username || (user.isAgent ? user.userId : finalUsername);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  logger.info(
    'Registering on-chain via Agent0 SDK',
    { isAgent: user.isAgent, name, userId: dbUser.id },
    'OnboardingOnchain'
  );

  // Register via Agent0 SDK
  const sdk = getAgent0SDK();

  const agent = sdk.createAgent(
    name,
    bio ||
      (user.isAgent
        ? `Autonomous AI agent: ${user.userId}`
        : `Babylon user: ${name}`),
    profileImageUrl ?? undefined
  );

  const agentEndpoint = user.isAgent
    ? endpoint || `${baseUrl}/api/agents/${dbUser.id}/a2a`
    : endpoint || `${baseUrl}/user/${name}`;

  await agent.setA2A(agentEndpoint);
  agent.setActive(true);

  if (user.isAgent) {
    agent.setX402Support(true);
    const skills = ['trade', 'analyze', 'prediction-markets'];
    for (const skill of skills) {
      agent.addSkill(skill, false);
    }
  }

  agent.setMetadata({
    platform: 'babylon',
    userType: user.isAgent ? 'agent' : 'user',
    capabilities: user.isAgent
      ? ({
          strategies: ['momentum'],
          markets: ['prediction'],
          actions: ['analyze'],
          version: '1.0.0',
        } as AgentCapabilities)
      : undefined,
  });

  const registrationHandle = await agent.registerIPFS();
  const { result: registration } = await registrationHandle.waitMined();

  const agent0AgentId = registration.agentId || '';
  const agent0TokenId = agent0AgentId
    ? Number.parseInt(agent0AgentId.split(':')[1] || '0', 10)
    : 0;
  const agent0MetadataCID = registration.agentURI || null;
  const registrationTxHash =
    (registration as { txHash?: string }).txHash || null;

  if (agent0TokenId === 0) {
    throw new InternalServerError(
      'Agent0 registration succeeded but returned no token ID',
      { agentId: agent0AgentId }
    );
  }

  logger.info(
    'Agent0 registration complete',
    {
      agent0TokenId,
      metadataCID: agent0MetadataCID,
      txHash: registrationTxHash,
    },
    'OnboardingOnchain'
  );

  if (agent0TokenId > 0) {
    await asSystem(async (c) => {
      const conflictingUser = await findConflictingUserByAgent0TokenId(
        c,
        agent0TokenId,
        dbUser.id
      );

      if (conflictingUser) {
        await clearUserAgent0RegistrationState(c, conflictingUser.id);

        logger.warn(
          'Cleared conflicting agent0TokenId from another user',
          {
            agent0TokenId,
            currentUserId: dbUser.id,
            conflictingUserId: conflictingUser.id,
          },
          'OnboardingOnchain'
        );
      }
    }, 'onchain-resolve-token-conflict');
  }

  await asSystem(
    (c) =>
      persistAgent0RegistrationToUser(c, dbUser.id, {
        agent0TokenId,
        agent0MetadataCID,
        registrationTxHash,
      }),
    'onchain-persist-registration'
  );

  // Sync on-chain reputation to local database
  try {
    const { syncAfterAgent0Registration } = await import('@babylon/agents');
    await syncAfterAgent0Registration(dbUser.id, agent0TokenId);
    logger.info(
      'Agent0 reputation synced successfully',
      { userId: dbUser.id, agent0TokenId },
      'OnboardingOnchain'
    );
  } catch (syncError) {
    logger.warn(
      'Agent0 reputation sync failed (non-fatal)',
      {
        error:
          syncError instanceof Error ? syncError.message : String(syncError),
      },
      'OnboardingOnchain'
    );
  }

  // Generate referral code
  const services = getOnboardingServices();
  await services.getOrCreateReferralCode(dbUser.id);

  await services.notifyNewAccount(dbUser.id);

  // Process referrals
  if (referrerId) {
    const referralResult = await services.pointsService.awardReferralSignup(
      referrerId,
      dbUser.id
    );

    if (referralResult.success) {
      const refereeBonus = await services.pointsService.awardPoints(
        dbUser.id,
        POINTS.REFERRAL_BONUS,
        'referral_bonus',
        { referrerId }
      );

      if (referralCode) {
        const now = new Date();
        await asSystem(async (c) => {
          await upsertCompletedReferralAfterOnchain(c, {
            referralCode,
            referredUserId: dbUser.id,
            referrerId,
            newReferralId: await generateSnowflakeId(),
            completedAt: now,
            createdAt: now,
          });
        }, 'onchain-referral-completed');
      }

      await asSystem(async (c) => {
        await ensureFollowFromReferral(c, {
          followId: await generateSnowflakeId(),
          followerId: dbUser.id,
          followingId: referrerId,
          createdAt: new Date(),
        });
      }, 'onchain-referral-follow');

      logger.info(
        'Referral processed successfully',
        {
          referrerId,
          referredUserId: dbUser.id,
          referrerPoints: referralResult.pointsAwarded,
          refereeBonus: refereeBonus.pointsAwarded,
        },
        'OnboardingOnchain'
      );
    } else {
      if (referralCode) {
        await asSystem(async (c) => {
          await upsertRejectedReferralAfterOnchain(c, {
            referralCode,
            referredUserId: dbUser.id,
            referrerId,
            newReferralId: await generateSnowflakeId(),
            createdAt: new Date(),
          });
        }, 'onchain-referral-rejected');
      }

      logger.warn(
        'Referral blocked during registration',
        { referrerId, referredUserId: dbUser.id, error: referralResult.error },
        'OnboardingOnchain'
      );
    }
  }

  return {
    message: `Successfully registered ${user.isAgent ? 'agent' : 'user'} on-chain via Agent0`,
    tokenId: agent0TokenId,
    txHash: registrationTxHash ?? undefined,
    alreadyRegistered: false,
    pointsAwarded: 0,
    userId: dbUser.id,
  };
}

/**
 * @deprecated This function relies on the Babylon Base Sepolia Identity Registry
 * which is being phased out. Profile updates should use Agent0 SDK's setAgentURI().
 */
export interface ConfirmOnchainProfileUpdateInput {
  userId: string;
  walletAddress: string;
  txHash: `0x${string}`;
}

export interface ConfirmOnchainProfileUpdateResult {
  tokenId: number;
  endpoint: string;
  capabilitiesHash: `0x${string}`;
  metadata: StringRecord<JsonValue> | null;
}

export async function confirmOnchainProfileUpdate({
  userId,
  walletAddress,
  txHash,
}: ConfirmOnchainProfileUpdateInput): Promise<ConfirmOnchainProfileUpdateResult> {
  if (!walletAddress) {
    throw new BusinessLogicError(
      'Wallet address required for profile update confirmation',
      'WALLET_REQUIRED'
    );
  }

  const lowerWallet = walletAddress.toLowerCase();
  const currentChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
  const publicClient = createPublicClient({
    chain: resolveViemChain(currentChainId),
    transport: http(getRpcUrl()),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  if (receipt.status !== 'success') {
    throw new BusinessLogicError(
      'Blockchain profile update transaction failed',
      'PROFILE_UPDATE_TX_FAILED',
      { txHash, userId, receipt: receipt.status }
    );
  }

  const expectedTokenId = Number(
    await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityRegistryAbi,
      functionName: 'getTokenId',
      args: [walletAddress as Address],
    })
  );

  if (!expectedTokenId || Number.isNaN(expectedTokenId)) {
    throw new BusinessLogicError(
      'User wallet is not registered on-chain',
      'WALLET_NOT_REGISTERED',
      { walletAddress: lowerWallet }
    );
  }

  let tokenId: number | null = null;
  let endpoint = '';
  let capabilitiesHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== IDENTITY_REGISTRY.toLowerCase()) continue;
    if (log.topics.length === 0) continue;

    const decoded = decodeEventLog({
      abi: identityRegistryAbi,
      data: log.data,
      topics: log.topics,
      strict: false,
    });

    if (decoded.eventName === 'AgentUpdated') {
      tokenId = Number(decoded.args.tokenId);
      endpoint = decoded.args.endpoint ?? '';
      capabilitiesHash = decoded.args.capabilitiesHash as `0x${string}`;
      break;
    }
  }

  if (!tokenId) {
    throw new BusinessLogicError(
      'Transaction did not emit AgentUpdated event',
      'PROFILE_UPDATE_EVENT_NOT_FOUND',
      { txHash }
    );
  }

  if (tokenId !== expectedTokenId) {
    throw new BusinessLogicError(
      'Transaction updated a different token ID than expected',
      'PROFILE_UPDATE_TOKEN_MISMATCH',
      {
        txHash,
        expectedTokenId,
        actualTokenId: tokenId,
        walletAddress: lowerWallet,
      }
    );
  }

  const profile = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'getAgentProfile',
    args: [BigInt(tokenId)],
  });

  const profileArray = profile as [
    string,
    string,
    `0x${string}`,
    bigint,
    boolean,
    string,
  ];
  endpoint = endpoint || profileArray[1];
  capabilitiesHash = profileArray[2];
  const rawMetadata = profileArray[5];

  let metadata: StringRecord<JsonValue> | null = null;
  if (typeof rawMetadata === 'string' && rawMetadata.trim().length > 0) {
    metadata = JSON.parse(rawMetadata) as StringRecord<JsonValue>;
  }

  return {
    tokenId,
    endpoint,
    capabilitiesHash,
    metadata,
  };
}
