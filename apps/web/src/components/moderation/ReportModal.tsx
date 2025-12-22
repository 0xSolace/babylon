/**
 * Report modal component for reporting users or content.
 *
 * Provides a form for reporting users or specific posts with reason
 * selection and optional details. Handles API call and success/error states.
 *
 * Features:
 * - Report reason selection
 * - Optional additional details
 * - Post-specific or user-level reporting
 * - Loading states
 * - Error handling
 *
 * @param props - ReportModal component props
 * @returns Report modal element or null if not open
 *
 * @example
 * ```tsx
 * <ReportModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   targetUserId="user-123"
 *   targetDisplayName="Alice"
 *   postId="post-456" // Optional
 *   onSuccess={() => refreshFeed()}
 * />
 * ```
 */
'use client';

import { Flag, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName: string;
  postId?: string;
  onSuccess?: () => void;
}

type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'inappropriate_content'
  | 'impersonation'
  | 'other';

const reportReasons: {
  value: ReportReason;
  label: string;
  description: string;
}[] = [
  {
    value: 'spam',
    label: 'Spam',
    description: 'Repetitive or unwanted promotional content',
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Bullying, threats, or targeted attacks',
  },
  {
    value: 'hate_speech',
    label: 'Hate Speech',
    description: 'Content promoting hatred against protected groups',
  },
  {
    value: 'misinformation',
    label: 'Misinformation',
    description: 'False or misleading information',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'NSFW or otherwise unsuitable material',
  },
  {
    value: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other reason not listed above',
  },
];

export function ReportModal({
  isOpen,
  onClose,
  targetUserId,
  targetDisplayName,
  postId,
  onSuccess,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [isReporting, startReporting] = useTransition();

  const handleReport = () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    startReporting(async () => {
      const response = await fetch('/api/moderation/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: targetUserId,
          postId: postId ?? null,
          reason,
          details: details || undefined,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        toast.error(error.message ?? 'Failed to submit report');
        return;
      }

      toast.success(
        'Report submitted. Thank you for helping keep the community safe.'
      );
      setReason(null);
      setDetails('');
      onClose();
      onSuccess?.();
    });
  };

  if (!isOpen) return null;

  const reportType = postId ? 'post' : 'user';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-xl">
            <Flag className="h-5 w-5 text-red-500" />
            Report {reportType === 'post' ? 'Post' : 'User'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-muted-foreground">
          Report {reportType === 'post' ? 'this post by' : ''}{' '}
          <strong>{targetDisplayName}</strong>
          {reportType === 'user' ? "'s profile" : ''}
        </p>

        <div className="mb-4">
          <label className="mb-2 block font-medium text-sm">
            What&apos;s the issue?
          </label>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {reportReasons.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReason(option.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  reason === option.value
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-muted-foreground text-xs">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-medium text-sm">
            Additional details (optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Provide any additional context that might help our moderation team"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-muted-foreground text-xs">
            False reports may result in action against your account. Reports are
            reviewed by our moderation team and handled confidentially.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isReporting}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReport}
            disabled={isReporting || !reason}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isReporting ? (
              <>Submitting...</>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
