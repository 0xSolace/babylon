'use client';

import { cn } from '@babylon/shared';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface SolanaRegistrationStatus {
  isRegistered: boolean;
  assetId: string | null;
  metadataUri: string | null;
  txHash: string | null;
  walletAddress: string | null;
  walletReady: boolean;
  walletBalanceLamports: string | null;
  walletBalanceSol: string | null;
  minimumBalanceLamports: string;
  minimumBalanceSol: string;
  hasEnoughBalance: boolean;
  canRegister: boolean;
  cost: number;
}

interface EvmRegistrationStatus {
  isRegistered: boolean;
  tokenId: number | null;
  metadataCid: string | null;
  txHash: string | null;
  walletAddress: string | null;
  walletReady: boolean;
  canRegister: boolean;
  cost: number;
}

interface AgentRegistryProps {
  agent: {
    id: string;
    name: string;
  };
  onUpdate: () => void;
}

export function AgentRegistry({ agent, onUpdate }: AgentRegistryProps) {
  const { getAccessToken } = useAuth();

  const [solanaStatus, setSolanaStatus] = useState<SolanaRegistrationStatus>({
    isRegistered: false,
    assetId: null,
    metadataUri: null,
    txHash: null,
    walletAddress: null,
    walletReady: false,
    walletBalanceLamports: null,
    walletBalanceSol: null,
    minimumBalanceLamports: '0',
    minimumBalanceSol: '0',
    hasEnoughBalance: false,
    canRegister: false,
    cost: 0,
  });
  const [solanaLoading, setSolanaLoading] = useState(false);
  const [solanaRegistering, setSolanaRegistering] = useState(false);
  const [solanaError, setSolanaError] = useState<string | null>(null);
  const [copiedSolanaAddress, setCopiedSolanaAddress] = useState(false);
  const [evmStatus, setEvmStatus] = useState<EvmRegistrationStatus>({
    isRegistered: false,
    tokenId: null,
    metadataCid: null,
    txHash: null,
    walletAddress: null,
    walletReady: false,
    canRegister: false,
    cost: 0,
  });
  const [evmLoading, setEvmLoading] = useState(false);
  const [evmRegistering, setEvmRegistering] = useState(false);
  const [evmError, setEvmError] = useState<string | null>(null);

  const fetchSolanaStatus = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const res = await fetch(`/api/agents/${agent.id}/solana-registration`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(
        'Failed to fetch Solana registration status. Check Solana configuration and try again.'
      );
    }

    const data = await res.json();
    setSolanaStatus(data);
  }, [agent.id, getAccessToken]);

  const fetchEvmStatus = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const res = await fetch(`/api/agents/${agent.id}/evm-registration`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(
        'Failed to fetch EVM registration status. Check Agent0 configuration and try again.'
      );
    }

    const data = await res.json();
    setEvmStatus(data);
  }, [agent.id, getAccessToken]);

  const refreshSolanaStatus = useCallback(async () => {
    setSolanaLoading(true);
    setSolanaError(null);

    try {
      await fetchSolanaStatus();
    } catch (error) {
      setSolanaError(
        error instanceof Error
          ? error.message
          : 'Failed to load Solana registration status'
      );
    } finally {
      setSolanaLoading(false);
    }
  }, [fetchSolanaStatus]);

  const refreshEvmStatus = useCallback(async () => {
    setEvmLoading(true);
    setEvmError(null);

    try {
      await fetchEvmStatus();
    } catch (error) {
      setEvmError(
        error instanceof Error
          ? error.message
          : 'Failed to load EVM registration status'
      );
    } finally {
      setEvmLoading(false);
    }
  }, [fetchEvmStatus]);

  useEffect(() => {
    void refreshSolanaStatus();
  }, [refreshSolanaStatus]);

  useEffect(() => {
    void refreshEvmStatus();
  }, [refreshEvmStatus]);

  const handleSolanaRegistration = async () => {
    setSolanaRegistering(true);
    const token = await getAccessToken();
    if (!token) {
      setSolanaRegistering(false);
      toast.error('Authentication required');
      return;
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}/solana-registration`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to register agent on Solana');
      }

      toast.success(payload.message);
      setSolanaError(null);
      await fetchSolanaStatus();
      onUpdate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to register agent on Solana'
      );
    } finally {
      setSolanaRegistering(false);
    }
  };

  const handleEvmRegistration = async () => {
    setEvmRegistering(true);
    const token = await getAccessToken();
    if (!token) {
      setEvmRegistering(false);
      toast.error('Authentication required');
      return;
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}/evm-registration`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to register agent on EVM');
      }

      toast.success(payload.message);
      setEvmError(null);
      await fetchEvmStatus();
      onUpdate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to register agent on EVM'
      );
    } finally {
      setEvmRegistering(false);
    }
  };

  const copySolanaAddress = async () => {
    if (!solanaStatus.walletAddress) return;

    try {
      await navigator.clipboard.writeText(solanaStatus.walletAddress);
      setCopiedSolanaAddress(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopiedSolanaAddress(false), 2000);
    } catch {
      toast.error('Failed to copy address to clipboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* EVM Registry */}
      <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">EVM Registry</h3>
            <p className="text-muted-foreground text-sm">
              Register this Babylon agent on the ERC-8004 registry via Agent0.
              Registration is owner-managed and uses the agent&apos;s EVM
              wallet.
            </p>
          </div>
          <div
            className={cn(
              'rounded-full px-3 py-1 font-medium text-xs',
              evmStatus.isRegistered
                ? 'bg-green-500/15 text-green-600'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {evmLoading
              ? 'Loading...'
              : evmStatus.isRegistered
                ? 'Registered'
                : 'Not registered'}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Wallet:{' '}
              <span className="font-mono text-foreground">
                {evmStatus.walletAddress ?? 'Provisioned on first registration'}
              </span>
            </span>
            {evmStatus.tokenId !== null && (
              <span className="text-muted-foreground">
                Token ID:{' '}
                <span className="font-mono text-foreground">
                  {evmStatus.tokenId}
                </span>
              </span>
            )}
          </div>

          {!evmStatus.isRegistered && (
            <button
              type="button"
              onClick={handleEvmRegistration}
              disabled={evmRegistering || !evmStatus.canRegister}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-[#0055DD] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {evmRegistering ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Register on EVM ({evmStatus.cost} pts)
                </>
              )}
            </button>
          )}

          {evmError && <p className="text-red-500 text-xs">{evmError}</p>}
        </div>
      </div>

      {/* Solana Registry */}
      <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">Solana Registry</h3>
            <p className="text-muted-foreground text-sm">
              Fund your agent&apos;s Solana wallet with enough SOL to cover
              network fees, then register it on the Solana 8004 registry.
              Babylon still handles metadata publishing.
            </p>
          </div>
          <div
            className={cn(
              'rounded-full px-3 py-1 font-medium text-xs',
              solanaStatus.isRegistered
                ? 'bg-green-500/10 text-green-600'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {solanaStatus.isRegistered ? 'Registered' : 'Not registered'}
          </div>
        </div>

        {solanaLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : solanaError ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-red-600 text-sm">
              {solanaError}
            </div>
            <button
              onClick={() => void refreshSolanaStatus()}
              className="h-10 rounded-lg bg-muted px-4 font-medium text-sm transition-all hover:bg-muted/80"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Wallet</span>
                <div className="font-medium">
                  {solanaStatus.walletAddress
                    ? `${solanaStatus.walletAddress.slice(0, 6)}...${solanaStatus.walletAddress.slice(-4)}`
                    : solanaStatus.walletReady
                      ? 'Ready'
                      : 'Not provisioned'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">SOL balance</span>
                <div className="font-medium">
                  {solanaStatus.walletBalanceSol !== null
                    ? `${solanaStatus.walletBalanceSol} SOL`
                    : 'Unavailable'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Required</span>
                <div className="font-medium">
                  {solanaStatus.minimumBalanceSol} SOL
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Cost</span>
                <div className="font-medium">{solanaStatus.cost} pts</div>
              </div>
              <div>
                <span className="text-muted-foreground">Asset</span>
                <div className="font-medium">
                  {solanaStatus.assetId
                    ? `${solanaStatus.assetId.slice(0, 6)}...${solanaStatus.assetId.slice(-4)}`
                    : 'Not registered'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Tx</span>
                <div className="font-medium">
                  {solanaStatus.txHash
                    ? `${solanaStatus.txHash.slice(0, 6)}...${solanaStatus.txHash.slice(-4)}`
                    : 'Pending / none'}
                </div>
              </div>
            </div>

            {solanaStatus.walletAddress ? (
              <div className="rounded-lg border border-[#0066FF]/20 bg-[#0066FF]/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">
                      Agent funding address
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Send at least {solanaStatus.minimumBalanceSol} SOL to this
                      wallet before registering.
                    </div>
                  </div>
                  <button
                    onClick={copySolanaAddress}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all hover:bg-muted"
                    title="Copy address"
                  >
                    <span className="flex items-center gap-2">
                      {copiedSolanaAddress ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedSolanaAddress ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <code className="block overflow-x-auto rounded bg-background/80 p-3 text-xs">
                  {solanaStatus.walletAddress}
                </code>
              </div>
            ) : null}

            {!solanaStatus.isRegistered && !solanaStatus.hasEnoughBalance ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-amber-700 text-sm">
                {solanaStatus.walletBalanceSol !== null
                  ? `Fund this wallet first. Current balance: ${solanaStatus.walletBalanceSol} SOL. Required: ${solanaStatus.minimumBalanceSol} SOL.`
                  : `Fund this wallet with at least ${solanaStatus.minimumBalanceSol} SOL before registering.`}
              </div>
            ) : null}

            {!solanaStatus.isRegistered ? (
              <button
                onClick={() => void refreshSolanaStatus()}
                disabled={solanaLoading || solanaRegistering}
                className="h-10 rounded-lg border border-border bg-background px-4 font-medium text-sm transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh balance
              </button>
            ) : null}

            <button
              onClick={handleSolanaRegistration}
              disabled={
                solanaRegistering ||
                solanaStatus.isRegistered ||
                !solanaStatus.canRegister
              }
              className="h-10 rounded-lg bg-[#0066FF] px-4 font-medium text-sm text-white transition-all hover:bg-[#2952d9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {solanaRegistering
                ? 'Registering...'
                : solanaStatus.isRegistered
                  ? 'Already registered'
                  : solanaStatus.canRegister
                    ? `Register on Solana (${solanaStatus.cost} pts)`
                    : `Fund wallet with ${solanaStatus.minimumBalanceSol} SOL`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
