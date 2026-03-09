import { describe, expect, it } from 'bun:test';
import {
  formatWhitelistRankThreshold,
  getPrimaryAccessLabel,
  getWaitlistHeaderCopy,
  type NftAccessState,
  shouldAutoRedirectWhitelistedUser,
} from './comingSoonAccess';

describe('comingSoonAccess', () => {
  describe('shouldAutoRedirectWhitelistedUser', () => {
    it('returns true for authenticated whitelist users with access', () => {
      const nftAccess: NftAccessState = {
        hasAccess: true,
        reason: 'whitelist',
      };

      expect(shouldAutoRedirectWhitelistedUser(true, 'user-1', nftAccess)).toBe(
        true
      );
    });

    it('returns false for non-whitelist access reasons', () => {
      const snapshotAccess: NftAccessState = {
        hasAccess: true,
        reason: 'snapshot_2025',
      };

      expect(
        shouldAutoRedirectWhitelistedUser(true, 'user-1', snapshotAccess)
      ).toBe(false);
    });

    it('returns false when user is not authenticated or has no user id', () => {
      const whitelistAccess: NftAccessState = {
        hasAccess: true,
        reason: 'whitelist',
      };

      expect(
        shouldAutoRedirectWhitelistedUser(false, 'user-1', whitelistAccess)
      ).toBe(false);
      expect(
        shouldAutoRedirectWhitelistedUser(true, undefined, whitelistAccess)
      ).toBe(false);
    });
  });

  describe('getPrimaryAccessLabel', () => {
    it('returns claim label when NFT can be claimed', () => {
      expect(getPrimaryAccessLabel(true)).toBe('Claim your NFT');
    });

    it('returns play label when NFT cannot be claimed', () => {
      expect(getPrimaryAccessLabel(false)).toBe('Play');
    });
  });

  describe('formatWhitelistRankThreshold', () => {
    it('formats the whitelist threshold for the waitlist header', () => {
      expect(formatWhitelistRankThreshold(25000)).toBe('Top 25,000');
    });

    it('returns an empty string for missing thresholds', () => {
      expect(formatWhitelistRankThreshold(null)).toBe('');
      expect(formatWhitelistRankThreshold(undefined)).toBe('');
    });
  });

  describe('getWaitlistHeaderCopy', () => {
    it('returns access copy for whitelisted users', () => {
      expect(getWaitlistHeaderCopy(true, 25000)).toEqual({
        title: 'Click play to access the game',
        subtitle: 'Welcome to Babylon',
      });
    });

    it('returns leaderboard copy with the configured whitelist threshold', () => {
      expect(getWaitlistHeaderCopy(false, 25000)).toEqual({
        title: 'Leaderboard',
        subtitle: 'Top 25,000',
      });
    });
  });
});
