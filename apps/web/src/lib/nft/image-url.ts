/**
 * NFT Image URL Utilities
 *
 * Converts NFT token IDs to proxy API URLs for reliable image serving.
 */

/**
 * Get the proxy API URL for an NFT image
 * This ensures images load reliably by proxying through our API
 */
export function getNftImageUrl(tokenId: number): string {
  return `/api/nft/image/${tokenId}`;
}

/**
 * Get the proxy API URL for an NFT thumbnail
 * Currently uses the same image endpoint (browser will resize)
 */
export function getNftThumbnailUrl(tokenId: number): string {
  return getNftImageUrl(tokenId);
}
