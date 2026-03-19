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
 * Delegates to the shared Privy link-account helper so the email flow stays
 * aligned with other social-linking flows. This treats the known cancellation
 * shapes observed from Privy as user intent, including raw string codes/messages
 * and Privy-like error objects.
 */
export const isLinkEmailFlowCancellationError =
  isPrivyLinkFlowCancellationError;
