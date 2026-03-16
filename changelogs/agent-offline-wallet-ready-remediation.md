**PR:** https://github.com/BabylonSocial/babylon/pull/1251
**Linear:** N/A

### Agent Offline-Ready Wallet Remediation
- Remove the agent wallet fallback path that could persist fake custody state without a usable signing backend.
- Enforce canonical Privy-backed wallet state for agents with `privyId`, `privyWalletId`, `walletAddress`, and `offlineWalletReady`.
- Add audit and remediation scripts to classify agent wallet state and repair corrupted records safely.
- Remediate all current staging and production agent records to the offline-ready Privy wallet model.
