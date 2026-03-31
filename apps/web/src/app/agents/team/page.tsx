'use client';

export const dynamic = 'force-dynamic';

import { cn, formatCompactCurrency } from '@babylon/shared';
import {
  ChevronLeft,
  ExternalLink,
  List,
  MessageCircle,
  Plus,
  Settings,
  Square,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AgentEditModal } from '@/components/agents/AgentEditModal';
import { TeamChatView } from '@/components/chats';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { SpotlightTutorial } from '@/components/tutorial/SpotlightTutorial';
import { TutorialHelpButton } from '@/components/tutorial/TutorialHelpButton';
import { useAgentsTeamDashboard } from '@/hooks/useAgentsTeamDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useOwnedAgentTradeRefresh } from '@/hooks/useOwnedAgentTradeRefresh';
import { useTeamChat } from '@/hooks/useTeamChat';
import {
  TUTORIAL_PERPS_DATA,
  TUTORIAL_PERPS_ENTITY_ID,
} from './_components/tutorial/steps';
import { useAgentsTutorial } from './_components/tutorial/useAgentsTutorial';
import { ConversationList } from './ConversationList';
import type { AgentStats, TeamChatAgent } from './MemberList';

/**
 * View state for the main content area.
 * - 'chat': Team chat (default)
 * - 'chat-list': Conversation list (replaces chat)
 * - 'agent-detail': Single agent detail view
 */
type TeamView = 'chat' | 'chat-list' | 'agent-detail';

/** Threshold: above this many agents, condense to avatars only */
const CONDENSE_THRESHOLD = 5;

/**
 * Agent Team Chat Page
 *
 * Agents in a horizontal row at top, chat below.
 * "Chats" button in chat area swaps to conversation list.
 */
export default function TeamChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated, user, login, getAccessToken } = useAuth();

  const {
    teamChat,
    chatDetails,
    loading,
    sending,
    error,
    sseConnected,
    isLoadingMore,
    hasMore,
    messageInput,
    handleInputChange,
    typingUsers,
    thinkingAgents,
    sendError,
    messagesEndRef,
    topSentinelRef,
    sendMessage,
    toggleReaction,
    handleScroll,
    scrollToBottom,
    refresh: refreshTeamChat,
    replyToMessage,
    handleReplyToMessage,
    clearReplyToMessage,
    processingAgentIds,
    stopAgent,
    tagAgentInInput,
    conversations,
    conversationsLoading,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  } = useTeamChat();

  // Main content view state
  const [teamView, setTeamView] = useState<TeamView>('chat');
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);

  const { agentStatsMap, refresh: refreshTeamSummary } = useAgentsTeamDashboard(
    {
      enabled: ready && authenticated,
      getAccessToken,
    }
  );

  // Edit agent modal state
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentData, setEditingAgentData] = useState<{
    id: string;
    username?: string | null;
    name: string;
    description?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    system: string;
    bio?: string[];
    personality?: string;
    tradingStrategy?: string;
    modelTier: 'free' | 'pro';
    isActive: boolean;
    autonomousEnabled: boolean;
    autonomousPosting?: boolean;
    autonomousCommenting?: boolean;
    autonomousDMs?: boolean;
    autonomousGroupChats?: boolean;
    a2aEnabled?: boolean;
  } | null>(null);

  // Tutorial
  const tutorial = useAgentsTutorial({
    onBeforeStart: () => {
      setTeamView('chat');
    },
  });

  const prevTutorialStepRef = useRef(tutorial.currentStep);
  useEffect(() => {
    const prev = prevTutorialStepRef.current;
    prevTutorialStepRef.current = tutorial.currentStep;
    if (tutorial.isActive && prev === 1 && tutorial.currentStep === 2) {
      router.push('/agents/create');
    }
  }, [tutorial.isActive, tutorial.currentStep, router]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      router.push('/agents/create');
      router.replace('/agents/team', { scroll: false });
    }
  }, [searchParams, router]);

  // Tutorial chat details with fake messages
  const tutorialChatDetails = useMemo(() => {
    if (!chatDetails) return chatDetails;
    if (!tutorial.isActive || tutorial.currentStep < 2) return chatDetails;

    const agentSenderId = teamChat?.agents?.[0]?.id ?? 'tutorial-agent';
    const agentName =
      teamChat?.agents?.[0]?.displayName ??
      teamChat?.agents?.[0]?.username ??
      'Agent';
    const now = new Date().toISOString();

    return {
      ...chatDetails,
      messages: [
        {
          id: 'tutorial-msg-user',
          content: `@${agentName}, what are the top trending perpetual markets right now?`,
          senderId: user?.id ?? 'tutorial-user',
          createdAt: now,
          stableKey: 'tutorial-msg-user',
        },
        {
          id: 'tutorial-msg-agent',
          content:
            "Here are the top trending perpetual markets I'm watching right now. BTC is showing strong momentum and ETH has interesting volume patterns.",
          senderId: agentSenderId,
          createdAt: now,
          stableKey: 'tutorial-msg-agent',
          metadata: {
            tags: [
              {
                type: 'perps' as const,
                label: 'Perps Markets',
                icon: 'TrendingUp' as const,
                entityId: TUTORIAL_PERPS_ENTITY_ID,
                data: TUTORIAL_PERPS_DATA,
              },
            ],
          },
        },
      ],
    };
  }, [
    chatDetails,
    tutorial.isActive,
    tutorial.currentStep,
    teamChat?.agents,
    user?.id,
  ]);

  useOwnedAgentTradeRefresh({
    userId: user?.id,
    agentIds: teamChat?.agents.map((agent) => agent.id) ?? [],
    onTrade: refreshTeamSummary,
  });

  const agentIds = useMemo(
    () => new Set(teamChat?.agents.map((a) => a.id) ?? []),
    [teamChat?.agents]
  );

  // Open agent detail view
  const handleSelectAgent = useCallback((agentId: string) => {
    setDetailAgentId(agentId);
    setTeamView('agent-detail');
  }, []);

  // Open edit modal
  const handleViewSettings = useCallback(
    async (agentId: string) => {
      setEditingAgentId(agentId);

      const token = await getAccessToken();
      if (!token) {
        toast.error('Authentication required');
        setEditingAgentId(null);
        return;
      }

      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          toast.error('Failed to fetch agent details');
          setEditingAgentId(null);
          return;
        }

        const data = await res.json();
        setEditingAgentData(data.agent);
      } catch {
        toast.error('Failed to fetch agent details');
        setEditingAgentId(null);
      }
    },
    [getAccessToken]
  );

  // Handle query parameters
  useEffect(() => {
    if (loading || !teamChat) return;

    const agentIdToSelect = searchParams.get('selectAgent');
    const agentIdForWallet = searchParams.get('openWallet');

    if (!agentIdToSelect && !agentIdForWallet) return;

    if (agentIdToSelect) {
      const agent = teamChat.agents.find((a) => a.id === agentIdToSelect);
      if (agent) {
        tagAgentInInput(agent);
      }
    }

    if (agentIdForWallet) {
      const agent = teamChat.agents.find((a) => a.id === agentIdForWallet);
      if (agent) {
        setDetailAgentId(agent.id);
        setTeamView('agent-detail');
      }
    }

    router.replace('/agents/team', { scroll: false });
  }, [searchParams, loading, teamChat, tagAgentInInput, router]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!teamChat?.chatId || loading) return;

    const containers = document.querySelectorAll<HTMLElement>(
      '[data-chat-messages-container]'
    );
    let container: HTMLElement | null = null;
    for (const el of containers) {
      if (el.offsetHeight > 0) {
        container = el;
        break;
      }
    }
    if (!container) {
      scrollToBottom('instant');
      return;
    }

    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;
    const IDLE_MS = 500;
    const MAX_TIME = 2000;
    const startTime = Date.now();
    let isActive = true;

    const scrollToEnd = () => {
      container.scrollTop = container.scrollHeight;
    };

    const finish = () => {
      isActive = false;
      observer?.disconnect();
      if (idleTimeout) clearTimeout(idleTimeout);
    };

    scrollToEnd();

    observer = new MutationObserver(() => {
      if (!isActive) return;
      if (Date.now() - startTime > MAX_TIME) {
        scrollToEnd();
        finish();
        return;
      }
      scrollToEnd();
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        scrollToEnd();
        finish();
      }, IDLE_MS);
    });

    observer.observe(container, { childList: true, subtree: true });

    idleTimeout = setTimeout(() => {
      scrollToEnd();
      finish();
    }, IDLE_MS);

    return () => {
      observer?.disconnect();
      if (idleTimeout) clearTimeout(idleTimeout);
    };
  }, [teamChat?.chatId, loading, scrollToBottom]);

  // Auth redirect
  useEffect(() => {
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  if (ready && !authenticated) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px-var(--bottom-nav-height))] flex-col md:h-dvh">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Agent row skeleton */}
          <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
          <div className="flex flex-1 flex-col">
            <div className="p-4">
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 font-bold text-foreground text-xl">
              Failed to load Agents
            </h2>
            <p className="mb-6 text-muted-foreground">{error}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const agents = teamChat?.agents ?? [];
  const condensed = agents.length > CONDENSE_THRESHOLD;
  const hasAgents = agents.length > 0;

  // Build agents array for TeamChatView mention picker
  const chatAgents = [
    ...(user
      ? [
          {
            id: user.id,
            username: user.username || null,
            displayName: user.displayName || user.username || 'You',
            profileImageUrl: user.profileImageUrl || null,
          },
        ]
      : []),
    ...(teamChat?.agents.map((agent) => ({
      id: agent.id,
      username: agent.username,
      displayName: agent.displayName,
      profileImageUrl: agent.profileImageUrl,
    })) || []),
  ];

  // Detail agent data
  const detailAgent = detailAgentId
    ? agents.find((a) => a.id === detailAgentId)
    : null;
  const detailStats = detailAgentId
    ? agentStatsMap?.get(detailAgentId)
    : undefined;

  return (
    <div
      data-command-center-container
      className="relative mt-14 flex h-[calc(100dvh-56px-var(--bottom-nav-height))] flex-col overflow-hidden border-border md:mt-0 md:h-dvh lg:border-l"
    >
      {/* Horizontal Agent Row */}
      <div
        data-tour="agents-member-list"
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-border border-b px-3 py-2"
      >
        {agents.map((agent) => {
          const agentName = agent.displayName || agent.username || 'Agent';
          const isProcessing = processingAgentIds.has(agent.id);
          const isSelected =
            teamView === 'agent-detail' && detailAgentId === agent.id;

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => handleSelectAgent(agent.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                'hover:bg-muted',
                isSelected && 'bg-muted ring-1 ring-primary/40'
              )}
              title={agentName}
            >
              <div className="relative">
                <Avatar
                  src={agent.profileImageUrl ?? undefined}
                  name={agentName}
                  size="sm"
                />
                {isProcessing && (
                  <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-background" />
                )}
              </div>
              {!condensed && (
                <span className="max-w-[80px] truncate text-sm">
                  {agentName}
                </span>
              )}
            </button>
          );
        })}

        {/* Add agent button */}
        <button
          type="button"
          data-tour="agents-add-button"
          onClick={() => router.push('/agents/create')}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Create agent"
        >
          <Plus className="h-5 w-5" />
          {!condensed && <span className="text-sm">New</span>}
        </button>

        <div className="flex-1" />

        <TutorialHelpButton onClick={tutorial.restart} />
      </div>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* No agents empty state */}
        {!hasAgents && teamView === 'chat' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <Users className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h2 className="mb-1 font-bold text-lg">No agents yet</h2>
              <p className="text-muted-foreground">
                Create your first agent to get started!
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/agents/create')}
              className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-5 py-2.5 font-medium text-white transition-colors hover:bg-[#2952d9]"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </button>
          </div>
        ) : teamView === 'chat-list' ? (
          /* Conversation list (replaces chat) */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-3">
              <button
                type="button"
                onClick={() => setTeamView('chat')}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Back to chat"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-bold text-base">Chats</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ConversationList
                conversations={conversations}
                loading={conversationsLoading}
                onNewChat={() => {
                  createConversation();
                  setTeamView('chat');
                }}
                onSelectConversation={(id) => {
                  switchConversation(id);
                  setTeamView('chat');
                }}
                onRenameConversation={renameConversation}
                onDeleteConversation={deleteConversation}
              />
            </div>
          </div>
        ) : teamView === 'agent-detail' && detailAgent ? (
          /* Agent detail view */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-3">
              <button
                type="button"
                onClick={() => setTeamView('chat')}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Back to team"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-bold text-base">
                {detailAgent.displayName || detailAgent.username || 'Agent'}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <AgentDetailCard
                agent={detailAgent}
                stats={detailStats}
                processingAgentIds={processingAgentIds}
                onTagAgent={(agent) => {
                  tagAgentInInput(agent);
                  setTeamView('chat');
                }}
                onStopAgent={stopAgent}
                onViewSettings={handleViewSettings}
              />
            </div>
          </div>
        ) : (
          /* Chat view (default) */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Chat toolbar with Chats + New Chat */}
            <div className="flex shrink-0 items-center gap-2 border-border border-b px-4 py-2">
              <button
                type="button"
                onClick={() => setTeamView('chat-list')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
              >
                <List className="h-4 w-4" />
                Chats
              </button>
              <button
                type="button"
                onClick={() => createConversation()}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <TeamChatView
              chatDetails={tutorialChatDetails}
              currentUserId={user?.id}
              authenticated={authenticated}
              sseConnected={sseConnected}
              hideHeader={true}
              loading={false}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              messageInput={messageInput}
              sending={sending}
              sendError={sendError}
              topSentinelRef={topSentinelRef}
              messagesEndRef={messagesEndRef}
              onMessageChange={handleInputChange}
              onSendMessage={sendMessage}
              onToggleReaction={toggleReaction}
              agents={chatAgents}
              typingUsers={typingUsers}
              thinkingAgents={thinkingAgents}
              onScroll={handleScroll}
              agentIds={agentIds}
              onViewSettings={handleViewSettings}
              onInputFocus={() => {
                setTimeout(() => scrollToBottom('smooth'), 150);
              }}
              replyToMessage={replyToMessage}
              onReply={handleReplyToMessage}
              onDismissReply={clearReplyToMessage}
            />
          </div>
        )}
      </div>

      {/* Edit Agent Modal */}
      {editingAgentId && editingAgentData && (
        <AgentEditModal
          agent={editingAgentData}
          onClose={() => {
            setEditingAgentId(null);
            setEditingAgentData(null);
          }}
          onUpdate={() => {
            refreshTeamChat();
            refreshTeamSummary();
          }}
        />
      )}

      <SpotlightTutorial
        isActive={tutorial.isActive}
        currentStep={tutorial.currentStep}
        steps={tutorial.steps}
        next={tutorial.next}
        prev={tutorial.prev}
        dismiss={tutorial.dismiss}
      />
    </div>
  );
}

// -------------------------------------------------------------------
// Agent Detail Card (inline component)
// -------------------------------------------------------------------

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AgentDetailCard({
  agent,
  stats,
  processingAgentIds,
  onTagAgent,
  onStopAgent,
  onViewSettings,
}: {
  agent: TeamChatAgent;
  stats: AgentStats | undefined;
  processingAgentIds: Set<string>;
  onTagAgent: (agent: TeamChatAgent) => void;
  onStopAgent: (agentId: string) => void;
  onViewSettings: (agentId: string) => void;
}) {
  const agentName = agent.displayName || agent.username || 'Agent';
  const isProcessing = processingAgentIds.has(agent.id);
  const hasStats = stats !== undefined;

  const lastActive =
    stats?.lastTickAt && stats?.lastChatAt
      ? new Date(stats.lastTickAt) > new Date(stats.lastChatAt)
        ? stats.lastTickAt
        : stats.lastChatAt
      : stats?.lastTickAt || stats?.lastChatAt || null;

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            src={agent.profileImageUrl ?? undefined}
            name={agentName}
            size="lg"
          />
          {isProcessing && (
            <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-background" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-lg">{agentName}</h3>
          {agent.username && (
            <p className="truncate text-muted-foreground text-sm">
              @{agent.username}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {hasStats && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[10px]',
                  stats.isActive
                    ? 'bg-green-500/15 text-green-500'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    stats.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                  )}
                />
                {stats.isActive ? 'Active' : 'Idle'}
              </span>
            )}
            {agent.modelTier === 'pro' && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-medium text-[10px] text-primary">
                PRO
              </span>
            )}
            {hasStats && stats.openPositions > 0 && (
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-medium text-[10px] text-blue-500">
                {stats.openPositions} open
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-stretch rounded-lg border border-border bg-muted/30">
        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {formatCompactCurrency(agent.virtualBalance)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Wallet
          </span>
        </div>
        <div className="w-px bg-border" />
        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
          <span
            className={cn(
              'font-semibold text-sm',
              hasStats
                ? stats.lifetimePnL >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
                : 'text-foreground'
            )}
          >
            {hasStats
              ? `${stats.lifetimePnL >= 0 ? '+' : ''}${formatCompactCurrency(stats.lifetimePnL)}`
              : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            P&L
          </span>
        </div>
        <div className="w-px bg-border" />
        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {hasStats ? `${(stats.winRate * 100).toFixed(0)}%` : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Win Rate
          </span>
        </div>
        <div className="w-px bg-border" />
        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {hasStats ? stats.totalTrades : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Trades
          </span>
        </div>
      </div>

      {/* Last active */}
      <div className="text-muted-foreground text-sm">
        {hasStats && lastActive ? (
          <span>Last active {formatTimeAgo(lastActive)}</span>
        ) : hasStats ? (
          <span>No activity yet</span>
        ) : (
          <span>Loading stats...</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onTagAgent(agent)}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#2952d9]"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with Agent
        </button>

        {isProcessing && (
          <button
            type="button"
            onClick={() => onStopAgent(agent.id)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Square className="h-4 w-4" />
            Stop Processing
          </button>
        )}

        <button
          type="button"
          onClick={() => onViewSettings(agent.id)}
          className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>

        {agent.username && (
          <Link
            href={`/profile/${agent.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            View Profile
          </Link>
        )}
      </div>
    </div>
  );
}
