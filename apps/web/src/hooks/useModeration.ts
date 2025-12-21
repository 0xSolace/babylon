/**
 * @fileoverview React hooks for moderation system
 * @module hooks/useModeration
 *
 * Provides hooks for interacting with the Jeju ModerationMarketplace
 * and local moderation features.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
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

interface StakeResult {
  amount: bigint;
  stakedAt: bigint;
  stakedBlock: bigint;
  lastActivityBlock: bigint;
  isStaked: boolean;
}

/**
 * Hook to check if a user is banned
 */
export function useBanStatus(address: Address | undefined) {
  const publicClient = usePublicClient();
  const config = getModerationConfig();

  const { data: isBanned = false, isLoading } = useQuery({
    queryKey: ['banStatus', address],
    queryFn: async (): Promise<boolean> => {
      const banned = await publicClient!.readContract({
        address: config.banManager,
        abi: BAN_MANAGER_ABI,
        functionName: 'isAddressBanned',
        args: [address!],
      });
      return banned;
    },
    enabled: !!address && !!publicClient,
    staleTime: 60000,
  });

  return { isBanned, isLoading };
}

/**
 * Hook to get user's stake in the moderation system
 */
export function useStake() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const config = getModerationConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['moderationStake', address],
    queryFn: async (): Promise<{ stake: StakeInfo; canReport: boolean }> => {
      const [stakeResult, canReportResult] = await Promise.all([
        publicClient!.readContract({
          address: config.moderationMarketplace,
          abi: MODERATION_MARKETPLACE_ABI,
          functionName: 'getStake',
          args: [address!],
        }),
        publicClient!.readContract({
          address: config.moderationMarketplace,
          abi: MODERATION_MARKETPLACE_ABI,
          functionName: 'canReport',
          args: [address!],
        }),
      ]);

      const { amount, stakedAt, isStaked } = stakeResult as StakeResult;

      return {
        stake: {
          amount,
          stakedAt: Number(stakedAt),
          isStaked,
        },
        canReport: canReportResult,
      };
    },
    enabled: !!address && !!publicClient,
    staleTime: 30000,
  });

  const refreshStake = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['moderationStake', address],
    });
  }, [queryClient, address]);

  return {
    stake: data?.stake ?? null,
    canReport: data?.canReport ?? false,
    isLoading,
    refreshStake,
  };
}

/**
 * Hook to stake in the moderation system
 */
export function useStakeAction() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const config = getModerationConfig();

  const mutation = useMutation({
    mutationFn: async (amount: bigint): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'stake',
        args: [],
        value: amount,
      });

      return hash;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['moderationStake', address],
      });
    },
  });

  const stake = useCallback(
    async (amount: bigint) => {
      return mutation.mutateAsync(amount);
    },
    [mutation]
  );

  return {
    stake,
    isPending: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}

/**
 * Hook to open a ban case
 */
export function useOpenCase() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const config = getModerationConfig();

  const mutation = useMutation({
    mutationFn: async ({
      target,
      reason,
      evidenceHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    }: {
      target: Address;
      reason: string;
      evidenceHash?: `0x${string}`;
    }): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'openCase',
        args: [target, reason, evidenceHash],
      });

      return hash;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activeCases'] });
    },
  });

  const openCase = useCallback(
    async (target: Address, reason: string, evidenceHash?: `0x${string}`) => {
      return mutation.mutateAsync({ target, reason, evidenceHash });
    },
    [mutation]
  );

  return {
    openCase,
    isPending: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}

/**
 * Hook to vote on a ban case
 */
export function useVote() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const config = getModerationConfig();

  const mutation = useMutation({
    mutationFn: async ({
      caseId,
      position,
    }: {
      caseId: `0x${string}`;
      position: VotePosition;
    }): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'vote',
        args: [caseId, position],
      });

      return hash;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activeCases'] });
    },
  });

  const vote = useCallback(
    async (caseId: `0x${string}`, position: VotePosition) => {
      return mutation.mutateAsync({ caseId, position });
    },
    [mutation]
  );

  return {
    vote,
    isPending: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}

/**
 * Hook to get all active moderation cases
 */
export function useActiveCases() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const config = getModerationConfig();

  const { data: caseIds = [], isLoading } = useQuery({
    queryKey: ['activeCases'],
    queryFn: async (): Promise<`0x${string}`[]> => {
      const ids = await publicClient!.readContract({
        address: config.moderationMarketplace,
        abi: MODERATION_MARKETPLACE_ABI,
        functionName: 'getAllCaseIds',
        args: [],
      });

      return ids as `0x${string}`[];
    },
    enabled: !!publicClient,
    staleTime: 60000,
  });

  const refreshCases = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['activeCases'] });
  }, [queryClient]);

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
