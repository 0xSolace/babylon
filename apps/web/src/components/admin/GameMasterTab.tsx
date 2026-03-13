'use client';

import { cn } from '@babylon/shared';
import {
  Bot,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/shared/Skeleton';

interface GameMasterRun {
  id: string;
  gameDay: number;
  runType: 'daily' | 'pulse' | 'reactive';
  status: string;
  triggerType: string | null;
  planSummary: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface GameMasterAction {
  id: string;
  runId: string;
  actionType: string;
  authorityLevel: string;
  riskLevel: string;
  targetType: string;
  instructionText: string;
  status: string;
  requiresApproval: boolean;
  approvalReason: string | null;
  createdAt: string;
}

interface GameMasterDirective {
  id: string;
  directiveType: string;
  targetType: string;
  targetId: string;
  authorityLevel: string;
  promptOverlay: string;
  expiresAt: string | null;
}

interface GameMasterMessage {
  id: string;
  chatId: string;
  content: string;
  createdAt: string;
}

interface GameMasterDashboard {
  enabled: boolean;
  autoRunEnabled: boolean;
  autoRunPausedUntil: string | null;
  currentDay: number | null;
  latestRuns: GameMasterRun[];
  pendingActions: GameMasterAction[];
  activeDirectives: GameMasterDirective[];
  recentMessages: GameMasterMessage[];
  hourlyAutoActionCount: number;
}

export function GameMasterTab() {
  const [data, setData] = useState<GameMasterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [isMutating, startMutating] = useTransition();

  const load = useCallback((withRefresh = false) => {
    const fetchLogic = async () => {
      const response = await fetch('/api/admin/game-master');
      if (!response.ok) {
        toast.error('Failed to load Game Master dashboard');
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as GameMasterDashboard;
      setData(payload);
      setLoading(false);
    };

    if (withRefresh) {
      startRefresh(fetchLogic);
    } else {
      void fetchLogic();
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const runControl = async (
    action: 'run_daily' | 'run_pulse' | 'pause_auto_run' | 'resume_auto_run'
  ) => {
    startMutating(async () => {
      const response = await fetch('/api/admin/game-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        toast.error(`Failed to ${action.replaceAll('_', ' ')}`);
        return;
      }

      toast.success(`Game Master ${action.replaceAll('_', ' ')}`);
      load(true);
    });
  };

  const runActionMutation = async (
    actionId: string,
    action: 'approve' | 'reject' | 'retry'
  ) => {
    startMutating(async () => {
      const response = await fetch(
        `/api/admin/game-master/actions/${actionId}/${action}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        toast.error(`Failed to ${action} action`);
        return;
      }

      toast.success(`Action ${action}d`);
      load(true);
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load Game Master data.
      </div>
    );
  }

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'Pending';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-lg sm:text-xl">
            <Bot className="h-5 w-5 text-primary" />
            Game Master Halliday
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Internal narrative steering with typed execution and approval gates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <RefreshCw
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
            />
            Refresh
          </button>
          <button
            onClick={() => runControl('run_daily')}
            disabled={isMutating}
            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
          >
            Run Daily Pass
          </button>
          <button
            onClick={() => runControl('run_pulse')}
            disabled={isMutating}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Run Pulse
          </button>
          <button
            onClick={() =>
              runControl(
                data.autoRunEnabled ? 'pause_auto_run' : 'resume_auto_run'
              )
            }
            disabled={isMutating}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            {data.autoRunEnabled ? 'Pause Auto-Run' : 'Resume Auto-Run'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard
          icon={Sparkles}
          label="Status"
          value={data.enabled ? 'Enabled' : 'Disabled'}
          detail={data.autoRunEnabled ? 'Auto-run active' : 'Auto-run paused'}
        />
        <StatusCard
          icon={Clock3}
          label="Current Day"
          value={data.currentDay ?? 'N/A'}
          detail={`${data.latestRuns.length} recent runs`}
        />
        <StatusCard
          icon={TimerReset}
          label="Hourly Auto Actions"
          value={data.hourlyAutoActionCount}
          detail="Budget cap is 6/hour"
        />
        <StatusCard
          icon={ShieldAlert}
          label="Pending Approvals"
          value={
            data.pendingActions.filter(
              (action) => action.status === 'awaiting_approval'
            ).length
          }
          detail={`${data.activeDirectives.length} active directives`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-medium text-base">Live Activity</h3>
          <div className="space-y-3">
            {data.latestRuns.length === 0 ? (
              <EmptyState text="No Halliday runs recorded yet." />
            ) : (
              data.latestRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-2 py-1 text-primary text-xs uppercase">
                        {run.runType}
                      </span>
                      <span className="font-medium text-sm">
                        Day {run.gameDay}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(run.startedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {run.planSummary || 'No summary'}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Trigger: {run.triggerType || 'n/a'} · Status: {run.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-medium text-base">Halliday Threads</h3>
          <div className="space-y-3">
            {data.recentMessages.length === 0 ? (
              <EmptyState text="No internal control-thread messages yet." />
            ) : (
              data.recentMessages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-primary text-xs uppercase">
                      {message.chatId.replace('gm:', '')}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-medium text-base">Action Queue</h3>
        <div className="space-y-3">
          {data.pendingActions.length === 0 ? (
            <EmptyState text="No queued, failed, or approval-gated actions." />
          ) : (
            data.pendingActions.map((action) => {
              const needsApproval = action.status === 'awaiting_approval';
              return (
                <div
                  key={action.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-1 text-[11px] uppercase">
                        {action.actionType}
                      </span>
                      <span className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary uppercase">
                        {action.authorityLevel}
                      </span>
                      <span className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 uppercase">
                        {action.riskLevel}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(action.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{action.instructionText}</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Target: {action.targetType} · Status: {action.status}
                    {action.approvalReason ? ` · ${action.approvalReason}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {needsApproval && (
                      <>
                        <button
                          onClick={() =>
                            runActionMutation(action.id, 'approve')
                          }
                          disabled={isMutating}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => runActionMutation(action.id, 'reject')}
                          disabled={isMutating}
                          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"
                        >
                          <Pause className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    )}
                    {action.status === 'failed' && (
                      <button
                        onClick={() => runActionMutation(action.id, 'retry')}
                        disabled={isMutating}
                        className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <Play className="h-4 w-4" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-medium text-base">Active Directives</h3>
        <div className="space-y-3">
          {data.activeDirectives.length === 0 ? (
            <EmptyState text="No active directives are currently influencing the world." />
          ) : (
            data.activeDirectives.map((directive) => (
              <div
                key={directive.id}
                className="rounded-lg border border-border/60 bg-background/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-2 py-1 text-[11px] uppercase">
                      {directive.directiveType}
                    </span>
                    <span className="text-sm">
                      {directive.targetType}:{directive.targetId}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Expires {formatDate(directive.expiresAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm">{directive.promptOverlay}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="font-semibold text-2xl">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{detail}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
      {text}
    </div>
  );
}
