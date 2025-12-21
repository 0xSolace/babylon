'use client';

/**
 * Airdrop Card Component
 *
 * Displays user's airdrop status, drip progress, and claim button.
 * Implements the daily 5% drip mechanism with visual progress tracking.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface AirdropStatus {
  success: boolean;
  registered: boolean;
  allocation?: {
    total: string;
    totalFormatted: string;
    bonusMultiplier: number;
    isElizaHolder: boolean;
  };
  drip?: {
    dripsUnlocked: number;
    totalDrips: number;
    percentUnlocked: number;
    canDripToday: boolean;
    nextDripTime: string | null;
    dailyAmount: string;
    dailyAmountFormatted: string;
  };
  claim?: {
    totalClaimed: string;
    totalClaimedFormatted: string;
    claimable: string;
    claimableFormatted: string;
    registeredOnChain: boolean;
  };
  message?: string;
}

export function AirdropCard() {
  const { isConnected } = useAccount();
  const [status, setStatus] = useState<AirdropStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dripLoading, setDripLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  // Fetch airdrop status
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/airdrop/status');
    const data = await response.json();

    if (data.success) {
      setStatus(data);
    } else {
      setError(data.message || 'Failed to fetch status');
    }

    setLoading(false);
  }, []);

  // Register for airdrop
  const handleRegister = async () => {
    setRegisterLoading(true);
    setError(null);

    const response = await fetch('/api/airdrop/register', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      await fetchStatus();
    } else {
      setError(data.message || 'Registration failed');
    }

    setRegisterLoading(false);
  };

  // Unlock daily drip
  const handleUnlockDrip = async () => {
    setDripLoading(true);
    setError(null);

    const response = await fetch('/api/airdrop/drip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'visit' }),
    });

    const data = await response.json();

    if (data.success && data.canDrip) {
      await fetchStatus();
    } else {
      setError(data.message || 'Drip unlock failed');
    }

    setDripLoading(false);
  };

  // Countdown timer
  useEffect(() => {
    const drip = status?.drip;
    if (!drip?.nextDripTime || drip.canDripToday) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const nextTime = new Date(drip.nextDripTime!).getTime();
      const now = Date.now();
      const diff = nextTime - now;

      if (diff <= 0) {
        setCountdown('');
        fetchStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [status?.drip, fetchStatus]);

  useEffect(() => {
    if (isConnected) {
      fetchStatus();
    }
  }, [isConnected, fetchStatus]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="font-bold text-gray-900 text-xl dark:text-white">
          BBLN Airdrop
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Connect your wallet to check your airdrop eligibility.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse">
          <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-4 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (!status?.registered) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="font-bold text-gray-900 text-xl dark:text-white">
          🎁 BBLN Airdrop
        </h2>

        {status?.allocation ? (
          <>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              You&apos;re eligible for the airdrop!
            </p>

            <div className="mt-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <p className="font-bold text-2xl text-green-600 dark:text-green-400">
                {status.allocation.totalFormatted}
              </p>
              <p className="text-green-600 text-sm dark:text-green-400">
                Your allocation
                {status.allocation.isElizaHolder &&
                  ' (includes ELIZA holder bonus!)'}
              </p>
            </div>

            <button
              onClick={handleRegister}
              disabled={registerLoading}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {registerLoading ? 'Registering...' : 'Register for Airdrop'}
            </button>
          </>
        ) : (
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {status?.message || 'Not eligible for airdrop'}
          </p>
        )}

        {error && (
          <p className="mt-2 text-red-600 text-sm dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  const drip = status.drip!;
  const claim = status.claim!;
  const allocation = status.allocation!;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-xl dark:text-white">
          🎁 BBLN Airdrop
        </h2>
        {allocation.isElizaHolder && (
          <span className="rounded-full bg-purple-100 px-2 py-1 font-medium text-purple-800 text-xs dark:bg-purple-900 dark:text-purple-200">
            ELIZA Holder
          </span>
        )}
      </div>

      {/* Allocation */}
      <div className="mt-4">
        <p className="text-gray-500 text-sm dark:text-gray-400">
          Total Allocation
        </p>
        <p className="font-bold text-2xl text-gray-900 dark:text-white">
          {allocation.totalFormatted}
        </p>
      </div>

      {/* Drip Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Drip Progress
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {drip.dripsUnlocked}/{drip.totalDrips} days ({drip.percentUnlocked}
            %)
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${drip.percentUnlocked}%` }}
          />
        </div>
      </div>

      {/* Daily Drip Button */}
      <div className="mt-4">
        {drip.canDripToday ? (
          <button
            onClick={handleUnlockDrip}
            disabled={dripLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
          >
            {dripLoading ? (
              'Unlocking...'
            ) : (
              <>🔓 Unlock Today&apos;s Drip ({drip.dailyAmountFormatted})</>
            )}
          </button>
        ) : drip.dripsUnlocked >= drip.totalDrips ? (
          <div className="rounded-lg bg-green-50 p-3 text-center text-green-700 dark:bg-green-900/20 dark:text-green-400">
            ✅ All drips unlocked!
          </div>
        ) : (
          <div className="rounded-lg bg-gray-100 p-3 text-center text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Next drip in:{' '}
            <span className="font-bold font-mono">{countdown}</span>
          </div>
        )}
      </div>

      {/* Claimable */}
      {BigInt(claim.claimable) > 0n && (
        <div className="mt-4 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Claimable
          </p>
          <p className="font-bold text-xl text-yellow-700 dark:text-yellow-400">
            {claim.claimableFormatted}
          </p>
          <button
            className="mt-2 w-full rounded-lg bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
            onClick={() => {
              // TODO: Implement on-chain claim
              alert('On-chain claiming coming soon!');
            }}
          >
            Claim Tokens
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Total Claimed</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {claim.totalClaimedFormatted}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Daily Drip</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {drip.dailyAmountFormatted}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-red-600 text-sm dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
