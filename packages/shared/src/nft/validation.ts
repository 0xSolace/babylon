/**
 * NFT Validation Utilities
 *
 * Shared validation functions for NFT-related operations.
 * Used by API routes, scripts, and tests.
 */

/** Simulated transaction hash prefix */
export const SIMULATED_TX_PREFIX = 'simulated-';

/**
 * Check if a transaction hash is a simulated (not real blockchain) hash
 */
export function isSimulatedTxHash(txHash: string): boolean {
  return txHash.startsWith(SIMULATED_TX_PREFIX);
}

/**
 * Normalize wallet address to lowercase for consistent comparison
 */
export function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Validate Ethereum wallet address format (0x + 40 hex chars)
 */
export function isValidWalletAddress(
  address: string | null | undefined
): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate token ID is within the NFT collection range (1-100)
 */
export function isValidTokenId(
  tokenId: unknown,
  collectionSize = 100
): boolean {
  if (typeof tokenId === 'string') {
    const parsed = parseInt(tokenId, 10);
    if (isNaN(parsed)) return false;
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= collectionSize;
  }
  if (typeof tokenId === 'number') {
    return (
      Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= collectionSize
    );
  }
  return false;
}

/**
 * Validate Privy ID format (did:privy:...)
 */
export function isValidPrivyId(id: string): boolean {
  return id.startsWith('did:privy:');
}

/**
 * Claim eligibility check result
 */
export interface ClaimEligibilityResult {
  canClaim: boolean;
  reason?: 'no_wallet' | 'invalid_wallet' | 'not_assigned' | 'already_claimed';
}

/**
 * Check if a user can claim an NFT based on their eligibility data
 */
export function canUserClaim(eligibility: {
  walletAddress: string | null;
  assignedTokenId: number | null;
  hasMinted: boolean;
}): ClaimEligibilityResult {
  if (!eligibility.walletAddress) {
    return { canClaim: false, reason: 'no_wallet' };
  }

  if (!isValidWalletAddress(eligibility.walletAddress)) {
    return { canClaim: false, reason: 'invalid_wallet' };
  }

  if (eligibility.assignedTokenId === null) {
    return { canClaim: false, reason: 'not_assigned' };
  }

  if (eligibility.hasMinted) {
    return { canClaim: false, reason: 'already_claimed' };
  }

  return { canClaim: true };
}

/**
 * Generate NFT image proxy URL
 */
export function getNftImageProxyUrl(tokenId: number): string {
  return `/api/nft/image/${tokenId}`;
}
