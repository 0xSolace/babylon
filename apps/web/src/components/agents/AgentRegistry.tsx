'use client';

import { cn } from '@babylon/shared';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
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

function StatusBadge({
  registered,
  loading,
}: {
  registered: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking
      </span>
    );
  }
  return registered ? (
    <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 font-medium text-[10px] text-green-600">
      <Check className="h-3 w-3" />
      Registered
    </span>
  ) : (
    <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
      Not registered
    </span>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs">{children}</span>
    </div>
  );
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
    <div className="space-y-4">
      {/* EVM */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">EVM (ERC-8004)</span>
            <StatusBadge
              registered={evmStatus.isRegistered}
              loading={evmLoading}
            />
          </div>
        </div>

        <p className="mb-3 text-muted-foreground text-xs">
          Register on the ERC-8004 registry via Agent0 using the agent&apos;s
          EVM wallet.
        </p>

        <div className="space-y-1.5">
          <InfoRow label="Wallet">
            <span className="font-mono">
              {evmStatus.walletAddress
                ? `${evmStatus.walletAddress.slice(0, 6)}...${evmStatus.walletAddress.slice(-4)}`
                : 'Provisioned on registration'}
            </span>
          </InfoRow>
          {evmStatus.tokenId !== null && (
            <InfoRow label="Token ID">
              <span className="font-mono">{evmStatus.tokenId}</span>
            </InfoRow>
          )}
        </div>

        {evmError && <p className="mt-2 text-red-500 text-xs">{evmError}</p>}

        {!evmStatus.isRegistered && (
          <button
            type="button"
            onClick={handleEvmRegistration}
            disabled={evmRegistering || !evmStatus.canRegister}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
              'bg-[#0066FF] text-white hover:bg-[#2952d9]',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {evmRegistering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {evmRegistering
              ? 'Registering...'
              : `Register on EVM (${evmStatus.cost} pts)`}
          </button>
        )}
      </div>

      {/* Solana */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Solana (8004)</span>
            <StatusBadge
              registered={solanaStatus.isRegistered}
              loading={solanaLoading}
            />
          </div>
          {!solanaStatus.isRegistered && !solanaLoading && (
            <button
              type="button"
              onClick={() => void refreshSolanaStatus()}
              disabled={solanaLoading || solanaRegistering}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Refresh balance"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="mb-3 text-muted-foreground text-xs">
          Fund the agent&apos;s Solana wallet with SOL to cover network fees,
          then register on-chain.
        </p>

        {solanaError ? (
          <div className="space-y-2">
            <p className="rounded-lg bg-red-500/10 p-2 text-red-500 text-xs">
              {solanaError}
            </p>
            <button
              type="button"
              onClick={() => void refreshSolanaStatus()}
              className="rounded-lg border border-border px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <InfoRow label="Wallet">
                <span className="font-mono">
                  {solanaStatus.walletAddress
                    ? `${solanaStatus.walletAddress.slice(0, 6)}...${solanaStatus.walletAddress.slice(-4)}`
                    : 'Not provisioned'}
                </span>
              </InfoRow>
              <InfoRow label="Balance">
                {solanaStatus.walletBalanceSol !== null
                  ? `${solanaStatus.walletBalanceSol} SOL`
                  : '—'}
              </InfoRow>
              <InfoRow label="Required">
                {solanaStatus.minimumBalanceSol} SOL
              </InfoRow>
              <InfoRow label="Cost">{solanaStatus.cost} pts</InfoRow>
              {solanaStatus.assetId && (
                <InfoRow label="Asset">
                  <span className="font-mono">
                    {`${solanaStatus.assetId.slice(0, 6)}...${solanaStatus.assetId.slice(-4)}`}
                  </span>
                </InfoRow>
              )}
              {solanaStatus.txHash && (
                <InfoRow label="Tx">
                  <span className="font-mono">
                    {`${solanaStatus.txHash.slice(0, 6)}...${solanaStatus.txHash.slice(-4)}`}
                  </span>
                </InfoRow>
              )}
            </div>

            {/* Funding address */}
            {solanaStatus.walletAddress && !solanaStatus.isRegistered && (
              <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    Send at least {solanaStatus.minimumBalanceSol} SOL to fund
                    this wallet
                  </span>
                  <button
                    type="button"
                    onClick={copySolanaAddress}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-muted"
                    title="Copy address"
                  >
                    {copiedSolanaAddress ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedSolanaAddress ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <code className="block overflow-x-auto break-all rounded bg-background px-2 py-1.5 font-mono text-[11px]">
                  {solanaStatus.walletAddress}
                </code>
              </div>
            )}

            {/* Insufficient balance warning */}
            {!solanaStatus.isRegistered && !solanaStatus.hasEnoughBalance && (
              <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-amber-600 text-xs">
                {solanaStatus.walletBalanceSol !== null
                  ? `Insufficient balance: ${solanaStatus.walletBalanceSol} / ${solanaStatus.minimumBalanceSol} SOL`
                  : `Fund with at least ${solanaStatus.minimumBalanceSol} SOL`}
              </p>
            )}

            {!solanaStatus.isRegistered && (
              <button
                type="button"
                onClick={handleSolanaRegistration}
                disabled={
                  solanaRegistering ||
                  solanaStatus.isRegistered ||
                  !solanaStatus.canRegister
                }
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                  'bg-[#0066FF] text-white hover:bg-[#2952d9]',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {solanaRegistering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {solanaRegistering
                  ? 'Registering...'
                  : solanaStatus.canRegister
                    ? `Register on Solana (${solanaStatus.cost} pts)`
                    : `Fund wallet first`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
