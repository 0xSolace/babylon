'use client';

import { Skeleton } from '@/components/shared/Skeleton';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Edit, Globe, Newspaper, RefreshCw, Save, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type WorldFact = {
  id: string;
  category: string;
  key: string;
  label: string;
  value: string;
  source?: string;
  priority: number;
  isActive: boolean;
  lastUpdated: string;
};

type WorldFactsData = {
  facts: WorldFact[];
  recentParodies: Array<{
    id: string;
    parodyTitle: string;
    originalTitle: string;
    generatedAt: string;
  }>;
  context: {
    crypto: string;
    politics: string;
    economy: string;
    technology: string;
    general: string;
    headlines?: string;
  };
};

export function WorldFactsSection() {
  const [data, setData] = useState<WorldFactsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingFact, setEditingFact] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ value: string }>({
    value: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/world-facts');
      if (!response.ok) throw new Error('Failed to fetch world facts');
      let result: WorldFactsData | null = null;
      try {
        result = await response.json();
      } catch (parseError) {
        logger.error(
          'Failed to parse world facts response',
          { error: parseError },
          'WorldFactsSection'
        );
        throw new Error('Failed to parse response');
      }
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: string, actionData?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/world-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: actionData }),
      });

      if (!response.ok) throw new Error(`Failed to ${action}`);

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const startEditing = (fact: WorldFact) => {
    setEditingFact(fact.id);
    setEditValues({ value: fact.value });
  };

  const saveEdit = async (fact: WorldFact) => {
    await handleAction('update_fact', {
      category: fact.category,
      key: fact.key,
      label: fact.label,
      value: editValues.value,
      source: fact.source,
      priority: fact.priority,
    });
    setEditingFact(null);
  };

  const cancelEdit = () => {
    setEditingFact(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-500">{error || 'Failed to load world facts'}</div>
    );
  }

  // Group facts by category
  const factsByCategory = data.facts.reduce(
    (acc, fact) => {
      if (!acc[fact.category]) acc[fact.category] = [];
      acc[fact.category]?.push(fact);
      return acc;
    },
    {} as Record<string, WorldFact[]>
  );

  const categoryColors = {
    crypto: 'orange',
    politics: 'blue',
    economy: 'green',
    technology: 'purple',
    general: 'gray',
  } as const;

  const getCategoryColor = (category: string) => {
    return categoryColors[category as keyof typeof categoryColors] || 'gray';
  };

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
              Manage general world state, RSS feeds, and parody headlines for game context
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={actionLoading}
              className="rounded-lg bg-blue-500/20 px-4 py-2 text-blue-500 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', actionLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => handleAction('fetch_rss')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-4 py-3 text-orange-500 transition-colors hover:bg-orange-500/30 disabled:opacity-50"
          >
            <Newspaper className="h-5 w-5" />
            Fetch RSS Feeds
          </button>

          <button
            type="button"
            onClick={() => handleAction('generate_parodies')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-3 text-purple-500 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
          >
            <Zap className="h-5 w-5" />
            Generate Parodies
          </button>

          <button
            type="button"
            onClick={() => handleAction('refresh_mappings')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-500/20 px-4 py-3 text-green-500 transition-colors hover:bg-green-500/30 disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh Mappings
          </button>
        </div>
      </div>

      {/* World Facts by Category */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg text-muted-foreground uppercase tracking-wide">
          Current World Facts
        </h4>

        {Object.entries(factsByCategory).map(([category, facts]) => {
          const color = getCategoryColor(category);
          return (
            <div key={category} className="rounded-lg border border-border bg-card p-4">
              <h5
                className={cn(
                  'mb-3 font-semibold text-sm uppercase tracking-wide',
                  `text-${color}-500`
                )}
              >
                {category}
              </h5>

              <div className="space-y-2">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="flex items-start justify-between gap-4 rounded-lg bg-accent/30 p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-1">
                      <div className="mb-1 font-medium text-sm">{fact.label}</div>
                      {editingFact === fact.id ? (
                        <textarea
                          value={editValues.value}
                          onChange={(e) => setEditValues({ value: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          rows={3}
                        />
                      ) : (
                        <div className="text-muted-foreground text-sm">{fact.value}</div>
                      )}
                      {fact.source && (
                        <div className="mt-1 text-muted-foreground text-xs">
                          Source: {fact.source} • Last updated:{' '}
                          {new Date(fact.lastUpdated).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editingFact === fact.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(fact)}
                            disabled={actionLoading}
                            className="rounded-lg bg-green-500/20 p-2 text-green-500 transition-colors hover:bg-green-500/30 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg bg-red-500/20 p-2 text-red-500 transition-colors hover:bg-red-500/30"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(fact)}
                          className="rounded-lg bg-blue-500/20 p-2 text-blue-500 transition-colors hover:bg-blue-500/30"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
                <div className="mb-1 font-medium text-sm">{parody.parodyTitle}</div>
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
  );
}
