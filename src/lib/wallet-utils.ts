/**
 * Wallet utility functions for smart wallet detection and validation
 *
 * Migrated from Privy to OAuth3/MPC wallets.
 */

/**
 * Wallet info type for OAuth3/MPC wallets
 */
export interface WalletInfo {
  address: string;
  walletType: 'smart' | 'external';
}

/**
 * Check if a wallet is an MPC smart wallet
 */
export function isSmartWallet(wallet?: WalletInfo | null): boolean {
  if (!wallet) return false;
  return wallet.walletType === 'smart';
}

/**
 * Check if a wallet is an external wallet (not MPC-backed)
 */
export function isExternalWallet(wallet?: WalletInfo | null): boolean {
  if (!wallet) return false;
  return wallet.walletType === 'external';
}

/**
 * Find the smart wallet from a list of wallets
 */
export function findSmartWallet(wallets: WalletInfo[]): WalletInfo | undefined {
  return wallets.find(isSmartWallet);
}

/**
 * Find an external wallet from a list of wallets
 */
export function findExternalWallet(
  wallets: WalletInfo[]
): WalletInfo | undefined {
  return wallets.find(isExternalWallet);
}

/**
 * Error messages for wallet-related issues
 */
export const WALLET_ERROR_MESSAGES = {
  NO_EMBEDDED_WALLET:
    'Your smart wallet is required for this action. Please wait for it to finish preparing.',
  EXTERNAL_WALLET_ONLY:
    'You are connected with an external wallet. Please switch to your smart wallet to continue.',
  NO_WALLET: 'Please connect a wallet to continue.',
  SPONSOR_FAILED:
    'Unable to sponsor this transaction. Make sure your smart wallet is active.',
  USER_REJECTED: 'Transaction was cancelled in your wallet.',
  INSUFFICIENT_FUNDS:
    'Insufficient funds to cover gas. Use your smart wallet for sponsored transactions.',
} as const;

/**
 * Get a user-friendly error message for wallet-related errors
 */
export function getWalletErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);

  if (message.includes('user rejected') || message.includes('user denied')) {
    return WALLET_ERROR_MESSAGES.USER_REJECTED;
  }

  if (message.includes('insufficient funds')) {
    return WALLET_ERROR_MESSAGES.INSUFFICIENT_FUNDS;
  }

  if (message.includes('sponsor')) {
    return WALLET_ERROR_MESSAGES.SPONSOR_FAILED;
  }

  if (message.includes('no wallet') || message.includes('wallet not found')) {
    return WALLET_ERROR_MESSAGES.NO_WALLET;
  }

  return error instanceof Error
    ? error.message
    : 'An unknown error occurred with your wallet.';
}
