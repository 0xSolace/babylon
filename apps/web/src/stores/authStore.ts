/**
 * Authentication Store
 *
 * Manages user authentication state, wallet connection, and onboarding status.
 * Persists authentication data to localStorage for session persistence.
 */

import { isRecord } from '@babylon/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeJsonStorage } from '@/utils/browser-storage';

/**
 * User profile data structure.
 * Contains user information, authentication status, and preferences.
 */
export interface User {
  id: string;
  walletAddress?: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  emailNotificationsEnabled?: boolean;
  emailNotificationsRealtime?: boolean;
  emailNotificationsDailySummary?: boolean;
  emailNotificationsWeeklySummary?: boolean;
  emailNotificationsMonthlySummary?: boolean;
  username?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  profileComplete?: boolean;
  nftTokenId?: number | null;
  agent0TokenId?: number | null;
  createdAt?: string;
  isActor?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  bannedAt?: string | null;
  bannedReason?: string | null;
  reputationPoints?: number;
  totalPoints?: number;
  virtualBalance?: number;
  referralCount?: number;
  referralCode?: string;
  onChainRegistered?: boolean;
  hasFarcaster?: boolean;
  hasTwitter?: boolean;
  hasDiscord?: boolean;
  hasTelegram?: boolean;
  pointsAwardedForEmail?: boolean;
  pointsAwardedForFarcasterFollow?: boolean;
  pointsAwardedForTwitterFollow?: boolean;
  pointsAwardedForDiscordJoin?: boolean;
  farcasterUsername?: string;
  twitterUsername?: string;
  discordUsername?: string;
  telegramUsername?: string;
  showTwitterPublic?: boolean;
  showFarcasterPublic?: boolean;
  showWalletPublic?: boolean;
  bannerLastShown?: string;
  bannerDismissCount?: number;
  usernameChangedAt?: string | null;
  // Legal and compliance
  tosAccepted?: boolean;
  tosAcceptedAt?: string | null;
  tosAcceptedVersion?: string | null;
  privacyPolicyAccepted?: boolean;
  privacyPolicyAcceptedAt?: string | null;
  privacyPolicyAcceptedVersion?: string | null;
  stats?: {
    positions?: number;
    comments?: number;
    reactions?: number;
    followers?: number;
    following?: number;
  };
  // Game guide completion
  gameGuideCompletedAt?: string | null;
}

interface Wallet {
  address: string;
  chainId: string;
}

interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  loadedUserId: string | null;
  isLoadingProfile: boolean;
  needsOnboarding: boolean;
  setUser: (user: User) => void;
  setWallet: (wallet: Wallet) => void;
  setLoadedUserId: (userId: string) => void;
  setIsLoadingProfile: (loading: boolean) => void;
  setNeedsOnboarding: (needsOnboarding: boolean) => void;
  clearAuth: () => void;
}

type PersistedAuthState = Pick<
  AuthState,
  'user' | 'wallet' | 'loadedUserId' | 'isLoadingProfile' | 'needsOnboarding'
>;

const CURRENT_AUTH_STORE_VERSION = 3;

function createInitialAuthState(): PersistedAuthState {
  return {
    user: null,
    wallet: null,
    loadedUserId: null,
    isLoadingProfile: false,
    needsOnboarding: false,
  };
}

function isPersistedUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string'
  );
}

function isPersistedWallet(value: unknown): value is Wallet {
  return (
    isRecord(value) &&
    typeof value.address === 'string' &&
    typeof value.chainId === 'string'
  );
}

export function migrateAuthStoreState(
  persistedState: unknown,
  version: number
): PersistedAuthState {
  const initialState = createInitialAuthState();

  if (!isRecord(persistedState)) {
    return initialState;
  }

  // Migrate payloads written by known legacy schemas. Unknown future versions
  // should fall back to the initial state instead.
  if (version !== 0 && version !== 1 && version !== 2) {
    return initialState;
  }

  return {
    user: isPersistedUser(persistedState.user) ? persistedState.user : null,
    wallet: isPersistedWallet(persistedState.wallet)
      ? persistedState.wallet
      : null,
    loadedUserId:
      typeof persistedState.loadedUserId === 'string'
        ? persistedState.loadedUserId
        : null,
    // Loading state is ephemeral and should not survive a page refresh.
    isLoadingProfile: false,
    needsOnboarding: persistedState.needsOnboarding === true,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...createInitialAuthState(),
      setUser: (user) => set({ user }),
      setWallet: (wallet) => set({ wallet }),
      setLoadedUserId: (userId) => set({ loadedUserId: userId }),
      setIsLoadingProfile: (loading) => set({ isLoadingProfile: loading }),
      setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
      clearAuth: () => set(createInitialAuthState()),
    }),
    {
      name: 'babylon-auth',
      storage: createSafeJsonStorage<PersistedAuthState>('localStorage'),
      // Bumping this triggers migrateAuthStoreState. Update the accepted
      // legacy versions above when the persisted schema changes again.
      version: CURRENT_AUTH_STORE_VERSION,
      migrate: migrateAuthStoreState,
    }
  )
);
