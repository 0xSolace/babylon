/**
 * OAuth Callback Route
 *
 * Handles OAuth callbacks from Twitter, Discord, etc.
 * Returns the OAuth info to the client which will create the session.
 */

import type { DID } from '@babylon/auth';
import { DiscordOAuth, PKCEUtils, TwitterOAuth } from '@babylon/auth/oauth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/auth/jeju/callback
 *
 * Handle OAuth callback with authorization code.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const provider = searchParams.get('provider') ?? 'twitter';

  // Handle OAuth errors
  if (error) {
    return redirectWithError(request, `OAuth error: ${error}`);
  }

  if (!code || !state) {
    return redirectWithError(request, 'Missing code or state');
  }

  // Retrieve stored PKCE params
  const pkce = PKCEUtils.retrieve(`${provider}_pkce_${state}`);
  if (!pkce) {
    return redirectWithError(request, 'Invalid state - session expired');
  }

  // Validate state
  if (!PKCEUtils.validateState(state, pkce.state)) {
    return redirectWithError(request, 'State mismatch');
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/jeju/callback?provider=${provider}`;

  let userInfo: { id: string; username?: string; email?: string };

  if (provider === 'twitter') {
    const twitter = new TwitterOAuth({
      clientId: process.env.TWITTER_CLIENT_ID ?? '',
    });

    const tokens = await twitter.exchangeCode(
      code,
      pkce.codeVerifier,
      redirectUri
    );
    userInfo = await twitter.getUserInfo(tokens.accessToken);
  } else if (provider === 'discord') {
    const discord = new DiscordOAuth({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
    });

    const tokens = await discord.exchangeCode(
      code,
      pkce.codeVerifier,
      redirectUri
    );
    userInfo = await discord.getUserInfo(tokens.accessToken);
  } else {
    return redirectWithError(request, 'Unknown provider');
  }

  // Create DID from provider ID
  const did = `did:jeju:mainnet:${provider}:${userInfo.id}` as DID;

  // Redirect to the auth callback page with OAuth success info
  // The client will create a wallet-signed session
  const callbackUrl = new URL('/auth/callback', getBaseUrl(request));
  callbackUrl.searchParams.set('success', 'true');
  callbackUrl.searchParams.set('provider', provider);
  callbackUrl.searchParams.set('userId', did);
  if (userInfo.username) {
    callbackUrl.searchParams.set('username', userInfo.username);
  }

  return NextResponse.redirect(callbackUrl);
}

/**
 * POST /api/auth/jeju/callback
 *
 * Handle OAuth code exchange from the client side.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code } = body as { code: string; state?: string };

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    );
  }

  // For client-initiated OAuth exchange, return success
  // The actual token/session management happens client-side with wallet signatures
  return NextResponse.json({
    success: true,
    message: 'Authorization code received',
  });
}

/**
 * Get base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:5007';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

/**
 * Redirect with error message
 */
function redirectWithError(
  request: NextRequest,
  message: string
): NextResponse {
  const errorUrl = new URL('/auth/callback', getBaseUrl(request));
  errorUrl.searchParams.set('error', message);
  return NextResponse.redirect(errorUrl);
}
