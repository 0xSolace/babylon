'use client';

import { cn } from '@babylon/shared';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

type DigestFrequency = 'hourly' | 'daily' | 'weekly';
type DeliveryChannel = 'in-app' | 'email' | 'both';

const frequencyOptions: { value: DigestFrequency; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const channelOptions: { value: DeliveryChannel; label: string }[] = [
  { value: 'in-app', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Both' },
];

/**
 * Notifications tab for Settings page.
 *
 * Covers Tier 2 (Performance digest) settings only:
 * - Tier 1 (outcome notifications) is always on — not shown here
 * - Tier 3 (feed signals) is part of the feed — not shown here
 */
export function NotificationsTab() {
  // TODO: wire to backend API when available
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [frequency, setFrequency] = useState<DigestFrequency>('daily');
  const [channel, setChannel] = useState<DeliveryChannel>('both');

  return (
    <div className="space-y-6">
      {/* Performance Digest */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Performance Digest</h3>
          <p className="mt-0.5 text-muted-foreground text-sm">
            Summary of how you and your agents performed.
          </p>
        </div>
        <Switch
          checked={digestEnabled}
          onCheckedChange={setDigestEnabled}
        />
      </div>

      {digestEnabled && (
        <>
          {/* Frequency */}
          <div>
            <label className="mb-2 block font-medium text-sm">
              Frequency
            </label>
            <div className="flex gap-2">
              {frequencyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={cn(
                    'rounded-lg border px-4 py-2 font-medium text-sm transition-colors',
                    frequency === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Channel */}
          <div>
            <label className="mb-2 block font-medium text-sm">
              Delivery
            </label>
            <div className="flex gap-2">
              {channelOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={cn(
                    'rounded-lg border px-4 py-2 font-medium text-sm transition-colors',
                    channel === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
