'use client';

import type { ResponseSession } from '@babylon/shared';
import { cn } from '@babylon/shared';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Response } from '@/components/chat/Response';
import { Avatar } from '@/components/shared/Avatar';
import type { AgentResponseStatus } from './AgentResponseCard';
import type { ChatParticipant } from './types';

interface AgentResponse {
  messageId: string;
  agentId: string;
  content: string;
  createdAt: string | null;
}

interface AgentResponseGridProps {
  /** The response session data */
  session: ResponseSession & {
    responses: AgentResponse[];
    failedAgentIds?: string[];
  };
  /** Chat participants for agent info lookup */
  participants: ChatParticipant[];
  /** Additional className */
  className?: string;
}

/**
 * Grid container for displaying grouped agent responses.
 * Shows overall status, agent avatars, and individual response cards.
 * Supports "expanded" mode where a single card expands to show full content.
 */
export function AgentResponseGrid({
  session,
  participants,
  className,
}: AgentResponseGridProps) {
  // Expanded agent ID (null = grid view, string = expanded single card)
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  // Build a map of agent responses for quick lookup
  const responsesByAgentId = useMemo(() => {
    const map = new Map<string, AgentResponse>();
    for (const response of session.responses) {
      map.set(response.agentId, response);
    }
    return map;
  }, [session.responses]);

  // Get participant info for each expected agent
  const agentsWithStatus = useMemo(() => {
    const failedSet = new Set(session.failedAgentIds || []);

    return session.expectedAgentIds.map((agentId) => {
      const participant = participants.find((p) => p.id === agentId);
      const response = responsesByAgentId.get(agentId);

      let status: AgentResponseStatus = 'waiting';
      if (response) {
        status = 'complete';
      } else if (failedSet.has(agentId)) {
        status = 'error';
      } else if (session.status === 'processing') {
        // If session is processing and this agent hasn't responded,
        // they might be processing or waiting
        status = 'processing';
      }

      return {
        id: agentId,
        displayName: participant?.displayName || 'Agent',
        username: participant?.username,
        profileImageUrl: participant?.profileImageUrl,
        status,
        content: response?.content,
      };
    });
  }, [session, participants, responsesByAgentId]);

  // Calculate overall progress (responses + failures = handled)
  const handledCount =
    session.responses.length + (session.failedAgentIds?.length || 0);
  const totalCount = session.expectedAgentIds.length;
  const isComplete = session.status === 'complete';

  // Status icon helper
  const getStatusIcon = (status: AgentResponseStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-muted/30 p-4',
        className
      )}
    >
      {/* Header: Status badge */}
      <div className="mb-4 flex items-center justify-between">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs',
            isComplete
              ? 'bg-green-500/10 text-green-500'
              : 'bg-primary/10 text-primary'
          )}
        >
          {isComplete ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          <span>
            {isComplete
              ? 'Complete'
              : `Processing (${handledCount}/${totalCount})`}
          </span>
        </div>

        {/* Back button when expanded */}
        {expandedAgentId && (
          <button
            type="button"
            onClick={() => setExpandedAgentId(null)}
            className="fade-in slide-in-from-right-2 flex animate-in items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors duration-200 hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Show all
          </button>
        )}
      </div>

      {/* Grid / Expanded view */}
      <div
        className={cn(
          'grid gap-3',
          // When expanded, single column full width
          expandedAgentId && 'grid-cols-1',
          // Grid view: responsive columns
          !expandedAgentId && totalCount === 1 && 'grid-cols-1',
          !expandedAgentId && totalCount === 2 && 'grid-cols-1 sm:grid-cols-2',
          !expandedAgentId && totalCount >= 3 && 'grid-cols-1 sm:grid-cols-2'
        )}
      >
        {agentsWithStatus.map((agent) => {
          const isExpanded = expandedAgentId === agent.id;
          const isHidden = expandedAgentId && !isExpanded;

          return (
            <div
              key={agent.id}
              className={cn(
                'flex flex-col rounded-lg border border-border bg-card p-4',
                'transition-[transform,opacity,height,padding,margin,border-width] duration-300 ease-in-out',
                'origin-top',
                isExpanded && 'col-span-full',
                // Hidden cards: collapse and fade out
                isHidden &&
                  'm-0 h-0 scale-y-0 overflow-hidden border-0 p-0 opacity-0',
                // Visible cards
                !isHidden && 'scale-y-100 opacity-100'
              )}
            >
              {/* Header: Avatar + Name + Status */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar
                    id={agent.id}
                    name={agent.displayName}
                    type="actor"
                    size="sm"
                    imageUrl={agent.profileImageUrl}
                    className="h-6 w-6 text-[10px]"
                  />
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-foreground text-sm">
                      {agent.displayName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(agent.status)}
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1">
                {agent.status === 'waiting' && (
                  <p className="text-muted-foreground text-sm italic">
                    Waiting for response...
                  </p>
                )}
                {agent.status === 'processing' && (
                  <div className="flex animate-pulse items-center gap-2 text-muted-foreground text-sm">
                    <span>Processing...</span>
                  </div>
                )}
                {agent.status === 'complete' && agent.content && (
                  <div className="transition-all duration-300 ease-in-out">
                    {isExpanded ? (
                      // Expanded: full content with formatting
                      <div className="fade-in animate-in text-foreground text-sm duration-300">
                        <Response>{agent.content}</Response>
                      </div>
                    ) : (
                      // Collapsed: truncated preview
                      <p className="line-clamp-6 whitespace-pre-wrap text-foreground text-sm">
                        {agent.content}
                      </p>
                    )}
                  </div>
                )}
                {agent.status === 'error' && (
                  <p className="text-destructive text-sm italic">
                    Failed to respond
                  </p>
                )}
              </div>

              {/* Footer: Read more / Show less */}
              {agent.status === 'complete' && agent.content && (
                <div className="mt-3 border-border border-t pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAgentId(isExpanded ? null : agent.id)
                    }
                    className="font-medium text-primary text-xs hover:underline"
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
