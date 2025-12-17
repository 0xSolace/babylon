'use client';

import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Lock,
  LockOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useDecentralizedDM } from '@/hooks/useDecentralizedDM';

interface DecentralizedMessagingToggleProps {
  recipientAddress?: string;
  onEnabled?: () => void;
}

/**
 * Toggle component for enabling decentralized E2EE messaging
 *
 * Features:
 * - One-click key generation and registration
 * - Status indicator for encryption state
 * - Compatible with existing chat UI
 */
export function DecentralizedMessagingToggle({
  recipientAddress,
  onEnabled,
}: DecentralizedMessagingToggleProps) {
  const {
    isInitialized,
    isLoading,
    error,
    initializeKeys,
    publicKey: _publicKey,
  } = useDecentralizedDM({ recipientAddress });

  const [showSuccess, setShowSuccess] = useState(false);

  const handleEnable = async () => {
    await initializeKeys();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    onEnabled?.();
  };

  if (isInitialized) {
    return (
      <div className="flex items-center gap-2 text-green-500 text-sm">
        <Lock className="h-4 w-4" />
        <span>End-to-end encrypted</span>
        {showSuccess && <CheckCircle className="h-4 w-4 animate-pulse" />}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
        <button onClick={handleEnable} className="underline hover:no-underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 font-medium text-sm text-white transition hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Enabling encryption...</span>
        </>
      ) : (
        <>
          <LockOpen className="h-4 w-4" />
          <span>Enable E2E Encryption</span>
        </>
      )}
    </button>
  );
}

/**
 * Status badge showing encryption state
 */
export function EncryptionStatusBadge({
  isEncrypted,
}: {
  isEncrypted: boolean;
}) {
  if (isEncrypted) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-green-500 text-xs">
        <Lock className="h-3 w-3" />
        <span>Encrypted</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-500">
      <LockOpen className="h-3 w-3" />
      <span>Not encrypted</span>
    </div>
  );
}

/**
 * Info banner explaining decentralized messaging
 */
export function DecentralizedMessagingBanner() {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 flex-shrink-0 text-purple-400" />
        <div>
          <h4 className="font-medium text-purple-200">
            Decentralized Messaging
          </h4>
          <p className="mt-1 text-purple-300/70 text-sm">
            Your messages are end-to-end encrypted using Jeju L2. Only you and
            the recipient can read them. Keys are stored on-chain for
            verification.
          </p>
          <ul className="mt-2 space-y-1 text-purple-300/60 text-xs">
            <li>• X25519 key exchange for perfect forward secrecy</li>
            <li>• AES-256-GCM encryption for message content</li>
            <li>• IPFS content addressing for decentralized storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
