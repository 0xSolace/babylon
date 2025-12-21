/**
 * Jeju Auth API Route
 *
 * Handles decentralized authentication requests using wallet-signed sessions.
 */

import type { AuthMethod, DID } from '@babylon/auth';
import { createSessionMessage, SessionManager } from '@babylon/auth/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { type Address, verifyMessage } from 'viem';

const sessionManager = new SessionManager({ expiresIn: 24 * 60 * 60 });

/**
 * POST /api/auth/jeju
 *
 * Authenticate a user and return a session token.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, method, code } = body as {
    action: 'login' | 'verify' | 'refresh' | 'logout';
    method?: AuthMethod;
    code?: string;
  };

  switch (action) {
    case 'login':
      return handleLogin(method);
    case 'verify':
      return handleVerify(code, method);
    case 'refresh':
      return handleRefresh(request);
    case 'logout':
      return handleLogout();
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

/**
 * Handle login initiation
 */
async function handleLogin(method?: AuthMethod) {
  if (!method) {
    return NextResponse.json({ error: 'Method required' }, { status: 400 });
  }

  switch (method.type) {
    case 'email':
      // In production: send verification email via MPC network
      return NextResponse.json({
        success: true,
        message: 'Verification email sent',
        requiresVerification: true,
      });

    case 'wallet': {
      // Wallet login is handled client-side via signature
      // This endpoint validates the signature
      if (!method.signature || !method.address || !method.message) {
        return NextResponse.json(
          { error: 'Signature, address, and message required' },
          { status: 400 }
        );
      }

      // Verify the wallet signature
      const isValid = await verifyMessage({
        address: method.address as Address,
        message: method.message,
        signature: method.signature,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }

      // Create DID from address
      const did =
        `did:jeju:mainnet:${method.address.toLowerCase().slice(2)}` as DID;
      const address = method.address as Address;

      // Create session message and token
      const { message, claims } = createSessionMessage(did, address);

      // For wallet auth, we need the user to sign this session message
      // Return the message for signing
      return NextResponse.json({
        success: true,
        requiresSessionSign: true,
        sessionMessage: message,
        claims,
        userId: did,
        walletAddress: method.address,
      });
    }

    case 'twitter':
    case 'discord':
      // OAuth is handled via redirect flow
      return NextResponse.json({
        success: true,
        message: 'Redirect to OAuth provider',
        redirectUrl: `/api/auth/jeju/oauth/${method.type}`,
      });

    case 'farcaster':
      // Farcaster uses SIWF
      return NextResponse.json({
        success: true,
        message: 'Sign with Farcaster',
        siweUrl: '/api/auth/jeju/farcaster/challenge',
      });

    default:
      return NextResponse.json(
        { error: 'Unsupported auth method' },
        { status: 400 }
      );
  }
}

/**
 * Handle email/code verification
 */
async function handleVerify(code?: string, method?: AuthMethod) {
  if (!code || !method || method.type !== 'email') {
    return NextResponse.json(
      { error: 'Code and email method required' },
      { status: 400 }
    );
  }

  // In production: verify code via MPC network
  // For dev: accept any 6-digit code
  if (code.length < 4) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Create DID from email hash
  const emailHash = await hashEmail(method.email);
  const did = `did:jeju:mainnet:${emailHash}` as DID;

  return NextResponse.json({
    success: true,
    userId: did,
    message: 'Email verified. Please sign session message to complete login.',
  });
}

/**
 * Handle token refresh
 */
async function handleRefresh(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  const token = authHeader.slice(7);

  // Verify current token
  const claims = await sessionManager.verifyToken(token);

  // Token is valid, return success (client needs to sign new session if needed)
  return NextResponse.json({
    success: true,
    claims,
    message: 'Token is valid',
  });
}

/**
 * Handle logout
 */
async function handleLogout() {
  // Stateless session - just return success
  // Client should clear local storage
  return NextResponse.json({ success: true });
}

/**
 * Hash email for DID creation
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .slice(0, 20)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * GET /api/auth/jeju
 *
 * Get current auth status from token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({
      authenticated: false,
    });
  }

  const token = authHeader.slice(7);

  // Verify token using session manager
  const claims = await sessionManager.verifyToken(token);
  return NextResponse.json({
    authenticated: true,
    userId: claims.did,
    walletAddress: claims.address,
    linkedTypes: claims.linkedTypes,
    expiresAt: claims.exp * 1000,
  });
}
