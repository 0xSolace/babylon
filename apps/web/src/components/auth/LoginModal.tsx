'use client';

import { logger } from '@babylon/shared';
import { useCallback, useEffect, useState } from 'react';
import { useStewardAuthContext } from '@/components/providers/StewardAuthProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

/**
 * Steward-backed login modal.
 *
 * Supports:
 * - Email magic link
 * - Passkey (WebAuthn) — requires @simplewebauthn/browser installed
 * - OAuth: Google, Discord, Twitter/X (via Steward OAuth routes)
 * - Farcaster SIWF (Sign-In With Farcaster) — via /api/auth/farcaster
 *
 * After successful login the JWT is stored by StewardAuth (localStorage) and
 * synced to an httpOnly cookie via /api/auth/session.
 */

type Step = 'idle' | 'email-sent' | 'loading' | 'error';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const STEWARD_API_URL =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? (process.env.NEXT_PUBLIC_STEWARD_API_URL ?? 'https://auth.elizacloud.ai')
    : (process.env.NEXT_PUBLIC_STEWARD_API_URL ?? 'http://localhost:3200');

const STEWARD_TENANT_ID =
  process.env.NEXT_PUBLIC_STEWARD_TENANT_ID ?? 'babylon';

function oauthRedirectUrl(provider: string): string {
  const callbackBase =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/oauth/callback/${provider}`
      : `/api/auth/oauth/callback/${provider}`;
  return `${STEWARD_API_URL}/auth/${STEWARD_TENANT_ID}/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(callbackBase)}`;
}

export function LoginModal({
  isOpen,
  onClose,
  title,
  message,
}: LoginModalProps) {
  const { stewardAuth, onLoginSuccess } = useStewardAuthContext();
  const { authenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Close when user logs in
  useEffect(() => {
    if (authenticated && isOpen) onClose();
  }, [authenticated, isOpen, onClose]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep('idle');
      setEmail('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const handleEmailLogin = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStep('loading');
    setErrorMsg('');
    try {
      const result = await stewardAuth.signInWithEmail(trimmed);
      if (result.ok) {
        setStep('email-sent');
        logger.info('Magic link sent', { email: trimmed }, 'LoginModal');
      } else {
        setErrorMsg('Failed to send magic link. Please try again.');
        setStep('error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Email login failed', { error: msg }, 'LoginModal');
      setErrorMsg(msg);
      setStep('error');
    }
  }, [email, stewardAuth]);

  const handlePasskeyLogin = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Please enter your email address first.');
      return;
    }
    setStep('loading');
    setErrorMsg('');
    try {
      const result = await stewardAuth.signInWithPasskey(trimmed);
      await onLoginSuccess(result.token);
      logger.info('Passkey login successful', { email: trimmed }, 'LoginModal');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Passkey login failed';
      logger.warn('Passkey login failed', { error: msg }, 'LoginModal');
      setErrorMsg(msg);
      setStep('error');
    }
  }, [email, stewardAuth, onLoginSuccess]);

  const handleOAuth = useCallback(
    (provider: 'google' | 'discord' | 'twitter') => {
      const url = oauthRedirectUrl(provider);
      window.location.href = url;
    },
    []
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? 'Sign in to Babylon'}</DialogTitle>
          {message && <DialogDescription>{message}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {step === 'email-sent' ? (
            <div className="rounded-lg bg-muted p-4 text-center text-sm">
              <p className="font-medium">Check your email!</p>
              <p className="mt-1 text-muted-foreground">
                We sent a magic link to <strong>{email}</strong>. Click the link
                to sign in.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setStep('idle')}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <>
              {/* Email input */}
              <div className="flex flex-col gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleEmailLogin();
                  }}
                  disabled={step === 'loading'}
                  autoComplete="email"
                />
                <Button
                  onClick={() => void handleEmailLogin()}
                  disabled={step === 'loading' || !email.trim()}
                  className="w-full"
                >
                  {step === 'loading' ? 'Sending…' : 'Continue with Email'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handlePasskeyLogin()}
                  disabled={step === 'loading' || !email.trim()}
                  className="w-full"
                >
                  Continue with Passkey
                </Button>
              </div>

              <div className="relative flex items-center">
                <div className="flex-1 border-t" />
                <span className="mx-3 text-muted-foreground text-xs">
                  or continue with
                </span>
                <div className="flex-1 border-t" />
              </div>

              {/* OAuth providers */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOAuth('google')}
                  disabled={step === 'loading'}
                  className="w-full"
                >
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuth('discord')}
                  disabled={step === 'loading'}
                  className="w-full"
                >
                  Discord
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuth('twitter')}
                  disabled={step === 'loading'}
                  className="w-full"
                >
                  Twitter / X
                </Button>
                <FarcasterSignInSection
                  onLoginSuccess={onLoginSuccess}
                  onClose={onClose}
                />
              </div>

              {/* Error message */}
              {errorMsg && (
                <p className="text-center text-destructive text-sm">
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders the Farcaster Sign-In With Farcaster button using @farcaster/auth-kit.
 * On success, calls /api/auth/farcaster and then onLoginSuccess().
 */
function FarcasterSignInSection({
  onLoginSuccess,
  onClose,
}: {
  onLoginSuccess: (token: string) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState('');

  const handleSuccess = useCallback(
    async (res: { message?: string; signature?: string; nonce?: string }) => {
      setError('');
      try {
        const r = await fetch('/api/auth/farcaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: res.message,
            signature: res.signature,
            nonce: res.nonce,
          }),
        });
        const data = (await r.json()) as {
          ok: boolean;
          token?: string;
          error?: string;
        };
        if (!data.ok || !data.token)
          throw new Error(data.error ?? 'Farcaster auth failed');
        await onLoginSuccess(data.token);
        onClose();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Farcaster sign-in failed';
        logger.warn('Farcaster SIWF failed', { error: msg }, 'LoginModal');
        setError(msg);
      }
    },
    [onLoginSuccess, onClose]
  );

  // Dynamically render the Farcaster SignInButton only when auth-kit is available
  const [SignInButton, setSignInButton] = useState<React.ComponentType<{
    onSuccess?: (res: unknown) => void;
    onError?: (err: unknown) => void;
  }> | null>(null);

  useEffect(() => {
    import('@farcaster/auth-kit')
      .then((mod) => setSignInButton(() => mod.SignInButton))
      .catch(() => {
        /* auth-kit not available — hide button */
      });
  }, []);

  if (!SignInButton) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <SignInButton
        onSuccess={(res) =>
          void handleSuccess(res as Parameters<typeof handleSuccess>[0])
        }
        onError={(err) => {
          const msg =
            err instanceof Error ? err.message : 'Farcaster sign-in error';
          setError(msg);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
