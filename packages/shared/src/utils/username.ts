/**
 * Normalize a proposed Babylon onboarding username to the existing
 * onboarding/check-username format.
 */
export function sanitizeOnboardingUsername(username: string): string {
  return username
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .slice(0, 20);
}
