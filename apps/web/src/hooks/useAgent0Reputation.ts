import { AgentDetailsApiResponseSchema } from '@babylon/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/**
 * Agent0 profile data structure
 */
interface Agent0Profile {
  tokenId: number
  name: string
  walletAddress: string
  active: boolean
  reputation?: {
    trustScore: number
    accuracyScore: number
    totalBets: number
    winningBets: number
  }
}

/**
 * Agent0 reputation summary
 */
interface Agent0ReputationSummary {
  count: number
  averageScore: number
}

/**
 * Hook return type
 */
interface UseAgent0ReputationReturn {
  profile: Agent0Profile | null
  reputation: Agent0ReputationSummary | null
  loading: boolean
  error: Error | null
  isAgent0Available: boolean
  refetch: () => Promise<void>
}

interface Agent0QueryData {
  profile: Agent0Profile | null
  reputation: Agent0ReputationSummary | null
  isAgent0Available: boolean
}

/**
 * Hook to fetch Agent0 network reputation data for an agent
 *
 * @param agentId - The agent's database ID (used to lookup Agent0 tokenId)
 * @returns Agent0 profile, reputation summary, loading state, and availability
 */
export function useAgent0Reputation(
  agentId?: string,
): UseAgent0ReputationReturn {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent0Reputation', agentId],
    queryFn: async (): Promise<Agent0QueryData> => {
      const response = await fetch(`/api/agents/${agentId}`)

      if (!response.ok) {
        if (response.status === 404) {
          return { profile: null, reputation: null, isAgent0Available: false }
        }
        throw new Error(`Failed to fetch agent: ${response.statusText}`)
      }

      const json = await response.json()
      const responseData = AgentDetailsApiResponseSchema.parse(json)
      const agent = responseData.agent

      if (!agent?.agent0TokenId) {
        return { profile: null, reputation: null, isAgent0Available: false }
      }

      const agent0Profile: Agent0Profile = {
        tokenId: agent.agent0TokenId,
        name: agent.name,
        walletAddress: agent.walletAddress,
        active: agent.isActive,
        reputation: agent.reputation
          ? {
              trustScore: agent.reputation.trustScore ?? 0,
              accuracyScore: agent.reputation.accuracyScore ?? 0,
              totalBets: agent.reputation.totalBets ?? 0,
              winningBets: agent.reputation.winningBets ?? 0,
            }
          : undefined,
      }

      const reputationSummary: Agent0ReputationSummary | null =
        agent.reputation?.feedbackCount !== undefined
          ? {
              count: agent.reputation.feedbackCount,
              averageScore: agent.reputation.averageScore ?? 0,
            }
          : null

      return {
        profile: agent0Profile,
        reputation: reputationSummary,
        isAgent0Available: true,
      }
    },
    enabled: !!agentId,
    staleTime: 60000,
  })

  const refetch = useCallback(async () => {
    if (agentId) {
      await queryClient.invalidateQueries({
        queryKey: ['agent0Reputation', agentId],
      })
    }
  }, [queryClient, agentId])

  return {
    profile: data?.profile ?? null,
    reputation: data?.reputation ?? null,
    loading: isLoading,
    error: error as Error | null,
    isAgent0Available: data?.isAgent0Available ?? false,
    refetch,
  }
}
