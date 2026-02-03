'use client';

/**
 * Hook for managing agent instructions.
 *
 * Provides CRUD operations for agent instructions with real-time updates.
 * Used by the AgentInstructions component in the Command Center.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';

// =============================================================================
// Types
// =============================================================================

export type InstructionCategory = 'trading' | 'social' | 'behavior' | 'general';
export type InstructionDirectiveType =
  | 'always'
  | 'never'
  | 'prefer'
  | 'avoid'
  | 'until';
export type InstructionStatus = 'active' | 'expired' | 'revoked' | 'completed';

export interface InstructionCondition {
  priceAbove?: { ticker: string; value: number };
  priceBelow?: { ticker: string; value: number };
  afterDate?: string;
  beforeDate?: string;
}

export interface AgentInstruction {
  id: string;
  content: string;
  parsedRule: string | null;
  category: InstructionCategory;
  directiveType: InstructionDirectiveType;
  priority: number;
  status: InstructionStatus;
  validFrom: string;
  validUntil: string | null;
  conditions: InstructionCondition | null;
  createdAt: string;
}

export interface CreateInstructionInput {
  rule: string;
  category: InstructionCategory;
  directiveType: InstructionDirectiveType;
  priority?: number;
  validUntil?: string | null;
  conditions?: InstructionCondition | null;
}

interface UseAgentInstructionsReturn {
  /** List of instructions for the current filter */
  instructions: AgentInstruction[];
  /** Current status filter */
  statusFilter: InstructionStatus | 'all';
  /** Set the status filter */
  setStatusFilter: (status: InstructionStatus | 'all') => void;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Create a new instruction */
  createInstruction: (input: CreateInstructionInput) => Promise<boolean>;
  /** Revoke an instruction */
  revokeInstruction: (instructionId: string) => Promise<boolean>;
  /** Refresh the instructions list */
  refresh: () => Promise<void>;
  /** Whether a mutation is in progress */
  isMutating: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAgentInstructions(
  agentId: string | undefined
): UseAgentInstructionsReturn {
  const { getAccessToken, authenticated } = useAuth();
  const [instructions, setInstructions] = useState<AgentInstruction[]>([]);
  const [statusFilter, setStatusFilter] = useState<InstructionStatus | 'all'>(
    'active'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch instructions from API
  const fetchInstructions = useCallback(async () => {
    if (!agentId || !authenticated) {
      setInstructions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({ status: statusFilter });
    const response = await fetch(
      `/api/agents/${agentId}/instructions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Failed to fetch instructions');
      setIsLoading(false);
      return;
    }

    const data = await response.json();
    setInstructions(data.instructions || []);
    setIsLoading(false);
  }, [agentId, authenticated, getAccessToken, statusFilter]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchInstructions();
  }, [fetchInstructions]);

  // Create a new instruction
  const createInstruction = useCallback(
    async (input: CreateInstructionInput): Promise<boolean> => {
      if (!agentId || !authenticated) {
        setError('Authentication required');
        return false;
      }

      setIsMutating(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        setIsMutating(false);
        return false;
      }

      const response = await fetch(`/api/agents/${agentId}/instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to create instruction');
        setIsMutating(false);
        return false;
      }

      // Refresh the list
      await fetchInstructions();
      setIsMutating(false);
      return true;
    },
    [agentId, authenticated, getAccessToken, fetchInstructions]
  );

  // Revoke an instruction
  const revokeInstruction = useCallback(
    async (instructionId: string): Promise<boolean> => {
      if (!agentId || !authenticated) {
        setError('Authentication required');
        return false;
      }

      setIsMutating(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        setIsMutating(false);
        return false;
      }

      const response = await fetch(`/api/agents/${agentId}/instructions`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instructionId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to revoke instruction');
        setIsMutating(false);
        return false;
      }

      // Refresh the list
      await fetchInstructions();
      setIsMutating(false);
      return true;
    },
    [agentId, authenticated, getAccessToken, fetchInstructions]
  );

  return useMemo(
    () => ({
      instructions,
      statusFilter,
      setStatusFilter,
      isLoading,
      error,
      createInstruction,
      revokeInstruction,
      refresh: fetchInstructions,
      isMutating,
    }),
    [
      instructions,
      statusFilter,
      isLoading,
      error,
      createInstruction,
      revokeInstruction,
      fetchInstructions,
      isMutating,
    ]
  );
}

