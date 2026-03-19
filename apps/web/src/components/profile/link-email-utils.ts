import { isPrivyLinkFlowCancellationError } from '@/lib/privy-link-account-errors';

export function getLinkedEmail(
  privyEmail?: string | null,
  storedEmail?: string | null
): string | null {
  const normalizedPrivy = privyEmail?.trim() || '';
  if (normalizedPrivy) return normalizedPrivy;

  const normalizedStored = storedEmail?.trim() || '';
  return normalizedStored || null;
}

/**
 * Returns true when the Privy link-email flow was cancelled by the user.
 *
 * Handles two shapes:
 * - The string error code `'exited_auth_flow'` passed to `useLinkAccount` onError callbacks.
 * - A PrivyClientError (or similar) thrown synchronously with `code === 'exited_auth_flow'`.
 */
export const isLinkEmailFlowCancellationError =
  isPrivyLinkFlowCancellationError;
