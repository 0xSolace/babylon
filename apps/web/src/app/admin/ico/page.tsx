/**
 * ICO Admin Dashboard
 *
 * @description Admin interface for managing the BBLN token ICO
 * - Real-time ICO status and analytics
 * - Presale controls (start, pause, finalize)
 * - Contributor tracking and management
 * - Treasury and LP configuration
 *
 * @page /admin/ico
 * @access Admin only
 */

'use client';

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  Coins,
  Crown,
  DollarSign,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  custom,
  type EIP1193Provider,
  formatEther,
} from 'viem';
import { hardhat, mainnet, sepolia } from 'viem/chains';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/hooks/useAuth';

// Types
interface ICOStatus {
  raised: bigint;
  participants: bigint;
  progress: bigint;
  timeRemaining: bigint;
  isActive: boolean;
  isFinalized: boolean;
  isFailed: boolean;
}

interface Contributor {
  address: string;
  ethAmount: bigint;
  tokenAllocation: bigint;
  isElizaHolder: boolean;
}

interface ICOConfig {
  softCap: bigint;
  hardCap: bigint;
  minContribution: bigint;
  maxContribution: bigint;
  startPrice: bigint;
  currentPrice: bigint;
  lpFundingBps: number;
  elizaBonusBps: number;
}

// BBLN Presale ABI
const PRESALE_ABI = [
  {
    name: 'getStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'raised', type: 'uint256' },
      { name: 'participants', type: 'uint256' },
      { name: 'progress', type: 'uint256' },
      { name: 'timeRemaining', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isFinalized', type: 'bool' },
      { name: 'isFailed', type: 'bool' },
    ],
  },
  {
    name: 'getContributors',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'contributions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAllocation', type: 'uint256' },
      { name: 'elizaBonus', type: 'uint256' },
      { name: 'claimedTokens', type: 'uint256' },
      { name: 'isElizaHolder', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
  },
  {
    name: 'softCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'hardCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'minContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'maxContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'startPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'lpFundingBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'elizaBonusBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'startPresale',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'duration', type: 'uint256' },
      { name: 'claimDelay', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'startPresaleNow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'finalize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const;

// Get chain config from env
function getChainConfig() {
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337');
  switch (chainId) {
    case 1:
      return mainnet;
    case 11155111:
      return sepolia;
    default:
      return hardhat;
  }
}

// Helper to get ethereum provider
function getEthereumProvider(): EIP1193Provider | null {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum ?? null;
}

// Fetch ICO data from blockchain
interface ICOData {
  status: ICOStatus;
  config: ICOConfig;
  contributors: Contributor[];
  isPaused: boolean;
}

async function fetchICODataFromChain(
  presaleAddress: Address,
  chain: ReturnType<typeof getChainConfig>
): Promise<ICOData> {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error('No ethereum provider found');
  }

  const client = createPublicClient({
    chain,
    transport: custom(ethereum),
  });

  // Fetch status
  const statusResult = (await client.readContract({
    address: presaleAddress,
    abi: PRESALE_ABI,
    functionName: 'getStatus',
  })) as [bigint, bigint, bigint, bigint, boolean, boolean, boolean];

  const status: ICOStatus = {
    raised: statusResult[0],
    participants: statusResult[1],
    progress: statusResult[2],
    timeRemaining: statusResult[3],
    isActive: statusResult[4],
    isFinalized: statusResult[5],
    isFailed: statusResult[6],
  };

  // Fetch config
  const [
    softCap,
    hardCap,
    minContribution,
    maxContribution,
    startPrice,
    currentPrice,
    lpFundingBps,
    elizaBonusBps,
    paused,
  ] = (await Promise.all([
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'softCap',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'hardCap',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'minContribution',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'maxContribution',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'startPrice',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'getCurrentPrice',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'lpFundingBps',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'elizaBonusBps',
    }),
    client.readContract({
      address: presaleAddress,
      abi: PRESALE_ABI,
      functionName: 'paused',
    }),
  ])) as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  const config: ICOConfig = {
    softCap,
    hardCap,
    minContribution,
    maxContribution,
    startPrice,
    currentPrice,
    lpFundingBps: Number(lpFundingBps),
    elizaBonusBps: Number(elizaBonusBps),
  };

  // Fetch contributors
  const contributorAddresses = (await client.readContract({
    address: presaleAddress,
    abi: PRESALE_ABI,
    functionName: 'getContributors',
  })) as readonly Address[];

  const contributors = await Promise.all(
    contributorAddresses.slice(0, 100).map(async (addr) => {
      const contribution = (await client.readContract({
        address: presaleAddress,
        abi: PRESALE_ABI,
        functionName: 'contributions',
        args: [addr],
      })) as [bigint, bigint, bigint, bigint, boolean, boolean];

      return {
        address: addr,
        ethAmount: contribution[0],
        tokenAllocation: contribution[1] + contribution[2], // base + bonus
        isElizaHolder: contribution[4],
      };
    })
  );

  return { status, config, contributors, isPaused: paused };
}

export default function ICOAdminPage() {
  const { authenticated, ready } = useAuth();
  const queryClient = useQueryClient();

  // Settings (local form state only)
  const [presaleDuration, setPresaleDuration] = useState(7);
  const [claimDelay, setClaimDelay] = useState(1);

  const presaleAddress = process.env.NEXT_PUBLIC_BBLN_PRESALE_ADDRESS as
    | Address
    | undefined;
  const chain = getChainConfig();

  // Query: Admin access check
  const { data: isAuthorized, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['admin', 'ico', 'access'],
    queryFn: async () => {
      if (!authenticated) return false;
      const response = await fetch('/api/admin/stats');
      return response.ok;
    },
    enabled: ready,
  });

  // Query: ICO data with polling
  const {
    data: icoData,
    isLoading: isLoadingICO,
    isFetching: isRefreshing,
    refetch: refetchICOData,
  } = useQuery({
    queryKey: ['admin', 'ico', 'data', presaleAddress],
    queryFn: () => {
      if (!presaleAddress) throw new Error('No presale address');
      return fetchICODataFromChain(presaleAddress, chain);
    },
    enabled: isAuthorized === true && !!presaleAddress,
    refetchInterval: 30000, // Poll every 30s
  });

  const status = icoData?.status ?? null;
  const config = icoData?.config ?? null;
  const contributors = icoData?.contributors ?? [];
  const isPaused = icoData?.isPaused ?? false;

  // Mutation: Start presale
  const startPresaleMutation = useMutation({
    mutationFn: async () => {
      const ethereum = getEthereumProvider();
      if (!presaleAddress || !ethereum) {
        throw new Error('No presale address or ethereum provider');
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(ethereum),
      });

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('No account found');

      const duration = BigInt(presaleDuration * 24 * 60 * 60);
      const delay = BigInt(claimDelay * 24 * 60 * 60);

      await walletClient.writeContract({
        account,
        address: presaleAddress,
        abi: PRESALE_ABI,
        functionName: 'startPresale',
        args: [duration, delay],
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'ico', 'data'],
      });
    },
  });

  // Mutation: Pause/Unpause presale
  const pausePresaleMutation = useMutation({
    mutationFn: async () => {
      const ethereum = getEthereumProvider();
      if (!presaleAddress || !ethereum) {
        throw new Error('No presale address or ethereum provider');
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(ethereum),
      });

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('No account found');

      await walletClient.writeContract({
        account,
        address: presaleAddress,
        abi: PRESALE_ABI,
        functionName: isPaused ? 'unpause' : 'pause',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'ico', 'data'],
      });
    },
  });

  // Mutation: Finalize presale
  const finalizePresaleMutation = useMutation({
    mutationFn: async () => {
      const ethereum = getEthereumProvider();
      if (!presaleAddress || !ethereum) {
        throw new Error('No presale address or ethereum provider');
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(ethereum),
      });

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('No account found');

      await walletClient.writeContract({
        account,
        address: presaleAddress,
        abi: PRESALE_ABI,
        functionName: 'finalize',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'ico', 'data'],
      });
    },
  });

  const isActionPending =
    startPresaleMutation.isPending ||
    pausePresaleMutation.isPending ||
    finalizePresaleMutation.isPending;

  if (isCheckingAuth || (isAuthorized && isLoadingICO)) {
    return (
      <PageContainer>
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-64 w-full max-w-4xl" />
        </div>
      </PageContainer>
    );
  }

  if (!isAuthorized) {
    return (
      <PageContainer>
        <div className="flex h-full flex-col items-center justify-center">
          <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 font-bold text-2xl">Access Denied</h1>
          <p className="text-muted-foreground">Admin access required.</p>
        </div>
      </PageContainer>
    );
  }

  if (!presaleAddress) {
    return (
      <PageContainer>
        <div className="flex h-full flex-col items-center justify-center">
          <AlertTriangle className="mb-4 h-16 w-16 text-yellow-500" />
          <h1 className="mb-2 font-bold text-2xl">Presale Not Deployed</h1>
          <p className="text-muted-foreground">
            Set NEXT_PUBLIC_BBLN_PRESALE_ADDRESS
          </p>
        </div>
      </PageContainer>
    );
  }

  const formatDuration = (seconds: bigint): string => {
    if (seconds <= 0n) return 'Ended';
    const secs = Number(seconds);
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const getStatusBadge = () => {
    if (status?.isFailed) return { text: 'FAILED', color: 'bg-red-500' };
    if (status?.isFinalized)
      return { text: 'FINALIZED', color: 'bg-green-500' };
    if (isPaused) return { text: 'PAUSED', color: 'bg-yellow-500' };
    if (status?.isActive) return { text: 'ACTIVE', color: 'bg-emerald-500' };
    return { text: 'NOT STARTED', color: 'bg-gray-500' };
  };

  const statusBadge = getStatusBadge();

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Coins className="h-8 w-8 text-primary" />
            <h1 className="font-bold text-3xl">ICO Management</h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 font-medium text-sm text-white',
                statusBadge.color
              )}
            >
              {statusBadge.text}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            BBLN Token Presale Administration
          </p>
        </div>
        <button
          onClick={() => refetchICOData()}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 transition-colors hover:bg-muted/80"
        >
          <RefreshCw
            className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
          />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total Raised"
          value={status ? `${formatEther(status.raised)} ETH` : '--'}
          subtext={
            config ? `of ${formatEther(config.hardCap)} ETH hard cap` : ''
          }
        />
        <StatCard
          icon={Users}
          label="Contributors"
          value={status ? status.participants.toString() : '--'}
          subtext="unique wallets"
        />
        <StatCard
          icon={TrendingUp}
          label="Progress"
          value={
            status ? `${(Number(status.progress) / 100).toFixed(1)}%` : '--'
          }
          subtext={config ? `Soft cap: ${formatEther(config.softCap)} ETH` : ''}
        />
        <StatCard
          icon={Wallet}
          label="Current Price"
          value={config ? `${formatEther(config.currentPrice)} ETH` : '--'}
          subtext="per BBLN"
        />
      </div>

      {/* Progress Bar */}
      {status && config && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-2 flex justify-between text-sm">
            <span>Fundraising Progress</span>
            <span>
              {formatEther(status.raised)} / {formatEther(config.hardCap)} ETH
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Number(status.progress) / 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-muted-foreground text-xs">
            <span>Soft Cap: {formatEther(config.softCap)} ETH</span>
            <span>Time Remaining: {formatDuration(status.timeRemaining)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Presale Controls */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
            <Settings className="h-5 w-5" />
            Presale Controls
          </h2>

          {!status?.isActive && !status?.isFinalized && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm">Duration (days)</label>
                <input
                  type="number"
                  value={presaleDuration}
                  onChange={(e) =>
                    setPresaleDuration(parseInt(e.target.value) || 7)
                  }
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  min={1}
                  max={30}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Claim Delay (days)</label>
                <input
                  type="number"
                  value={claimDelay}
                  onChange={(e) => setClaimDelay(parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  min={0}
                  max={7}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!status?.isActive && !status?.isFinalized && (
              <button
                onClick={() => startPresaleMutation.mutate()}
                disabled={isActionPending}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {startPresaleMutation.isPending
                  ? 'Starting...'
                  : 'Start Presale'}
              </button>
            )}

            {status?.isActive && !status?.isFinalized && (
              <button
                onClick={() => pausePresaleMutation.mutate()}
                disabled={isActionPending}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors disabled:opacity-50',
                  isPaused
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                )}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                {pausePresaleMutation.isPending
                  ? 'Processing...'
                  : isPaused
                    ? 'Unpause'
                    : 'Pause'}
              </button>
            )}

            {status?.isActive &&
              !status?.isFinalized &&
              status.timeRemaining === 0n && (
                <button
                  onClick={() => finalizePresaleMutation.mutate()}
                  disabled={isActionPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Crown className="h-4 w-4" />
                  {finalizePresaleMutation.isPending
                    ? 'Finalizing...'
                    : 'Finalize Presale'}
                </button>
              )}
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
            <Settings className="h-5 w-5" />
            Configuration
          </h2>

          {config && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <ConfigItem
                label="Soft Cap"
                value={`${formatEther(config.softCap)} ETH`}
              />
              <ConfigItem
                label="Hard Cap"
                value={`${formatEther(config.hardCap)} ETH`}
              />
              <ConfigItem
                label="Min Contribution"
                value={`${formatEther(config.minContribution)} ETH`}
              />
              <ConfigItem
                label="Max Contribution"
                value={`${formatEther(config.maxContribution)} ETH`}
              />
              <ConfigItem
                label="Start Price"
                value={`${formatEther(config.startPrice)} ETH`}
              />
              <ConfigItem
                label="LP Funding"
                value={`${config.lpFundingBps / 100}%`}
              />
              <ConfigItem
                label="ELIZA Bonus"
                value={`${config.elizaBonusBps / 100}%`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Contributors Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-lg">
            <Users className="h-5 w-5" />
            Contributors ({contributors.length})
          </h2>
          <a
            href={`https://etherscan.io/address/${presaleAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary text-sm hover:underline"
          >
            View on Explorer <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b text-left text-muted-foreground">
                <th className="pr-4 pb-3">Address</th>
                <th className="pr-4 pb-3 text-right">ETH Amount</th>
                <th className="pr-4 pb-3 text-right">Token Allocation</th>
                <th className="pb-3 text-center">ELIZA Holder</th>
              </tr>
            </thead>
            <tbody>
              {contributors.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No contributors yet
                  </td>
                </tr>
              ) : (
                contributors.map((c) => (
                  <tr
                    key={c.address}
                    className="border-border border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-mono text-xs">
                      {c.address.slice(0, 8)}...{c.address.slice(-6)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatEther(c.ethAmount)} ETH
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatEther(c.tokenAllocation)} BBLN
                    </td>
                    <td className="py-3 text-center">
                      {c.isElizaHolder && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-purple-400 text-xs">
                          <Crown className="h-3 w-3" /> +50%
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="font-bold text-2xl">{value}</div>
      <div className="text-muted-foreground text-xs">{subtext}</div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-2 font-medium">{value}</span>
    </div>
  );
}
