'use client';

import { cn } from '@babylon/shared';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

/**
 * Viewport-aware tooltip built on Radix UI.
 *
 * Automatically repositions when near viewport edges — no clipping.
 * Use this instead of hand-rolled absolute-positioned tooltips.
 *
 * @example
 * ```tsx
 * <Tooltip content="Verified on-chain">
 *   <ShieldCheck className="h-4 w-4" />
 * </Tooltip>
 *
 * // With rich content
 * <Tooltip content={<div><p>Title</p><p>Description</p></div>}>
 *   <button>Hover me</button>
 * </Tooltip>
 * ```
 */

/** Re-exported for use at the app root (see Providers.tsx). */
export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  /** Side to prefer — will flip if not enough space */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment along the side */
  align?: 'start' | 'center' | 'end';
  /** Additional class for the content container */
  className?: string;
  /** Whether to show an arrow pointer */
  arrow?: boolean;
}

function TooltipContent({
  content,
  side = 'bottom',
  align = 'center',
  className,
  arrow = true,
}: Omit<TooltipProps, 'children' | 'delayDuration'>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'z-50 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg',
          'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 animate-in data-[state=closed]:animate-out',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
      >
        {content}
        {arrow && (
          <TooltipPrimitive.Arrow
            className="fill-border"
            width={8}
            height={4}
          />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export function Tooltip({
  children,
  content,
  side,
  align,
  className,
  arrow,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent
        content={content}
        side={side}
        align={align}
        className={className}
        arrow={arrow}
      />
    </TooltipPrimitive.Root>
  );
}
