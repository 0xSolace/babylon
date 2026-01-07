/**
 * NFT validation utilities
 */

export const SIMULATED_TX_PREFIX = 'simulated-';

export function isSimulatedTxHash(txHash: string): boolean {
  return txHash.startsWith(SIMULATED_TX_PREFIX);
}

export function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

/** Validate Ethereum address format (0x + 40 hex chars) */
export function isValidWalletAddress(
  address: string | null | undefined
): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

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

export function isValidPrivyId(id: string): boolean {
  return id.startsWith('did:privy:');
}

export interface ClaimEligibilityResult {
  canClaim: boolean;
  reason?: 'no_wallet' | 'invalid_wallet' | 'not_assigned' | 'already_claimed';
}

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

export function getNftImageProxyUrl(tokenId: number): string {
  return `/api/nft/image/${tokenId}`;
}
