**PR:** https://github.com/BabylonSocial/babylon/pull/1276
**Linear:** [BAB-263](https://linear.app/eliza-labs/issue/BAB-263)

### Game Guide Completion Works Behind NFT Gating
- Stop rejecting game guide completion with a false `403` when NFT gating is enabled.
- Persist `gameGuideCompletedAt` server-side for authenticated users who can finish onboarding but do not have NFT access.
- Keep the change narrowly scoped by allowlisting only the exact completion endpoint instead of broadening `/api/users/me/*`.
- Add focused middleware coverage so this endpoint stays exempt from NFT gating checks.
