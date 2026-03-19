import { afterEach, describe, expect, it } from 'bun:test';

import {
  getLegacyCanonicalOrigin,
  getLegacyCanonicalTargetForPath,
  getWaitlistHostnames,
  isLegacyCanonicalHostname,
  isWaitlistHostname,
} from '../../../apps/web/src/lib/host-routing';

const originalWaitlistHostnames = process.env.WAITLIST_HOSTNAMES;

afterEach(() => {
  if (originalWaitlistHostnames === undefined) {
    delete process.env.WAITLIST_HOSTNAMES;
  } else {
    process.env.WAITLIST_HOSTNAMES = originalWaitlistHostnames;
  }
});

describe('host-routing (waitlist hostnames)', () => {
  it('includes sensible defaults when env var is missing', () => {
    delete process.env.WAITLIST_HOSTNAMES;
    const hosts = getWaitlistHostnames();

    expect(hosts.has('babylon.market')).toBe(true);
    expect(hosts.has('www.babylon.market')).toBe(true);
    expect(hosts.has('staging.babylon.market')).toBe(true);
    expect(hosts.has('www.staging.babylon.market')).toBe(true);
  });

  it('parses WAITLIST_HOSTNAMES as a case-insensitive CSV', () => {
    process.env.WAITLIST_HOSTNAMES =
      'Babylon.Market, WWW.BABYLON.MARKET , staging.babylon.market';

    expect(isWaitlistHostname('babylon.market')).toBe(true);
    expect(isWaitlistHostname('www.babylon.market')).toBe(true);
    expect(isWaitlistHostname('staging.babylon.market')).toBe(true);
    expect(isWaitlistHostname('play.staging.babylon.market')).toBe(false);
  });

  it('identifies legacy babylon.social hosts', () => {
    expect(isLegacyCanonicalHostname('babylon.social')).toBe(true);
    expect(isLegacyCanonicalHostname('www.babylon.social')).toBe(true);
    expect(isLegacyCanonicalHostname('play.babylon.market')).toBe(false);
  });

  it('maps legacy babylon.social hosts to canonical market origins', () => {
    expect(
      getLegacyCanonicalOrigin('babylon.social', 'https:', 'waitlist')
    ).toBe('https://babylon.market');
    expect(getLegacyCanonicalOrigin('babylon.social', 'https:', 'app')).toBe(
      'https://play.babylon.market'
    );
    expect(
      getLegacyCanonicalOrigin('www.babylon.social', 'https:', 'waitlist')
    ).toBe('https://babylon.market');
    expect(
      getLegacyCanonicalOrigin('play.babylon.market', 'https:', 'app')
    ).toBeNull();
  });

  it('routes legacy public paths to the waitlist host and app paths to play', () => {
    expect(getLegacyCanonicalTargetForPath('/')).toBe('waitlist');
    expect(getLegacyCanonicalTargetForPath('/.well-known')).toBe('waitlist');
    expect(getLegacyCanonicalTargetForPath('/share/referral/user-1')).toBe(
      'waitlist'
    );
    expect(getLegacyCanonicalTargetForPath('/favicon.ico')).toBe('waitlist');
    expect(getLegacyCanonicalTargetForPath('/assets/logo.svg')).toBe(
      'waitlist'
    );
    expect(getLegacyCanonicalTargetForPath('/api/feed/narrative')).toBe('app');
    expect(getLegacyCanonicalTargetForPath('/markets')).toBe('app');
  });
});
