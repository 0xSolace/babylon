import type { NftAccessResponse } from '@/types/nft';

export type NftAccessState = {
  hasAccess: boolean;
  reason: NftAccessResponse['data']['reason'];
} | null;

export function shouldAutoRedirectWhitelistedUser(
  authenticated: boolean,
  userId: string | undefined,
  nftAccess: NftAccessState
): boolean {
  return Boolean(
    authenticated &&
      userId &&
      nftAccess?.hasAccess &&
      nftAccess.reason === 'whitelist'
  );
}

export function getPrimaryAccessLabel(canClaimNft: boolean): string {
  return canClaimNft ? 'Claim your NFT' : 'Play';
}

export function formatWhitelistRankThreshold(
  threshold: number | null | undefined
): string {
  if (!threshold || threshold < 1) return '';
  return `Top ${threshold.toLocaleString('en-US')}`;
}

export function getWaitlistHeaderCopy(
  hasPrimaryAccess: boolean,
  whitelistRankThreshold: number | null | undefined
): {
  title: string;
  subtitle: string;
} {
  if (hasPrimaryAccess) {
    return {
      title: 'Click play to access the game',
      subtitle: 'Welcome to Babylon',
    };
  }

  return {
    title: 'Leaderboard',
    subtitle: formatWhitelistRankThreshold(whitelistRankThreshold),
  };
}
