import { describe, expect, it } from 'bun:test';
import { sanitizeOnboardingUsername } from '@babylon/shared/utils/username';

describe('sanitizeOnboardingUsername', () => {
  it('keeps an already valid onboarding username', () => {
    expect(sanitizeOnboardingUsername('alice_trader')).toBe('alice_trader');
  });

  it('strips a leading @ and lowercases the username', () => {
    expect(sanitizeOnboardingUsername('@Alice_Trader')).toBe('alice_trader');
  });

  it('replaces unsupported characters with underscores', () => {
    expect(sanitizeOnboardingUsername('alice.eth wow')).toBe('alice_eth_wow');
  });

  it('truncates to the onboarding max length', () => {
    expect(sanitizeOnboardingUsername('ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(
      'abcdefghijklmnopqrst'
    );
  });
});
