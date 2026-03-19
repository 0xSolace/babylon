import { describe, expect, it } from 'bun:test';
import {
  isPrivyLinkFlowCancellationError,
  isPrivyTwitterLinkConflictError,
  X_ACCOUNT_ALREADY_LINKED_MESSAGE,
} from './privy-link-account-errors';

describe('privy-link-account-errors', () => {
  describe('isPrivyLinkFlowCancellationError', () => {
    it('detects the exited_auth_flow string code from useLinkAccount onError', () => {
      expect(isPrivyLinkFlowCancellationError('exited_auth_flow')).toBe(true);
    });

    it('treats the Authentication cancelled message as a user cancellation', () => {
      expect(isPrivyLinkFlowCancellationError('Authentication cancelled')).toBe(
        true
      );
      expect(
        isPrivyLinkFlowCancellationError(new Error('Authentication cancelled'))
      ).toBe(true);
    });

    it('detects the exited_link_flow string code from useLinkAccount onError', () => {
      expect(isPrivyLinkFlowCancellationError('exited_link_flow')).toBe(true);
    });

    it('detects a PrivyClientError-shaped object with code exited_auth_flow', () => {
      expect(
        isPrivyLinkFlowCancellationError({
          code: 'exited_auth_flow',
          message: 'User exited link email flow',
        })
      ).toBe(true);
    });

    it('detects a PrivyClientError-shaped object with code exited_link_flow', () => {
      expect(
        isPrivyLinkFlowCancellationError({
          code: 'exited_link_flow',
          message: 'User exited link account flow',
        })
      ).toBe(true);
    });

    it('returns false for other values', () => {
      expect(isPrivyLinkFlowCancellationError('exited')).toBe(false);
      expect(isPrivyLinkFlowCancellationError(null)).toBe(false);
      expect(
        isPrivyLinkFlowCancellationError({
          code: 'network_error',
          message: 'Network failure',
        })
      ).toBe(false);
    });
  });

  describe('isPrivyTwitterLinkConflictError', () => {
    it('detects the Privy twitter conflict error message', () => {
      expect(
        isPrivyTwitterLinkConflictError(
          new Error('User already has an account of type twitter linked.')
        )
      ).toBe(true);
    });

    it('handles the message when passed as a string', () => {
      expect(
        isPrivyTwitterLinkConflictError(
          'User already has an account of type twitter linked.'
        )
      ).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(
        isPrivyTwitterLinkConflictError(
          new Error('Failed to link account. Please try again.')
        )
      ).toBe(false);
      expect(isPrivyTwitterLinkConflictError(null)).toBe(false);
    });
  });

  it('exports the handled X conflict toast message', () => {
    expect(X_ACCOUNT_ALREADY_LINKED_MESSAGE).toBe(
      'This X account is already linked to another user'
    );
  });
});
