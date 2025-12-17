/**
 * LoginButton Component
 *
 * Pre-built login button with method selection.
 */

'use client';

import { type ChangeEvent, type ReactNode, useCallback, useState } from 'react';
import { useJejuAuth } from './use-jeju-auth';

type LoginMethod = 'wallet' | 'email' | 'farcaster' | 'twitter' | 'discord';

export interface LoginButtonProps {
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
  /** Custom children (replaces default text) */
  children?: ReactNode;
  /** Callback on successful login */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * LoginButton Component
 *
 * Shows a login button that opens method selection.
 *
 * @example
 * ```tsx
 * <LoginButton onSuccess={() => console.log('Logged in!')} />
 * ```
 */
export function LoginButton({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  onSuccess,
  onError,
}: LoginButtonProps) {
  const {
    authenticated,
    loading,
    loginWithWallet,
    loginWithEmail,
    loginWithFarcaster,
    loginWithTwitter,
    loginWithDiscord,
    verifyEmailCode,
    logout,
  } = useJejuAuth();

  const [showMethods, setShowMethods] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'select' | 'email-input' | 'email-verify'>(
    'select'
  );

  const handleMethodSelect = useCallback(
    async (method: LoginMethod) => {
      switch (method) {
        case 'wallet':
          await loginWithWallet().catch((err) => onError?.(err.message));
          setShowMethods(false);
          onSuccess?.();
          break;
        case 'email':
          setStep('email-input');
          break;
        case 'farcaster':
          await loginWithFarcaster().catch((err) => onError?.(err.message));
          setShowMethods(false);
          break;
        case 'twitter':
          await loginWithTwitter();
          break;
        case 'discord':
          await loginWithDiscord();
          break;
      }
    },
    [
      loginWithWallet,
      loginWithFarcaster,
      loginWithTwitter,
      loginWithDiscord,
      onSuccess,
      onError,
    ]
  );

  const handleEmailSubmit = useCallback(async () => {
    await loginWithEmail(email);
    setStep('email-verify');
  }, [loginWithEmail, email]);

  const handleCodeSubmit = useCallback(async () => {
    await verifyEmailCode(code).catch((err) => onError?.(err.message));
    setShowMethods(false);
    setStep('select');
    onSuccess?.();
  }, [verifyEmailCode, code, onSuccess, onError]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50',
    ghost: 'text-blue-600 hover:bg-blue-50',
  };

  if (authenticated) {
    return (
      <button
        onClick={() => logout()}
        className={`rounded-lg font-medium ${sizeClasses[size]} ${variantClasses.outline} ${className}`}
      >
        Sign Out
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMethods(!showMethods)}
        disabled={loading}
        className={`rounded-lg font-medium ${sizeClasses[size]} ${variantClasses[variant]} ${className} ${
          loading ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        {loading ? 'Connecting...' : (children ?? 'Sign In')}
      </button>

      {showMethods && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border bg-white p-4 shadow-lg">
          {step === 'select' && (
            <div className="space-y-2">
              <p className="mb-3 text-gray-500 text-sm">
                Choose a sign-in method
              </p>

              <button
                onClick={() => handleMethodSelect('wallet')}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-xl">🦊</span>
                <span className="font-medium">Wallet</span>
              </button>

              <button
                onClick={() => handleMethodSelect('email')}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-xl">📧</span>
                <span className="font-medium">Email</span>
              </button>

              <button
                onClick={() => handleMethodSelect('farcaster')}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-xl">🟪</span>
                <span className="font-medium">Farcaster</span>
              </button>

              <button
                onClick={() => handleMethodSelect('twitter')}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-xl">𝕏</span>
                <span className="font-medium">Twitter</span>
              </button>

              <button
                onClick={() => handleMethodSelect('discord')}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-xl">🎮</span>
                <span className="font-medium">Discord</span>
              </button>
            </div>
          )}

          {step === 'email-input' && (
            <div className="space-y-3">
              <button
                onClick={() => setStep('select')}
                className="text-gray-500 text-sm hover:text-gray-700"
              >
                ← Back
              </button>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                className="w-full rounded-lg border p-2"
              />
              <button
                onClick={handleEmailSubmit}
                disabled={!email.includes('@')}
                className="w-full rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'email-verify' && (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">
                Enter the verification code sent to {email}
              </p>
              <input
                type="text"
                placeholder="Verification code"
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setCode(e.target.value)
                }
                className="w-full rounded-lg border p-2"
              />
              <button
                onClick={handleCodeSubmit}
                disabled={code.length < 4}
                className="w-full rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
