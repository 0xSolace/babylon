**PR:** https://github.com/BabylonSocial/babylon/pull/1266
**Linear:** [BAB-287](https://linear.app/eliza-labs/issue/BAB-287/dopamine-hits-v1-backend-wiring-for-market-resolution-notifications)

### Market Resolution Notifications + Digest Backend
- Prediction market resolutions now create structured `market_resolved` notifications with realtime fanout and queued delivery for offline users.
- Both cron settlement and admin manual resolution now trigger the same notification side effects, so behavior is consistent regardless of entrypoint.
- Performance digest settings are persisted in the backend with hourly, daily, and weekly frequency plus `in-app`, `email`, or `both` delivery.
- A new digest cron endpoint evaluates due users hourly and delivers summary notifications based on resolved market performance.
- Prediction positions now include `closesAt`, enabling the existing frontend contract for closing-soon cards.
- Legacy email settings no longer duplicate digest controls; digest delivery now lives in the dedicated Notifications tab.
