/**
 * Farcaster Sign-In With Farcaster (SIWF) callback.
 *
 * Called by the Farcaster SignInButton in LoginModal after the user completes
 * the SIWF flow. Verifies the signature server-side, looks up or creates the
 * Babylon user, ensures a Steward user record exists, and returns a Steward-
 * compatible JWT that can be stored as the steward-token httpOnly cookie.
 *
 * Client flow:
 *   1. <SignInButton> from @farcaster/auth-kit triggers SIWF
 *   2. On success, client POSTs { message, signature, nonce } here
 *   3. This route verifies + provisions + returns { token, refreshToken }
 *   4. Client POSTs to /api/auth/session to set the httpOnly cookie
 */

import { withErrorHandling } from '@babylon/api';
import { db, eq, users } from '@babylon/db';
import { generateSnowflakeId } from '@babylon/shared';
import { createAppClient, viemConnector } from '@farcaster/auth-client';
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const STEWARD_API_URL = process.env.STEWARD_API_URL ?? 'http://localhost:3200';
const STEWARD_PLATFORM_KEY =
  (process.env.STEWARD_PLATFORM_KEYS ?? '').split(',')[0]?.trim() ?? '';
const STEWARD_JWT_SECRET = new TextEncoder().encode(
  process.env.STEWARD_JWT_SECRET ?? 'dev-jwt-secret-change-in-prod'
);

/** Provision a Steward user record for this FID if one doesn't exist. */
async function ensureStewardUser(email?: string): Promise<string> {
  if (!email || !STEWARD_PLATFORM_KEY) return crypto.randomUUID();

  const res = await fetch(`${STEWARD_API_URL}/platform/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Steward-Platform-Key': STEWARD_PLATFORM_KEY,
    },
    body: JSON.stringify({ email, emailVerified: false }),
  });

  if (!res.ok)
    throw new Error(`Failed to provision Steward user: ${res.status}`);
  const data = (await res.json()) as {
    ok: boolean;
    data?: { userId?: string };
    error?: string;
  };
  if (!data.ok || !data.data?.userId)
    throw new Error(data.error ?? 'missing userId');
  return data.data.userId;
}

/** Mint a Steward-compatible HS256 JWT for this user. */
async function mintToken(stewardUserId: string, fid: number): Promise<string> {
  return new SignJWT({ userId: stewardUserId, tenantId: 'babylon', fid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('steward')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(STEWARD_JWT_SECRET);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  let body: { message?: string; signature?: string; nonce?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { message, signature, nonce } = body;
  if (!message || !signature || !nonce) {
    return NextResponse.json(
      { ok: false, error: 'message, signature, nonce are required' },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const domain = new URL(appUrl).hostname;

  // Server-side SIWF verification using @farcaster/auth-client
  const appClient = createAppClient({
    relay: 'https://relay.farcaster.xyz',
    ethereum: viemConnector(),
  });

  const {
    success,
    fid,
    error: verifyError,
  } = await appClient.verifySignInMessage({
    message,
    signature: signature as `0x${string}`,
    nonce,
    domain,
  });

  if (!success || !fid) {
    return NextResponse.json(
      {
        ok: false,
        error:
          (verifyError as { message?: string } | undefined)?.message ??
          'Invalid Farcaster signature',
      },
      { status: 401 }
    );
  }

  // Look up Babylon user by FID
  const [existing] = await db
    .select({
      id: users.id,
      stewardId: users.stewardId,
      email: users.email,
      farcasterFid: users.farcasterFid,
    })
    .from(users)
    .where(eq(users.farcasterFid, String(fid)))
    .limit(1);

  let babylonUserId: string;
  let stewardUserId: string;

  if (existing) {
    babylonUserId = existing.id;

    if (existing.stewardId) {
      stewardUserId = existing.stewardId;
    } else {
      // Ensure Steward user exists and link it
      stewardUserId = await ensureStewardUser(existing.email ?? undefined);
      await db
        .update(users)
        .set({ stewardId: stewardUserId })
        .where(eq(users.id, babylonUserId));
    }
  } else {
    // New Farcaster user — create Steward record first, then Babylon record
    stewardUserId = await ensureStewardUser();
    const newId = await generateSnowflakeId();
    const [newUser] = await db
      .insert(users)
      .values({
        id: newId,
        stewardId: stewardUserId,
        farcasterFid: String(fid),
        isActor: false,
        updatedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!newUser) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create user record' },
        { status: 500 }
      );
    }
    babylonUserId = newUser.id;
  }

  const token = await mintToken(stewardUserId, fid);

  return NextResponse.json({ ok: true, token });
});
