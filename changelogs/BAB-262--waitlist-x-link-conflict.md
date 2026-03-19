**PR:** https://github.com/BabylonSocial/babylon/pull/1273
**Linear:** [BAB-262](https://linear.app/eliza-labs/issue/BAB-262/bugwaitlist-handle-privy-x-link-conflicts-without-unhandled-error)

### Waitlist X Link Conflict Handling
- Stop surfacing the expected Privy X account conflict as an unhandled waitlist client error.
- Show a clear message when the X account is already linked to another user.
- Keep the Privy-native waitlist linking flow and refresh waitlist state after successful social linking.
- Reuse the same handled Privy error mapping in the shared social-linking flow to avoid divergent behavior.
