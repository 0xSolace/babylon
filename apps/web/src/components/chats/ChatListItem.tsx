'use client';

import { cn } from '@babylon/shared';
import { Crown, Star, Users } from 'lucide-react';
import React from 'react';
import { Avatar } from '@/components/shared/Avatar';
import type { Chat } from './types';

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: (chatId: string) => void;
}

/**
 * Get tier badge styling and icon
 */
function getTierBadge(tier: number | null | undefined) {
  if (!tier) return null;

  const config: Record<
    number,
    { label: string; className: string; Icon: typeof Crown }
  > = {
    1: {
      label: 'Inner Circle',
      className: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
      Icon: Crown,
    },
    2: {
      label: 'Community',
      className: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      Icon: Star,
    },
    3: {
      label: 'Followers',
      className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
      Icon: Users,
    },
  };

  return config[tier];
}

export function ChatListItem({
  chat,
  isSelected,
  onSelect,
}: ChatListItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(chat.id);
    }
  };

  const tierBadge = getTierBadge(chat.tier);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(chat.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        'cursor-pointer px-4 py-3 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
        isSelected
          ? 'border-primary border-l-4 bg-sidebar-accent/50'
          : 'border-transparent border-l-4 hover:bg-sidebar-accent/30'
      )}
    >
      <div className="flex items-center gap-3">
        {chat.isGroup ? (
          <div className="relative">
            <div
              className={cn(
                'chat-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tierBadge ? 'bg-sidebar-accent/50' : 'bg-sidebar-accent/50'
              )}
            >
              {tierBadge ? (
                <tierBadge.Icon
                  className={cn('h-5 w-5', tierBadge.className.split(' ')[1])}
                />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
            </div>
            {tierBadge && (
              <div
                className={cn(
                  'absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border font-bold text-[10px]',
                  tierBadge.className
                )}
              >
                {chat.tier}
              </div>
            )}
          </div>
        ) : (
          <Avatar
            id={chat.otherUser?.id || ''}
            name={
              chat.otherUser?.displayName || chat.otherUser?.username || 'User'
            }
            type="user"
            size="md"
            imageUrl={chat.otherUser?.profileImageUrl || undefined}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground text-sm">
              {chat.name}
            </span>
            {tierBadge && (
              <span
                className={cn(
                  'shrink-0 rounded border px-1.5 py-0.5 font-medium text-[10px]',
                  tierBadge.className
                )}
              >
                {tierBadge.label}
              </span>
            )}
          </div>
          <div className="truncate text-muted-foreground text-xs">
            {chat.lastMessage?.content || 'No messages yet'}
          </div>
        </div>
      </div>
    </div>
  );
}
