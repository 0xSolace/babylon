/**
 * Asset URL utilities for static files
 *
 * @description Handles URLs for both local development and production deployment
 * with CDN storage. Provides utilities for profile images, organization images,
 * and banner images.
 *
 * Supports multiple storage backends:
 * - Jeju Storage (IPFS/Arweave) - decentralized, content-addressed
 * - Vercel Blob - production CDN
 * - MinIO - local development
 */

/**
 * Check if a URL is already absolute (CDN URL, external URL, data URL, or IPFS/Arweave)
 *
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^(https?:|data:|blob:|ipfs:|ar:)/i.test(url)
}

/**
 * Check if a URL is a decentralized storage URL (IPFS or Arweave)
 *
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is from IPFS or Arweave
 */
export function isDecentralizedUrl(url: string): boolean {
  return (
    url.includes('/ipfs/') ||
    url.includes('ipfs.io') ||
    url.includes('arweave.net') ||
    url.includes('ipfs.jeju.network') ||
    url.startsWith('ipfs:') ||
    url.startsWith('ar:')
  )
}

/**
 * Get IPFS gateway URL for a CID
 *
 * @param {string} cid - IPFS content identifier
 * @param {string} [gateway] - Optional gateway URL (defaults to Jeju gateway or ipfs.io)
 * @returns {string} Full gateway URL
 */
export function getIpfsGatewayUrl(cid: string, gateway?: string): string {
  const defaultGateway = gateway || 'https://ipfs.io'

  const gatewayUrl = gateway || defaultGateway

  // Handle ipfs:// protocol
  if (cid.startsWith('ipfs://')) {
    cid = cid.slice(7)
  }

  return `${gatewayUrl}/ipfs/${cid}`
}

/**
 * Get Arweave URL for a transaction ID
 *
 * @param {string} txId - Arweave transaction ID
 * @returns {string} Arweave gateway URL
 */
export function getArweaveUrl(txId: string): string {
  // Handle ar:// protocol
  if (txId.startsWith('ar://')) {
    txId = txId.slice(5)
  }

  return `https://arweave.net/${txId}`
}

/**
 * Normalize a storage URL to use the preferred gateway
 *
 * @param {string} url - Original URL
 * @param {string} [preferredGateway] - Preferred IPFS gateway
 * @returns {string} Normalized URL
 */
export function normalizeStorageUrl(
  url: string,
  preferredGateway?: string,
): string {
  // Handle IPFS protocol
  if (url.startsWith('ipfs://')) {
    return getIpfsGatewayUrl(url.slice(7), preferredGateway)
  }

  // Handle Arweave protocol
  if (url.startsWith('ar://')) {
    return getArweaveUrl(url.slice(5))
  }

  // If it's already an absolute URL, return as-is
  if (isAbsoluteUrl(url)) {
    return url
  }

  return url
}

/**
 * Get the base URL for static assets
 *
 * @description Supports multiple storage backends with priority:
 * 1. Already absolute URLs (CDN, IPFS, Arweave, external) - return as-is
 * 2. IPFS CIDs (starting with Qm or bafy) - convert to gateway URL
 * 3. CDN assets (Jeju IPFS gateway, Vercel Blob, MinIO)
 * 4. Legacy public folder assets
 *
 * @param {string} path - Path to the asset (or CID for IPFS)
 * @param {string} [cdnBaseUrl] - Optional CDN base URL (defaults to PUBLIC_STATIC_ASSETS_URL)
 * @returns {string} Full URL to the asset
 */
export function getStaticAssetUrl(path: string, cdnBaseUrl?: string): string {
  // If already an absolute URL (CDN, external, IPFS, Arweave, or data), normalize and return
  if (isAbsoluteUrl(path)) {
    return normalizeStorageUrl(path)
  }

  // Check if this looks like an IPFS CID (v0 starts with Qm, v1 starts with bafy)
  if (path.startsWith('Qm') || path.startsWith('bafy')) {
    return getIpfsGatewayUrl(path)
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // Use provided CDN URL
  const staticAssetsUrl = cdnBaseUrl

  // In production with CDN/IPFS configured, use that URL
  if (staticAssetsUrl) {
    // Don't add path directly to IPFS gateway - it expects CIDs
    if (staticAssetsUrl.includes('ipfs')) {
      // For IPFS gateways, static assets should already be CIDs
      // Fall back to normal CDN behavior
      if (cdnBaseUrl) {
        return `${cdnBaseUrl}${normalizedPath}`
      }
    }
    return `${staticAssetsUrl}${normalizedPath}`
  }

  // For local development, return relative path (handled by Next.js public folder)
  return normalizedPath
}

/**
 * Get deterministic fallback profile image based on ID
 *
 * @description Returns a random-looking but deterministic profile image from
 * the user-profiles set based on a hash of the ID.
 *
 * @param {string} id - User or entity ID
 * @param {string} [cdnBaseUrl] - Optional CDN base URL
 * @returns {string} URL to fallback profile image
 */
export function getFallbackProfileImageUrl(
  id: string,
  cdnBaseUrl?: string,
): string {
  // Hash the id to get a number between 1-100
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const profileNum = (hash % 100) + 1
  return getStaticAssetUrl(
    `/assets/user-profiles/profile-${profileNum}.jpg`,
    cdnBaseUrl,
  )
}

/**
 * Get actor/user profile image URL
 *
 * @description Tries multiple sources in order:
 * 1. Uploaded profile image URL (from CDN storage - Vercel Blob or MinIO)
 * 2. Static actor image from CDN or public/images/actors/
 * 3. Returns null if not found (Avatar component will handle fallback on error)
 *
 * @param {string | null | undefined} profileImageUrl - Uploaded profile image URL
 * @param {string | null | undefined} userId - User or actor ID
 * @param {boolean} [isActor=true] - Whether this is an actor profile
 * @param {string} [cdnBaseUrl] - Optional CDN base URL
 * @returns {string | null} Profile image URL or null
 */
export function getProfileImageUrl(
  profileImageUrl: string | null | undefined,
  userId: string | null | undefined,
  isActor = true,
  cdnBaseUrl?: string,
): string | null {
  // If profile image URL is provided (uploaded image from CDN), use it
  if (profileImageUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(profileImageUrl)) {
      return profileImageUrl
    }
    // Otherwise, normalize it through getStaticAssetUrl
    return getStaticAssetUrl(profileImageUrl, cdnBaseUrl)
  }

  // For actors, try to use static image
  // This could be from CDN (after migration) or public folder (legacy)
  if (userId && isActor) {
    return getStaticAssetUrl(`/images/actors/${userId}.jpg`, cdnBaseUrl)
  }

  // No image available - Avatar component will handle fallback
  return null
}

/**
 * Get organization image URL
 *
 * @description Handles both CDN URLs and legacy public folder paths
 *
 * @param {string | null | undefined} imageUrl - Organization image URL
 * @param {string | null | undefined} orgId - Organization ID
 * @param {string} [cdnBaseUrl] - Optional CDN base URL
 * @returns {string | null} Organization image URL or null
 */
export function getOrganizationImageUrl(
  imageUrl: string | null | undefined,
  orgId: string | null | undefined,
  cdnBaseUrl?: string,
): string | null {
  // If image URL is provided, use it
  if (imageUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(imageUrl)) {
      return imageUrl
    }
    // Otherwise, normalize it
    return getStaticAssetUrl(imageUrl, cdnBaseUrl)
  }

  // For organizations, try to use static image
  if (orgId) {
    return getStaticAssetUrl(`/images/organizations/${orgId}.jpg`, cdnBaseUrl)
  }

  return null
}

/**
 * Get banner image URL (for actors, organizations, or users)
 *
 * @description Handles both CDN URLs and legacy public folder paths
 *
 * @param {string | null | undefined} bannerUrl - Banner image URL
 * @param {string | null | undefined} entityId - Entity ID
 * @param {'actor' | 'organization' | 'user'} [entityType='actor'] - Entity type
 * @param {string} [cdnBaseUrl] - Optional CDN base URL
 * @returns {string | null} Banner image URL or null
 */
export function getBannerImageUrl(
  bannerUrl: string | null | undefined,
  entityId: string | null | undefined,
  entityType: 'actor' | 'organization' | 'user' = 'actor',
  cdnBaseUrl?: string,
): string | null {
  // If banner URL is provided, use it
  if (bannerUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(bannerUrl)) {
      return bannerUrl
    }
    // Otherwise, normalize it
    return getStaticAssetUrl(bannerUrl, cdnBaseUrl)
  }

  // For actors/organizations, try to use static banner image
  if (entityId) {
    if (entityType === 'actor') {
      return getStaticAssetUrl(
        `/images/actor-banners/${entityId}.jpg`,
        cdnBaseUrl,
      )
    }
    if (entityType === 'organization') {
      return getStaticAssetUrl(
        `/images/org-banners/${entityId}.jpg`,
        cdnBaseUrl,
      )
    }
  }

  return null
}
