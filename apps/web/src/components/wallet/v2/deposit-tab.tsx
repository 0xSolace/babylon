'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface DepositTabProps {
  userId: string;
}

type FaucetStatus = 'idle' | 'loading' | 'success' | 'error';

export function DepositTab({ userId: _userId }: DepositTabProps) {
  const { getAccessToken, embeddedWalletAddress } = useAuth();
  const [amount, setAmount] = useState('10000');
  const [status, setStatus] = useState<FaucetStatus>('idle');
  const [result, setResult] = useState<{
    minted: number;
    balanceAfter: number;
    txHash: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '0');
  const isTestnet = chainId === 31337 || chainId === 84532;

  async function checkBalance() {
    if (!embeddedWalletAddress) return;
    setBalanceLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/admin/faucet?walletAddress=${embeddedWalletAddress}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      }
    } catch {
      // ignore
    } finally {
      setBalanceLoading(false);
    }
  }

  async function mintTestUsdc() {
    if (!embeddedWalletAddress) return;
    setStatus('loading');
    setError(null);
    setResult(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress: embeddedWalletAddress,
          amount: Number(amount),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || `Failed: ${response.status}`
        );
      }

      const data = await response.json();
      setResult(data);
      setBalance(data.balanceAfter);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  if (!isTestnet) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Deposit USDC</h3>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            To trade on-chain, send USDC to your embedded wallet address:
          </p>
          {embeddedWalletAddress ? (
            <div className="mt-3">
              <code className="block break-all rounded bg-background p-3 font-mono text-xs">
                {embeddedWalletAddress}
              </code>
              <p className="mt-2 text-muted-foreground text-xs">
                Send USDC on Base network to this address. Your balance will
                update automatically.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground text-sm">
              Connect your wallet to see your deposit address.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Test USDC Faucet</h3>
      <p className="text-muted-foreground text-sm">
        Mint test USDC to your wallet for trading on testnet.
      </p>

      {embeddedWalletAddress ? (
        <div className="space-y-4">
          {/* Wallet info */}
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">Your wallet</p>
                <code className="font-mono text-xs">
                  {embeddedWalletAddress.slice(0, 6)}...
                  {embeddedWalletAddress.slice(-4)}
                </code>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">USDC Balance</p>
                {balance !== null ? (
                  <p className="font-semibold text-sm">
                    ${balance.toLocaleString()}
                  </p>
                ) : (
                  <button
                    onClick={checkBalance}
                    disabled={balanceLoading}
                    className="text-primary text-xs underline"
                  >
                    {balanceLoading ? 'Checking...' : 'Check balance'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mint form */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="faucet-amount"
                className="mb-1 block text-muted-foreground text-xs"
              >
                Amount (USDC)
              </label>
              <input
                id="faucet-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="1"
                max="1000000"
              />
            </div>
            <button
              onClick={mintTestUsdc}
              disabled={status === 'loading' || !amount}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {status === 'loading' ? 'Minting...' : 'Mint Test USDC'}
            </button>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {[100, 1000, 10000, 100000].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
              >
                ${preset.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Success */}
          {status === 'success' && result && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <p className="font-medium text-green-600 text-sm">
                Minted ${result.minted.toLocaleString()} USDC
              </p>
              <p className="mt-1 text-green-600/80 text-xs">
                Balance: ${result.balanceAfter.toLocaleString()} USDC
              </p>
              <code className="mt-1 block text-green-600/60 text-xs">
                tx: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
              </code>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            Connect your wallet to use the faucet.
          </p>
        </div>
      )}
    </div>
  );
}
