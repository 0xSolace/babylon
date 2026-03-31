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

/**
 * Tracks whether the profile has been fetched from the server this session.
 * - 'idle': haven't attempted yet (default on page load)
 * - 'loading': fetch in progress
 * - 'done': server responded successfully
 * - 'error': server unreachable or returned an error
 */
type ProfileFetchStatus = 'idle' | 'loading' | 'done' | 'error';

interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  loadedUserId: string | null;
  isLoadingProfile: boolean;
  needsOnboarding: boolean;
  /** Whether the server has been consulted this session */
  profileFetchStatus: ProfileFetchStatus;
  setUser: (user: User) => void;
  setWallet: (wallet: Wallet) => void;
  setLoadedUserId: (userId: string) => void;
  setIsLoadingProfile: (loading: boolean) => void;
  setNeedsOnboarding: (needsOnboarding: boolean) => void;
  setProfileFetchStatus: (status: ProfileFetchStatus) => void;
  clearAuth: () => void;
}

type PersistedAuthState = Pick<AuthState, 'user' | 'wallet' | 'loadedUserId'>;

const CURRENT_AUTH_STORE_VERSION = 4;

function createInitialPersistedState(): PersistedAuthState {
  return {
    user: null,
    wallet: null,
    loadedUserId: null,
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
  const initialState = createInitialPersistedState();

  if (!isRecord(persistedState)) {
    return initialState;
  }

  // Migrate payloads written by known legacy schemas. Unknown future versions
  // should fall back to the initial state instead.
  if (version !== 0 && version !== 1 && version !== 2 && version !== 3) {
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
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...createInitialPersistedState(),
      isLoadingProfile: false,
      needsOnboarding: false,
      profileFetchStatus: 'idle' as ProfileFetchStatus,
      setUser: (user) => set({ user }),
      setWallet: (wallet) => set({ wallet }),
      setLoadedUserId: (userId) => set({ loadedUserId: userId }),
      setIsLoadingProfile: (loading) => set({ isLoadingProfile: loading }),
      setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
      setProfileFetchStatus: (profileFetchStatus) =>
        set({ profileFetchStatus }),
      clearAuth: () =>
        set({
          ...createInitialPersistedState(),
          isLoadingProfile: false,
          needsOnboarding: false,
          profileFetchStatus: 'idle' as ProfileFetchStatus,
        }),
    }),
    {
      name: 'babylon-auth',
      storage: createSafeJsonStorage<PersistedAuthState>('localStorage'),
      // Bumping this triggers migrateAuthStoreState. Update the accepted
      // legacy versions above when the persisted schema changes again.
      version: CURRENT_AUTH_STORE_VERSION,
      migrate: migrateAuthStoreState,
      // Only persist user, wallet, loadedUserId — everything else is ephemeral
      partialize: (state) => ({
        user: state.user,
        wallet: state.wallet,
        loadedUserId: state.loadedUserId,
      }),
    }
  )
);
