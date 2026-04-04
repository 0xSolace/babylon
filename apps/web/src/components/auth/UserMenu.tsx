'use client';

import { getDisplayReferralUrl, getReferralUrl } from '@babylon/shared';
import {
  BookOpen,
  Check,
  Copy,
  Key,
  LogOut,
  MoreHorizontal,
  Settings,
  Trophy,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useGameGuide } from '@/components/providers/GameGuideProvider';
import { Avatar } from '@/components/shared/Avatar';
import { Dropdown, DropdownItem } from '@/components/shared/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

/**
 * User menu component displaying user profile and account actions.
 *
 * Shows user avatar, name, username, points balance, referral code, and logout
 * option in a dropdown menu. Automatically fetches and refreshes user data every
 * 30 seconds. Prevents duplicate API calls across multiple instances.
 *
 * Features:
 * - User profile display with avatar
 * - Points balance (total reputation and available trading balance)
 * - Referral code copy functionality
 * - Logout action
 *
 * @returns User menu dropdown element or null if no user
 */
export function UserMenu() {
  const { logout } = useAuth();
  const { user } = useAuthStore();
  const { openGuide } = useGameGuide();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyReferralCode = async () => {
    if (!user?.referralCode) return;
    const referralUrl = getReferralUrl(user.referralCode);
    await navigator.clipboard.writeText(referralUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!user) {
    return null;
  }

  const displayName =
    user.displayName || user.email?.split('@')[0] || 'Anonymous';
  const username = user.username || `user${user.id.slice(0, 8)}`;

  const trigger = (
    <div
      data-testid="user-menu"
      className="group flex w-full cursor-pointer items-center gap-3 py-3 pl-2 transition-colors duration-200 hover:bg-sidebar-accent"
    >
      <Avatar
        id={user.id}
        name={displayName}
        type="user"
        size="sm"
        src={user.profileImageUrl || undefined}
        imageUrl={user.profileImageUrl || undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg text-sidebar-foreground leading-5 group-hover:text-black dark:group-hover:text-white">
          {displayName}
        </p>
        <p className="truncate text-muted-foreground text-xs leading-4">
          @{username}
        </p>
      </div>
      <MoreHorizontal className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );

  return (
    <Dropdown
      trigger={trigger}
      placement="top-left"
      width="sidebar"
      popoverClassName="border-r-0 rounded-r-none"
    >
      {user?.referralCode && (
        <DropdownItem onClick={handleCopyReferralCode}>
          <div className="flex items-center gap-3">
            {copiedCode ? (
              <Check className="h-6 w-6 text-green-500" />
            ) : (
              <Copy className="h-6 w-6 text-sidebar-foreground" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={
                  copiedCode ? 'text-green-500' : 'text-sidebar-foreground'
                }
              >
                {copiedCode ? 'Link Copied!' : 'Copy Referral Link'}
              </span>
              <span className="truncate font-mono text-muted-foreground text-xs">
                {getDisplayReferralUrl(user.referralCode)}
              </span>
            </div>
          </div>
        </DropdownItem>
      )}

      <DropdownItem onClick={() => router.push('/settings')}>
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-sidebar-foreground" />
          <span className="text-sidebar-foreground">Settings</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={() => router.push('/achievements')}>
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-sidebar-foreground" />
          <span className="text-sidebar-foreground">Achievements</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={openGuide}>
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-sidebar-foreground" />
          <span className="text-sidebar-foreground">Game Guide</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={() => router.push('/settings?tab=api')}>
        <div className="flex items-center gap-3">
          <Key className="h-6 w-6 text-sidebar-foreground" />
          <span className="text-sidebar-foreground">API Keys</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={logout}>
        <div className="flex items-center gap-3 text-destructive">
          <LogOut className="h-6 w-6" />
          <span>Logout</span>
        </div>
      </DropdownItem>
    </Dropdown>
  );
}
