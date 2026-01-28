'use client';

import type { ResponseSession } from '@babylon/shared';
import { Loader2, MessageCircle } from 'lucide-react';
import React, { useMemo } from 'react';
import { Skeleton } from '@/components/shared/Skeleton';
import { AgentResponseGrid } from './AgentResponseGrid';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';
import type { ChatParticipant, Message, MessageType } from './types';
import { MessageTypeEnum } from './types';

interface AgentResponse {
  messageId: string;
  agentId: string;
  content: string;
  createdAt: string | null;
}

type ResponseSessionWithResponses = ResponseSession & {
  responses: AgentResponse[];
};

/**
 * Determines the message type for rendering.
 */
function getMessageType(message: Message): MessageType {
  if (message.type) {
    return message.type;
  }
  return MessageTypeEnum.USER;
}

interface CommandCenterMessageListProps {
  messages: Message[];
  participants: ChatParticipant[];
  currentUserId: string | undefined;
  loading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  authenticated: boolean;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  /** Response sessions keyed by user message ID */
  responseSessions: Map<string, ResponseSessionWithResponses>;
}

/**
 * Message list component for Command Center that groups agent responses.
 *
 * For user messages that have an associated response session, the agent
 * responses are displayed in a grid below the user message instead of
 * as individual message bubbles.
 */
export function CommandCenterMessageList({
  messages,
  participants,
  currentUserId,
  loading,
  isLoadingMore,
  hasMore,
  authenticated,
  topSentinelRef,
  messagesEndRef,
  responseSessions,
}: CommandCenterMessageListProps) {
  // Extract usernames for @mention formatting
  const validMentions = useMemo(() => {
    return participants
      .map((p) => p.username)
      .filter((username): username is string => !!username);
  }, [participants]);

  // Build set of message IDs that are part of a response session
  // These should be rendered as part of the grid, not as individual bubbles
  const sessionResponseMessageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of responseSessions.values()) {
      for (const response of session.responses) {
        ids.add(response.messageId);
      }
    }
    return ids;
  }, [responseSessions]);

  if (loading) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div ref={messagesEndRef} />
      </>
    );
  }

  return (
    <>
      {/* Gradient overlay to hint more messages */}
      {hasMore && (
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-8 bg-gradient-to-b from-background via-background/90 to-transparent" />
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={topSentinelRef} className="h-1 w-full" />

      {/* Loading more messages indicator */}
      {isLoadingMore && (
        <div className="sticky top-2 z-20 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1 font-medium text-muted-foreground text-xs shadow-sm backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading previous messages…</span>
          </div>
        </div>
      )}

      {/* Messages with grouped responses */}
      {messages.map((msg) => {
        const messageType = getMessageType(msg);
        const key = msg.stableKey || msg.id;

        // Skip messages that are agent responses in a session
        // (they're rendered in the grid below their user message)
        // Check both: 1) message has responseSessionId, 2) message ID is in session responses
        if (msg.responseSessionId || sessionResponseMessageIds.has(msg.id)) {
          return null;
        }

        switch (messageType) {
          case MessageTypeEnum.SYSTEM:
            return <SystemMessage key={key} message={msg} />;

          case MessageTypeEnum.USER:
          default: {
            const sender = participants.find((p) => p.id === msg.senderId);
            const isCurrentUser = currentUserId
              ? msg.senderId === currentUserId
              : false;

            // Check if this user message has an associated response session
            const session = responseSessions.get(msg.id);

            return (
              <React.Fragment key={key}>
                {/* User message bubble */}
                <MessageBubble
                  message={msg}
                  sender={sender}
                  isCurrentUser={isCurrentUser}
                  validMentions={validMentions}
                />

                {/* Agent response grid (if this message has a session) */}
                {session && (
                  <div className="mt-2 mb-4 px-4">
                    <AgentResponseGrid
                      session={session}
                      participants={participants}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          }
        }
      })}

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md p-8 text-center text-muted-foreground">
            <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="mb-2 text-foreground">No messages yet</p>
            {authenticated && (
              <p className="text-muted-foreground text-xs">
                Send a message to start chatting with your agents!
              </p>
            )}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </>
  );
}
