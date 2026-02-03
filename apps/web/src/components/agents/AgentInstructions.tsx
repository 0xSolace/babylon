'use client';

/**
 * AgentInstructions Component
 *
 * Main panel for viewing and managing agent instructions.
 * Displays in the Agent Detail page as a tab.
 */

import { cn } from '@babylon/shared';
import { AlertCircle, FileText, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateInstructionModal } from './CreateInstructionModal';
import { InstructionCard, InstructionCardSkeleton } from './InstructionCard';
import type { InstructionStatus } from '@/hooks/useAgentInstructions';
import { useAgentInstructions } from '@/hooks/useAgentInstructions';

// =============================================================================
// Types
// =============================================================================

interface AgentInstructionsProps {
  agentId: string;
}

const STATUS_TABS: { value: InstructionStatus | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

// =============================================================================
// Component
// =============================================================================

export function AgentInstructions({ agentId }: AgentInstructionsProps) {
  const {
    instructions,
    statusFilter,
    setStatusFilter,
    isLoading,
    error,
    createInstruction,
    revokeInstruction,
    refresh,
    isMutating,
  } = useAgentInstructions(agentId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (instructionId: string) => {
    setRevokingId(instructionId);
    const success = await revokeInstruction(instructionId);
    if (success) {
      toast.success('Instruction revoked');
    } else {
      toast.error('Failed to revoke instruction');
    }
    setRevokingId(null);
  };

  const handleCreate = async (
    input: Parameters<typeof createInstruction>[0]
  ) => {
    const success = await createInstruction(input);
    if (success) {
      toast.success('Instruction created');
    } else {
      toast.error('Failed to create instruction');
    }
    return success;
  };

  // Count active instructions
  const activeCount =
    statusFilter === 'active'
      ? instructions.length
      : statusFilter === 'all'
        ? instructions.filter((i) => i.status === 'active').length
        : 0;

  return (
    <div className="rounded-lg border border-border bg-card/50 backdrop-blur">
      {/* Header */}
      <div className="flex flex-col gap-4 border-border border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-lg">Instructions</h3>
            <p className="text-muted-foreground text-sm">
              Strategic directives your agent will follow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className={cn(
              'rounded-lg border border-border p-2 transition-colors',
              'hover:bg-accent disabled:opacity-50'
            )}
            title="Refresh"
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Instruction</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto border-border border-b p-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
              statusFilter === tab.value
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.value === 'active' && activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Error State */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && instructions.length === 0 && (
          <div className="space-y-3">
            <InstructionCardSkeleton />
            <InstructionCardSkeleton />
            <InstructionCardSkeleton />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && instructions.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-sidebar py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h4 className="mb-2 font-medium text-lg">No instructions</h4>
            <p className="mb-4 max-w-md text-muted-foreground text-sm">
              {statusFilter === 'active'
                ? "You haven't created any active instructions yet. Instructions help guide your agent's behavior."
                : `No ${statusFilter} instructions found.`}
            </p>
            {statusFilter === 'active' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Plus className="h-4 w-4" />
                Create your first instruction
              </button>
            )}
          </div>
        )}

        {/* Instructions List */}
        {instructions.length > 0 && (
          <div className="space-y-3">
            {instructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
                onRevoke={
                  instruction.status === 'active' ? handleRevoke : undefined
                }
                isRevoking={revokingId === instruction.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateInstructionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isMutating}
      />
    </div>
  );
}

