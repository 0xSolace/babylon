import { getAllVerifiedEmails } from '@babylon/shared';
import type { User as PrivyUser } from '@privy-io/server-auth';

export type PrivyIdentitySnapshot = {
  email: string | null;
  farcasterUsername: string | null;
  farcasterFid: string | null;
  twitterUsername: string | null;
  twitterId: string | null;
};

export type UserIdentitySyncState = {
  hasFarcaster: boolean;
  hasTwitter: boolean;
  email: string | null;
  emailVerified: boolean;
};

type PrivyIdentityUserLike = Pick<
  PrivyUser,
  'email' | 'farcaster' | 'twitter' | 'linkedAccounts'
>;

export function extractPrivyIdentitySnapshot(
  privyUser: PrivyIdentityUserLike
): PrivyIdentitySnapshot {
  return {
    email: getAllVerifiedEmails(privyUser)[0] ?? null,
    farcasterUsername: privyUser.farcaster?.username ?? null,
    farcasterFid: privyUser.farcaster?.fid
      ? String(privyUser.farcaster.fid)
      : null,
    twitterUsername: privyUser.twitter?.username ?? null,
    twitterId: privyUser.twitter?.subject ?? null,
  };
}

export function shouldSyncMissingPrivyIdentity(
  user: UserIdentitySyncState
): boolean {
  return (
    !user.hasFarcaster || !user.hasTwitter || !user.email || !user.emailVerified
  );
}
