/**
 * Wallet Utility Functions
 *
 * @description Utility functions for detecting and validating embedded wallets
 * vs external wallets. Provides error message helpers for wallet-related operations.
 *
 * Note: These functions work with any wallet provider that uses the ConnectedWallet interface.
 * Originally designed for Privy, now compatible with OAuth3/Jeju decentralized auth.
 */

/**
 * Connected wallet interface - compatible with multiple wallet providers
 */
export interface ConnectedWallet {
  address: string;
  chainId: number;
  walletClientType: string;
  connectorType?: string;
}

/**
 * Check if a wallet is an embedded/smart wallet
 *
 * @description Determines if a connected wallet is an embedded smart wallet
 * as opposed to an external wallet like MetaMask or Coinbase Wallet.
 *
 * Detects:
 * - Privy embedded wallets (legacy)
 * - OAuth3/Jeju smart wallets
 * - Any wallet with 'embedded' or 'smart' in the client type
 *
 * @param {ConnectedWallet | null | undefined} wallet - The wallet to check
 * @returns {boolean} True if the wallet is an embedded wallet
 */
export function isEmbeddedWallet(wallet?: ConnectedWallet | null): boolean {
  if (!wallet) return false;
  const clientType = wallet.walletClientType.toLowerCase();
  return (
    clientType === 'privy' ||
    clientType === 'privy-v2' ||
    clientType === 'oauth3' ||
    clientType === 'jeju' ||
    clientType.includes('embedded') ||
    clientType.includes('smart')
  );
}

/**
 * @deprecated Use isEmbeddedWallet instead
 */
export function isEmbeddedPrivyWallet(
  wallet?: ConnectedWallet | null
): boolean {
  return isEmbeddedWallet(wallet);
}

/**
 * Check if a wallet is an external wallet (not embedded)
 *
 * @description Determines if a connected wallet is an external wallet (e.g., MetaMask,
 * Coinbase Wallet) rather than an embedded smart wallet.
 *
 * @param {ConnectedWallet | null | undefined} wallet - The wallet to check
 * @returns {boolean} True if the wallet is an external wallet
 */
export function isExternalWallet(wallet?: ConnectedWallet | null): boolean {
  if (!wallet) return false;
  return !isEmbeddedWallet(wallet);
}

/**
 * Find the embedded wallet from a list of wallets
 *
 * @description Searches through an array of connected wallets and returns the first
 * embedded wallet found, if any.
 *
 * @param {ConnectedWallet[]} wallets - Array of connected wallets to search
 * @returns {ConnectedWallet | undefined} The embedded wallet, or undefined if not found
 */
export function findEmbeddedWallet(
  wallets: ConnectedWallet[]
): ConnectedWallet | undefined {
  return wallets.find(isEmbeddedWallet);
}

/**
 * Find an external wallet from a list of wallets
 *
 * @description Searches through an array of connected wallets and returns the first
 * external wallet found (not embedded), if any.
 *
 * @param {ConnectedWallet[]} wallets - Array of connected wallets to search
 * @returns {ConnectedWallet | undefined} The external wallet, or undefined if not found
 */
export function findExternalWallet(
  wallets: ConnectedWallet[]
): ConnectedWallet | undefined {
  return wallets.find(isExternalWallet);
}

/**
 * Error messages for wallet-related issues
 *
 * @description Predefined user-friendly error messages for common wallet-related
 * errors. Used to provide consistent error messaging across the application.
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
 *
 * @description Analyzes an error and returns a user-friendly message based on
 * common wallet error patterns. Maps technical errors to readable messages.
 *
 * @param {unknown} error - The error to analyze
 * @returns {string} User-friendly error message
 *
 * @example
 * ```typescript
 * try {
 *   await sendTransaction();
 * } catch (error) {
 *   const message = getWalletErrorMessage(error);
 *   showToast(message);
 * }
 * ```
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
