'use client';

import { cn } from '@/lib/utils';
import { Shield, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

type OnChainBadgeProps = {
  isRegistered: boolean;
  nftTokenId?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
};

export function OnChainBadge({
  isRegistered,
  nftTokenId,
  size = 'md',
  showLabel = false,
  className,
}: OnChainBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (isRegistered && nftTokenId) {
    return (
      <button
        type="button"
        className={cn('relative inline-flex items-center gap-1', className)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <ShieldCheck
          className={cn(sizeClasses[size], 'shrink-0 text-green-500')}
          fill="currentColor"
        />
        {showLabel && (
          <span className="font-medium text-green-600 text-xs dark:text-green-400">
            Verified On-Chain
          </span>
        )}
        {showTooltip && (
          <div className="-translate-x-1/2 absolute bottom-full left-1/2 z-50 mb-2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-green-500">✓ Verified On-Chain</p>
              <p className="text-muted-foreground">NFT Token ID: #{nftTokenId}</p>
              <p className="text-muted-foreground">Blockchain identity verified</p>
            </div>
            <div className="-translate-x-1/2 -mt-[1px] absolute top-full left-1/2">
              <div className="border-4 border-transparent border-t-border" />
            </div>
          </div>
        )}
      </button>
    );
  }

  // Not registered on-chain
  return (
    <button
      type="button"
      className={cn('relative inline-flex items-center gap-1', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <Shield className={cn(sizeClasses[size], 'shrink-0 text-muted-foreground/50')} />
      {showLabel && <span className="font-medium text-muted-foreground text-xs">Not Verified</span>}
      {showTooltip && (
        <div className="-translate-x-1/2 absolute bottom-full left-1/2 z-50 mb-2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-muted-foreground">⚠ Not Verified On-Chain</p>
            <p className="text-muted-foreground/70">No blockchain identity</p>
            <p className="text-muted-foreground/70">Limited reputation features</p>
          </div>
          <div className="-translate-x-1/2 -mt-[1px] absolute top-full left-1/2">
            <div className="border-4 border-transparent border-t-border" />
          </div>
        </div>
      )}
    </button>
  );
}
