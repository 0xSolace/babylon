'use client';

import { cn } from '@babylon/shared';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';

export type AgentResponseStatus =
  | 'waiting'
  | 'processing'
  | 'complete'
  | 'error';

interface AgentResponseCardProps {
  /** Agent information */
  agent: {
    id: string;
    displayName: string;
    username?: string;
    profileImageUrl?: string;
  };
  /** Current status of this agent's response */
  status: AgentResponseStatus;
  /** Response content (if complete) */
  content?: string;
  /** Additional className */
  className?: string;
  /** Callback when "Read more" is clicked */
  onReadMore?: () => void;
}

/**
 * Individual agent response card for the grid display.
 * Shows agent info, status, and truncated response content with "Read more".
 */
export function AgentResponseCard({
  agent,
  status,
  content,
  className,
  onReadMore,
}: AgentResponseCardProps) {
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  // Check if content is truncated (needs "Read more")
  useEffect(() => {
    if (contentRef.current && content) {
      const element = contentRef.current;
      // Check if content overflows (is clamped)
      setIsTruncated(element.scrollHeight > element.clientHeight);
    }
  }, [content]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card p-4 transition-all',
        status === 'processing' && 'animate-pulse',
        className
      )}
    >
      {/* Header: Agent info + status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar
            src={agent.profileImageUrl}
            name={agent.displayName}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground text-sm">
              {agent.displayName}
            </p>
            {agent.username && (
              <p className="truncate text-muted-foreground text-xs">
                @{agent.username}
              </p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <StatusBadge status={status} />
      </div>

      {/* Content area */}
      <div className="min-h-[60px] flex-1">
        {status === 'waiting' && (
          <p className="text-muted-foreground text-sm italic">
            Waiting for response...
          </p>
        )}
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        {status === 'complete' && content && (
          <div>
            <p
              ref={contentRef}
              className="line-clamp-6 whitespace-pre-wrap text-foreground text-sm"
            >
              {content}
            </p>
            {/* Show Read more button if content is truncated */}
            {isTruncated && onReadMore && (
              <button
                type="button"
                onClick={onReadMore}
                className="mt-2 flex items-center gap-1 font-medium text-primary text-xs hover:underline"
              >
                Read more
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {status === 'error' && (
          <p className="text-destructive text-sm italic">Failed to respond</p>
        )}
      </div>
    </div>
  );
}

/** Status badge component */
function StatusBadge({ status }: { status: AgentResponseStatus }) {
  switch (status) {
    case 'waiting':
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          <span>Waiting</span>
        </div>
      );
    case 'processing':
      return (
        <div className="flex items-center gap-1 text-primary text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing</span>
        </div>
      );
    case 'complete':
      return (
        <div className="flex items-center gap-1 text-green-500 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          <span>Complete</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-1 text-destructive text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>Error</span>
        </div>
      );
  }
}
