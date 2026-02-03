'use client';

/**
 * InstructionCard Component
 *
 * Displays a single agent instruction with status indicators,
 * category badges, and action buttons.
 */

import { cn } from '@babylon/shared';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MessageSquare,
  RotateCcw,
  Settings,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  AgentInstruction,
  InstructionCategory,
  InstructionDirectiveType,
  InstructionStatus,
} from '@/hooks/useAgentInstructions';

// =============================================================================
// Constants
// =============================================================================

const DIRECTIVE_CONFIG: Record<
  InstructionDirectiveType,
  { label: string; color: string; icon: typeof Star }
> = {
  always: {
    label: 'ALWAYS',
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
    icon: CheckCircle2,
  },
  never: {
    label: 'NEVER',
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
    icon: Ban,
  },
  prefer: {
    label: 'PREFER',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    icon: Star,
  },
  avoid: {
    label: 'AVOID',
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    icon: AlertTriangle,
  },
  until: {
    label: 'UNTIL',
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    icon: Clock,
  },
};

const CATEGORY_CONFIG: Record<
  InstructionCategory,
  { label: string; icon: typeof TrendingUp }
> = {
  trading: { label: 'Trading', icon: TrendingUp },
  social: { label: 'Social', icon: MessageSquare },
  behavior: { label: 'Behavior', icon: Settings },
  general: { label: 'General', icon: Heart },
};

const STATUS_CONFIG: Record<
  InstructionStatus,
  { label: string; color: string }
> = {
  active: { label: 'Active', color: 'text-green-500' },
  expired: { label: 'Expired', color: 'text-muted-foreground' },
  revoked: { label: 'Revoked', color: 'text-red-500' },
  completed: { label: 'Completed', color: 'text-blue-500' },
};

// =============================================================================
// Component
// =============================================================================

interface InstructionCardProps {
  instruction: AgentInstruction;
  onRevoke?: (instructionId: string) => void;
  isRevoking?: boolean;
}

export function InstructionCard({
  instruction,
  onRevoke,
  isRevoking,
}: InstructionCardProps) {
  const directiveConfig = DIRECTIVE_CONFIG[instruction.directiveType];
  const categoryConfig = CATEGORY_CONFIG[instruction.category];
  const statusConfig = STATUS_CONFIG[instruction.status];
  const DirectiveIcon = directiveConfig.icon;
  const CategoryIcon = categoryConfig.icon;

  const displayRule = instruction.parsedRule || instruction.content;
  const createdAt = new Date(instruction.createdAt);
  const validUntil = instruction.validUntil
    ? new Date(instruction.validUntil)
    : null;
  const isActive = instruction.status === 'active';

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-4 transition-all',
        isActive
          ? 'border-border bg-card/50 hover:border-primary/50'
          : 'border-border/50 bg-muted/30 opacity-75'
      )}
    >
      {/* Header: Directive Type + Actions */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Directive Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold text-xs',
              directiveConfig.color
            )}
          >
            <DirectiveIcon className="h-3.5 w-3.5" />
            {directiveConfig.label}
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <span className="font-medium">P{instruction.priority}</span>
          </div>
        </div>

        {/* Actions */}
        {isActive && onRevoke && (
          <button
            onClick={() => onRevoke(instruction.id)}
            disabled={isRevoking}
            className={cn(
              'rounded-md p-1.5 text-muted-foreground transition-colors',
              'hover:bg-red-500/10 hover:text-red-500',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            title="Revoke instruction"
          >
            {isRevoking ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Status badge for non-active */}
        {!isActive && (
          <span className={cn('text-xs font-medium', statusConfig.color)}>
            {statusConfig.label}
          </span>
        )}
      </div>

      {/* Rule Content */}
      <p className="mb-3 leading-relaxed text-foreground">{displayRule}</p>

      {/* Footer: Category + Timestamps */}
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
        {/* Category */}
        <div className="flex items-center gap-1">
          <CategoryIcon className="h-3.5 w-3.5" />
          <span>{categoryConfig.label}</span>
        </div>

        {/* Created */}
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDistanceToNow(createdAt, { addSuffix: true })}</span>
        </div>

        {/* Expiry */}
        {validUntil && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {validUntil > new Date()
                ? `Expires ${formatDistanceToNow(validUntil, { addSuffix: true })}`
                : 'Expired'}
            </span>
          </div>
        )}

        {/* Conditions indicator */}
        {instruction.conditions &&
          Object.keys(instruction.conditions).length > 0 && (
            <div
              className="flex items-center gap-1 text-purple-500"
              title="Has conditions"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Conditional</span>
            </div>
          )}
      </div>
    </div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function InstructionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-full bg-muted" />
          <div className="h-4 w-8 rounded bg-muted" />
        </div>
      </div>
      <div className="mb-3 space-y-2">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
      <div className="flex gap-3">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

