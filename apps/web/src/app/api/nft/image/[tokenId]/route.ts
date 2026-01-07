/**
 * NFT Image Proxy API
 *
 * @route GET /api/nft/image/[tokenId] - Proxy NFT images from GitHub
 * @access Public
 *
 * @description
 * Proxies NFT images from GitHub repository to avoid CORS issues and token expiration.
 * Uses GitHub API to fetch images with proper authentication.
 * Includes in-memory caching to reduce GitHub API calls and rate limit impact.
 */

import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/** Collection size - configurable for different NFT collections */
const COLLECTION_SIZE = 100;

/** In-memory cache for image data (survives across requests in same worker) */
const imageCache = new Map<
  number,
  { buffer: ArrayBuffer; contentType: string; cachedAt: number }
>();

/** Cache TTL: 1 hour (images are immutable, but allow refresh for updates) */
const CACHE_TTL_MS = 60 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Log warning at startup if GITHUB_TOKEN is not set
if (!GITHUB_TOKEN) {
  logger.warn(
    'GITHUB_TOKEN not set - image proxy will use unauthenticated requests with lower rate limits',
    undefined,
    'NFT Image Proxy'
  );
}

/**
 * GET /api/nft/image/[tokenId]
 * Proxy NFT image from GitHub with caching
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await context.params;
  const tokenId = Number(tokenIdStr);

  if (!tokenIdStr || isNaN(tokenId) || tokenId < 1 || tokenId > COLLECTION_SIZE) {
    return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  // Check in-memory cache first
  const cached = imageCache.get(tokenId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    // Fetch file metadata from GitHub API
    const filePath = `NFT Protomonkeys/images/${tokenId}.png`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Babylon-NFT-Proxy/1.0',
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const metadataResponse = await fetch(apiUrl, { headers });

    if (!metadataResponse.ok) {
      logger.warn(
        `Failed to fetch NFT metadata #${tokenId} from GitHub API`,
        { status: metadataResponse.status },
        'GET /api/nft/image/[tokenId]'
      );
      return NextResponse.json(
        { error: 'Image not found' },
        { status: metadataResponse.status === 404 ? 404 : 502 }
      );
    }

    const metadata = await metadataResponse.json();
    const downloadUrl = metadata.download_url;

    if (!downloadUrl) {
      logger.warn(
        `No download URL for NFT image #${tokenId}`,
        undefined,
        'GET /api/nft/image/[tokenId]'
      );
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Fetch the image from GitHub
    const imageResponse = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Babylon-NFT-Proxy/1.0' },
    });

    if (!imageResponse.ok) {
      logger.warn(
        `Failed to fetch NFT image #${tokenId} from GitHub`,
        { status: imageResponse.status, url: downloadUrl },
        'GET /api/nft/image/[tokenId]'
      );
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: imageResponse.status }
      );
    }

    // Get image data
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get('content-type') || 'image/png';

    // Store in cache
    imageCache.set(tokenId, {
      buffer: imageBuffer,
      contentType,
      cachedAt: Date.now(),
    });

    // Return image with proper headers and caching
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    logger.error(
      `Error proxying NFT image #${tokenId}`,
      { error: String(error) },
      'GET /api/nft/image/[tokenId]'
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
