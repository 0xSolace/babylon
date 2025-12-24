/**
 * useJejuAuth Hook
 *
 * Main hook for accessing decentralized authentication.
 */

import { useJejuAuthContext } from './provider'

/**
 * Hook for accessing Jeju authentication
 *
 * @example
 * ```tsx
 * const { authenticated, login, logout, userId, walletAddress } = useJejuAuth();
 *
 * if (!authenticated) {
 *   return <button onClick={() => loginWithWallet()}>Connect Wallet</button>;
 * }
 *
 * return <div>Logged in as {userId}</div>;
 * ```
 */
export function useJejuAuth() {
  const context = useJejuAuthContext()

  return {
    // State
    ready: context.ready,
    authenticated: context.authenticated,
    loading: context.loading,
    error: context.error,
    userId: context.userId,
    walletAddress: context.walletAddress,
    linkedAccounts: context.linkedAccounts,

    // Auth methods
    login: context.login,
    logout: context.logout,
    loginWithEmail: context.loginWithEmail,
    loginWithWallet: context.loginWithWallet,
    loginWithFarcaster: context.loginWithFarcaster,
    loginWithTwitter: context.loginWithTwitter,
    loginWithDiscord: context.loginWithDiscord,
    verifyEmailCode: context.verifyEmailCode,

    // Account linking
    linkAccount: context.linkAccount,
    unlinkAccount: context.unlinkAccount,

    // Token management
    refreshToken: context.refreshToken,
    getAccessToken: context.getAccessToken,

    // Backup & recovery
    exportBackup: context.exportBackup,
    recoverWithBackup: context.recoverWithBackup,

    // Session
    getSession: context.getSession,
  }
}
