/**
 * @fileoverview React hooks for moderation system
 * @module hooks/useModeration
 *
 * Provides hooks for interacting with the Jeju ModerationMarketplace
 * and local moderation features.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';

// Types
export enum BanStatus {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  BANNED = 3,
  CLEARED = 4,
  APPEALING = 5,
}

export enum VotePosition {
  YES = 0,
  NO = 1,
}

export interface BanCase {
  caseId: `0x${string}`;
  reporter: Address;
  target: Address;
  reporterStake: bigint;
  targetStake: bigint;
  reason: string;
  status: BanStatus;
  createdAt: number;
  marketOpenUntil: number;
  yesVotes: bigint;
  noVotes: bigint;
  resolved: boolean;
}

export interface StakeInfo {
  amount: bigint;
  stakedAt: number;
  isStaked: boolean;
}

// ABIs (minimal for hooks)
const MODERATION_MARKETPLACE_ABI = [
  {
    type: 'function',
    name: 'stake',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getStake',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'stakedAt', type: 'uint256' },
          { name: 'stakedBlock', type: 'uint256' },
          { name: 'lastActivityBlock', type: 'uint256' },
          { name: 'isStaked', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canReport',
    inputs: [{ name: 'reporter', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'openCase',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'caseId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: 'caseId', type: 'bytes32' },
      { name: 'position', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAllCaseIds',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
] as const;

const BAN_MANAGER_ABI = [
  {
    type: 'function',
    name: 'isAddressBanned',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

// Config - would come from environment in production
const getModerationConfig = () => ({
  moderationMarketplace: (process.env.NEXT_PUBLIC_JEJU_MODERATION_MARKETPLACE ||
    '0x0000000000000000000000000000000000000000') as Address,
  banManager: (process.env.NEXT_PUBLIC_BABYLON_BAN_MANAGER ||
    '0x0000000000000000000000000000000000000000') as Address,
});

/**
 * Hook to check if a user is banned
 */
export function useBanStatus(address: Address | undefined) {
  const [isBanned, setIsBanned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();
  const config = getModerationConfig();

  useEffect(() => {
    if (!address || !publicClient) {
      setIsLoading(false);
      return;
    }

    const checkBanStatus = async () => {
      setIsLoading(true);
      const banned = await publicClient.readContract({
        address: config.banManager,
        abi: BAN_MANAGER_ABI,
        functionName: 'isAddressBanned',
        args: [address],
      });
      setIsBanned(banned);
      setIsLoading(false);
    };

    checkBanStatus();
  }, [address, publicClient, config.banManager]);

  return { isBanned, isLoading };
}

/**
 * Hook to get user's stake in the moderation system
 */
export function useStake() {
  const { address } = useAccount();
  const [stake, setStake] = useState<StakeInfo | null>(null);
  const [canReport, setCanReport] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();
  const config = getModerationConfig();

  const refreshStake = useCallback(async () => {
    if (!address || !publicClient) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [stakeResult, canReportResult] = await Promise.all([
      publicClient.readContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'getStake',
        args: [address],
      }),
      publicClient.readContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'canReport',
        args: [address],
      }),
    ]);

    const { amount, stakedAt, isStaked } = stakeResult as {
      amount: bigint;
      stakedAt: bigint;
      stakedBlock: bigint;
      lastActivityBlock: bigint;
      isStaked: boolean;
    };

    setStake({
      amount,
      stakedAt: Number(stakedAt),
      isStaked,
    });
    setCanReport(canReportResult);
    setIsLoading(false);
  }, [address, publicClient, config.moderationMarketplace]);

  useEffect(() => {
    refreshStake();
  }, [refreshStake]);

  return { stake, canReport, isLoading, refreshStake };
}

/**
 * Hook to stake in the moderation system
 */
export function useStakeAction() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const config = getModerationConfig();

  const stake = useCallback(
    async (amount: bigint) => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return null;
      }

      setIsPending(true);
      setError(null);

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'stake',
        args: [],
        value: amount,
      });

      setIsPending(false);
      return hash;
    },
    [walletClient, address, config.moderationMarketplace]
  );

  return { stake, isPending, error };
}

/**
 * Hook to open a ban case
 */
export function useOpenCase() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const config = getModerationConfig();

  const openCase = useCallback(
    async (
      target: Address,
      reason: string,
      evidenceHash: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return null;
      }

      setIsPending(true);
      setError(null);

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'openCase',
        args: [target, reason, evidenceHash],
      });

      setIsPending(false);
      return hash;
    },
    [walletClient, address, config.moderationMarketplace]
  );

  return { openCase, isPending, error };
}

/**
 * Hook to vote on a ban case
 */
export function useVote() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const config = getModerationConfig();

  const vote = useCallback(
    async (caseId: `0x${string}`, position: VotePosition) => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return null;
      }

      setIsPending(true);
      setError(null);

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'vote',
        args: [caseId, position],
      });

      setIsPending(false);
      return hash;
    },
    [walletClient, address, config.moderationMarketplace]
  );

  return { vote, isPending, error };
}

/**
 * Hook to get all active moderation cases
 */
export function useActiveCases() {
  const [caseIds, setCaseIds] = useState<`0x${string}`[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();
  const config = getModerationConfig();

  const refreshCases = useCallback(async () => {
    if (!publicClient) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const ids = await publicClient.readContract({
      address: config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getAllCaseIds',
      args: [],
    });

    setCaseIds(ids as `0x${string}`[]);
    setIsLoading(false);
  }, [publicClient, config.moderationMarketplace]);

  useEffect(() => {
    refreshCases();
  }, [refreshCases]);

  return { caseIds, isLoading, refreshCases };
}

/**
 * Get status label for display
 */
export function getBanStatusLabel(status: BanStatus): string {
  switch (status) {
    case BanStatus.NONE:
      return 'Not Banned';
    case BanStatus.ON_NOTICE:
      return 'On Notice';
    case BanStatus.CHALLENGED:
      return 'Challenged';
    case BanStatus.BANNED:
      return 'Banned';
    case BanStatus.CLEARED:
      return 'Cleared';
    case BanStatus.APPEALING:
      return 'Appealing';
    default:
      return 'Unknown';
  }
}
