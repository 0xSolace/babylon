/**
 * NFT Image Proxy API
 *
 * @route GET /api/nft/image/[tokenId] - Proxy NFT images from GitHub
 * @access Public
 *
 * @description
 * Proxies NFT images from GitHub repository to avoid CORS issues and token expiration.
 * Uses GitHub API to fetch images with proper authentication.
 */

import { logger } from '@babylon/shared';
import { execSync } from 'child_process';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/nft/image/[tokenId]
 * Proxy NFT image from GitHub
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await context.params;

  if (
    !tokenId ||
    isNaN(Number(tokenId)) ||
    Number(tokenId) < 1 ||
    Number(tokenId) > 100
  ) {
    return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  try {
    // Use GitHub CLI to get download URL
    const filePath = `NFT Protomonkeys/images/${tokenId}.png`;
    const command = `gh api repos/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)} --jq .download_url`;

    const downloadUrl = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Fetch the image from GitHub
    const imageResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Babylon-NFT-Proxy/1.0',
      },
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

    // Return image with proper headers and caching
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
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
