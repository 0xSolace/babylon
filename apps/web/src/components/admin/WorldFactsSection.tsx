import { cn } from '@babylon/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Globe, Newspaper, RefreshCw, Save, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { Skeleton } from '@/components/shared/Skeleton'

/**
 * World fact structure for world facts section.
 */
interface WorldFact {
  id: string
  value: string
  category?: string
  isActive: boolean
  lastUpdated: string
}

/**
 * World facts data structure from API.
 */
interface WorldFactsData {
  facts: WorldFact[]
  recentParodies: Array<{
    id: string
    parodyTitle: string
    originalTitle: string
    generatedAt: string
  }>
  context: {
    crypto: string
    politics: string
    economy: string
    technology: string
    general: string
    headlines?: string
  }
  realityGroundingContent?: string
}

/**
 * World facts section component for managing world facts and context.
 *
 * Provides interface for viewing, editing, adding, and managing world facts
 * used for reality grounding. Shows recent parodies and context information.
 * Includes fact editing, activation/deactivation, and category management.
 *
 * Features:
 * - World facts list
 * - Fact editing
 * - Add fact functionality
 * - Activate/deactivate facts
 * - Recent parodies display
 * - Context display
 * - Loading states
 * - Error handling
 *
 * @returns World facts section element
 */
export function WorldFactsSection() {
  const queryClient = useQueryClient()
  const [editingFact, setEditingFact] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [newFactValue, setNewFactValue] = useState<string>('')
  const [newFactCategory, setNewFactCategory] = useState<'general'>('general')

  const { data, isLoading, error, refetch } = useQuery<WorldFactsData>({
    queryKey: ['admin', 'world-facts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/world-facts')
      if (!response.ok) {
        throw new Error('Failed to fetch world facts')
      }
      return response.json()
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      actionData,
    }: {
      action: string
      actionData?: Record<string, unknown>
    }) => {
      const response = await fetch('/api/admin/world-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: actionData }),
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action}`)
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'world-facts'] })
    },
  })

  const startEditing = (fact: WorldFact) => {
    setEditingFact(fact.id)
    setEditValue(fact.value)
  }

  const saveEdit = async (fact: WorldFact) => {
    await actionMutation.mutateAsync({
      action: 'update_fact',
      actionData: {
        id: fact.id,
        value: editValue,
      },
    })
    setEditingFact(null)
    setEditValue('')
  }

  const addFact = async () => {
    if (!newFactValue.trim()) return
    await actionMutation.mutateAsync({
      action: 'add_fact',
      actionData: {
        value: newFactValue.trim(),
        category: newFactCategory,
      },
    })
    setNewFactValue('')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-500">
        {error instanceof Error ? error.message : 'Failed to load world facts'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* World Facts Header */}
      <div className="rounded-lg border border-border bg-gradient-to-br from-card to-accent/20 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-xl">
              <Globe className="h-6 w-6 text-blue-500" />
              World Facts & Context
            </h3>
            <p className="text-muted-foreground text-sm">
              Manage general world state, RSS feeds, and parody headlines for
              game context
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={actionMutation.isPending}
              className="rounded-lg bg-blue-500/20 px-4 py-2 text-blue-500 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  actionMutation.isPending && 'animate-spin',
                )}
              />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => actionMutation.mutate({ action: 'fetch_rss' })}
            disabled={actionMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-4 py-3 text-orange-500 transition-colors hover:bg-orange-500/30 disabled:opacity-50"
          >
            <Newspaper className="h-5 w-5" />
            Fetch RSS Feeds
          </button>

          <button
            type="button"
            onClick={() =>
              actionMutation.mutate({ action: 'generate_parodies' })
            }
            disabled={actionMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-3 text-purple-500 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
          >
            <Zap className="h-5 w-5" />
            Generate Parodies
          </button>

          <button
            type="button"
            onClick={() =>
              actionMutation.mutate({ action: 'refresh_mappings' })
            }
            disabled={actionMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-500/20 px-4 py-3 text-green-500 transition-colors hover:bg-green-500/30 disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh Mappings
          </button>
        </div>
      </div>

      {/* World Facts */}
      <div className="space-y-6">
        {/* General World Facts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-lg text-muted-foreground uppercase tracking-wide">
              World Facts
            </h4>
          </div>

          {/* Add New Fact */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex gap-2">
              <select
                value={newFactCategory}
                onChange={() => {
                  // Currently only 'general' category is supported
                  setNewFactCategory('general')
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="general">World Fact</option>
              </select>
              <textarea
                value={newFactValue}
                onChange={(e) => setNewFactValue(e.target.value)}
                placeholder="Add a new fact (e.g., 'Bitcoin Price: ~$100,000')"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    addFact()
                  }
                }}
              />
              <button
                type="button"
                onClick={addFact}
                disabled={actionMutation.isPending || !newFactValue.trim()}
                className="rounded-lg bg-green-500/20 px-4 py-2 text-green-500 transition-colors hover:bg-green-500/30 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Facts List */}
          <div className="space-y-2">
            {data.facts
              .filter((f) => f.category === 'general' || !f.category)
              .map((fact) => (
                <div
                  key={fact.id}
                  className="flex items-start justify-between gap-4 rounded-lg bg-accent/30 p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex-1">
                    {editingFact === fact.id ? (
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        rows={3}
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        {fact.value}
                      </div>
                    )}
                    <div className="mt-1 text-muted-foreground text-xs">
                      Last updated:{' '}
                      {new Date(fact.lastUpdated).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingFact === fact.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(fact)}
                          disabled={actionMutation.isPending}
                          className="rounded-lg bg-green-500/20 p-2 text-green-500 transition-colors hover:bg-green-500/30 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFact(null)
                            setEditValue('')
                          }}
                          className="rounded-lg bg-red-500/20 p-2 text-red-500 transition-colors hover:bg-red-500/30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditing(fact)}
                          className="rounded-lg bg-blue-500/20 p-2 text-blue-500 transition-colors hover:bg-blue-500/30"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              action: 'delete_fact',
                              actionData: { id: fact.id },
                            })
                          }
                          disabled={actionMutation.isPending}
                          className="rounded-lg bg-red-500/20 p-2 text-red-500 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Reality Grounding Facts (Static) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-lg text-muted-foreground uppercase tracking-wide">
              Reality Grounding (Static Context)
            </h4>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-muted-foreground text-sm">
              {data.realityGroundingContent ||
                'No reality grounding content found.'}
            </pre>
            <p className="mt-2 text-muted-foreground text-xs">
              This content is loaded from{' '}
              <code>src/data/reality-grounding.ts</code> and injected into
              prompts.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Parody Headlines */}
      {data.recentParodies.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 font-semibold text-lg text-muted-foreground uppercase tracking-wide">
            Recent Parody Headlines
          </h4>

          <div className="space-y-2">
            {data.recentParodies.map((parody) => (
              <div key={parody.id} className="rounded-lg bg-accent/30 p-3">
                <div className="mb-1 font-medium text-sm">
                  {parody.parodyTitle}
                </div>
                <div className="text-muted-foreground text-xs">
                  Original: {parody.originalTitle}
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Generated: {new Date(parody.generatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
