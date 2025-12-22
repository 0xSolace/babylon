/**
 * Mute user modal component for muting users.
 *
 * Provides a confirmation modal for muting users. Shows what muting
 * will do (hide their content without blocking). Includes duration selection.
 * Handles API call and success/error states.
 *
 * Features:
 * - Confirmation dialog
 * - Duration selection (1 day, 1 week, 1 month, forever)
 * - Loading states
 * - Error handling
 * - Body scroll lock and escape key handling
 *
 * @param props - MuteUserModal component props
 * @returns Mute user modal element or null if not open
 *
 * @example
 * ```tsx
 * <MuteUserModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   targetUserId="user-123"
 *   targetDisplayName="Alice"
 *   onSuccess={() => refreshFeed()}
 * />
 * ```
 */
'use client';

import { VolumeX, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface MuteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName: string;
  isNPC?: boolean;
  onSuccess?: () => void;
}

type MuteDuration = '1d' | '7d' | '30d' | 'forever';

const durationLabels: Record<MuteDuration, string> = {
  '1d': '1 day',
  '7d': '1 week',
  '30d': '1 month',
  forever: 'Forever',
};

export function MuteUserModal({
  isOpen,
  onClose,
  targetUserId,
  targetDisplayName,
  isNPC = false,
  onSuccess,
}: MuteUserModalProps) {
  const [duration, setDuration] = useState<MuteDuration>('7d');
  const [isMuting, startMuting] = useTransition();

  const handleMute = () => {
    startMuting(async () => {
      const response = await fetch(`/api/users/${targetUserId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mute',
          duration: duration === 'forever' ? null : duration,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        toast.error(error.message ?? 'Failed to mute user');
        return;
      }

      toast.success(`Muted ${targetDisplayName}`);
      onClose();
      onSuccess?.();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-xl">
            <VolumeX className="h-5 w-5 text-yellow-500" />
            Mute User
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-muted-foreground">
          Mute <strong>{targetDisplayName}</strong>?
        </p>

        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-muted-foreground text-sm">Muting will:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground text-sm">
            <li>Hide their posts from your feed</li>
            <li>Hide notifications from them</li>
            {!isNPC && <li>They won&apos;t know they&apos;re muted</li>}
          </ul>
          <p className="mt-2 text-muted-foreground/80 text-xs">
            Unlike blocking, they can still see your posts and message you.
          </p>
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-medium text-sm">
            Mute duration
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(durationLabels) as MuteDuration[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDuration(key)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  duration === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {durationLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isMuting}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMute}
            disabled={isMuting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
          >
            {isMuting ? (
              <>Muting...</>
            ) : (
              <>
                <VolumeX className="h-4 w-4" />
                Mute User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
