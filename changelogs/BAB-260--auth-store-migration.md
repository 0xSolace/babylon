**PR:** https://github.com/BabylonSocial/babylon/pull/1237
**Linear:** [BAB-260](https://linear.app/eliza-labs/issue/BAB-260)

### Auth Store Migration for Legacy Sessions
- Stop the recurring client-side hydration error caused by older persisted `babylon-auth` payloads.
- Preserve safe auth session data for returning users instead of dropping the whole store on version mismatch.
- Reset transient loading state during migration so refreshed sessions do not keep stale in-flight UI flags.
- Add focused unit coverage for legacy, malformed, and unsupported persisted auth payloads.
