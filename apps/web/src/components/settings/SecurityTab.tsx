'use client';

import { logger } from '@babylon/shared';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Copy, ExternalLink, Key } from 'lucide-react';
import { toast } from 'sonner';
import { isPrivyLinkFlowCancellationError } from '@/lib/privy-link-account-errors';

/**
 * Security tab component for managing account security settings.
 *
 * Provides settings for managing connected wallets, authentication methods,
 * and account security. Displays wallet information, allows wallet linking/unlinking,
 * and provides logout functionality. Shows Privy authentication details.
 *
 * Features:
 * - Wallet management (link/unlink)
 * - Wallet export (for embedded wallets)
 * - Authentication method display
 * - Logout functionality
 * - Copy to clipboard utilities
 *
 * @returns Security tab element
 */
export function SecurityTab() {
  const {
    user: privyUser,
    linkWallet,
    unlinkWallet,
    exportWallet,
  } = usePrivy();
  const { wallets } = useWallets();

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const getErrorMessage = (error: unknown) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
  };

  const handleWalletActionError = (
    action: 'link' | 'unlink' | 'export',
    error: unknown
  ) => {
    const errorMessage = getErrorMessage(error);

    if (isPrivyLinkFlowCancellationError(error)) {
      logger.info(
        'Wallet action cancelled in Privy flow',
        {
          action,
          error: errorMessage,
          privyUserId: privyUser?.id,
        },
        'SecurityTab'
      );
      return;
    }

    logger.error(
      'Wallet action failed in Privy flow',
      {
        action,
        error: errorMessage,
        privyUserId: privyUser?.id,
      },
      'SecurityTab'
    );

    switch (action) {
      case 'link':
        toast.error('Failed to link wallet. Please try again.');
        return;
      case 'unlink':
        toast.error('Failed to unlink wallet. Please try again.');
        return;
      case 'export':
        toast.error('Failed to export wallet. Please try again.');
        return;
    }
  };

  const handleLinkWallet = async () => {
    if (!linkWallet) return;
    try {
      await linkWallet();
    } catch (error) {
      handleWalletActionError('link', error);
    }
  };

  const handleExportWallet = async (address: string) => {
    if (!exportWallet) return;
    try {
      await exportWallet({ address });
    } catch (error) {
      handleWalletActionError('export', error);
    }
  };

  const handleUnlinkWallet = async (address: string) => {
    if (!unlinkWallet) return;
    try {
      await unlinkWallet(address);
    } catch (error) {
      handleWalletActionError('unlink', error);
    }
  };

  const getWalletTypeDisplay = (walletClientType: string) => {
    switch (walletClientType) {
      case 'privy':
      case 'privy-v2':
        return 'Embedded Wallet';
      case 'metamask':
        return 'MetaMask';
      case 'coinbase_wallet':
        return 'Coinbase Wallet';
      case 'rainbow':
        return 'Rainbow';
      case 'rabby_wallet':
        return 'Rabby';
      default:
        return 'External Wallet';
    }
  };

  const isEmbeddedWallet = (walletClientType: string) => {
    return walletClientType === 'privy' || walletClientType === 'privy-v2';
  };

  return (
    <div className="space-y-6">
      {/* Authentication Info */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold">Account Security</h3>
        {privyUser && (
          <div className="mt-3 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">User ID: </span>
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {privyUser.id}
              </code>
            </div>
            {privyUser.email && (
              <div className="text-sm">
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{privyUser.email.address}</span>
              </div>
            )}
            {privyUser.farcaster && (
              <div className="text-sm">
                <span className="text-muted-foreground">Farcaster: </span>
                <span className="font-medium">
                  @{privyUser.farcaster.username}
                </span>
              </div>
            )}
            {privyUser.twitter && (
              <div className="text-sm">
                <span className="text-muted-foreground">X: </span>
                <span className="font-medium">
                  @{privyUser.twitter.username}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected Wallets */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Connected Wallets</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Manage your blockchain wallets and authentication methods
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleLinkWallet()}
            className="rounded-lg bg-[#0066FF] px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-[#0066FF]/90"
          >
            Link Wallet
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No wallets connected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.address}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">
                      {getWalletTypeDisplay(wallet.walletClientType)}
                    </span>
                    {isEmbeddedWallet(wallet.walletClientType) && (
                      <span className="rounded bg-[#0066FF]/20 px-2 py-0.5 text-[#0066FF] text-xs">
                        Embedded
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-muted-foreground text-xs">
                      {wallet.address.slice(0, 6)}...
                      {wallet.address.slice(-4)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(wallet.address)}
                      className="rounded p-1 hover:bg-background"
                      title="Copy full address"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEmbeddedWallet(wallet.walletClientType) ? (
                    <button
                      type="button"
                      onClick={() => void handleExportWallet(wallet.address)}
                      className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 font-medium text-xs hover:bg-accent"
                      title="Export wallet private key"
                    >
                      <Key className="h-3 w-3" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  ) : null}
                  {wallets.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => void handleUnlinkWallet(wallet.address)}
                      className="rounded px-3 py-1.5 font-medium text-red-500 text-xs hover:bg-red-500/10"
                    >
                      Unlink
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">Embedded wallets</strong> are
            created and managed by Privy, enabling gasless transactions. You can
            export your private key at any time.{' '}
            <strong className="text-foreground">External wallets</strong>{' '}
            require you to pay gas fees.
          </p>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold">Security Resources</h3>
        <div className="mt-1 space-y-2">
          <a
            href="https://docs.privy.io/guide/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#0066FF] text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Privy Security Documentation
          </a>
          <a
            href="https://docs.babylon.market/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#0066FF] text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Babylon Security Best Practices
          </a>
        </div>
        <p className="mt-3 text-muted-foreground text-xs">
          For security concerns or to report vulnerabilities, contact{' '}
          <a
            href="mailto:babylon@elizalabs.ai"
            className="text-[#0066FF] hover:underline"
          >
            babylon@elizalabs.ai
          </a>
        </p>
      </div>
    </div>
  );
}
