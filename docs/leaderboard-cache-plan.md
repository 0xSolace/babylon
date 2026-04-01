# Leaderboard Cache Plan

**Date:** 2026-04-02
**Goal:** Cache the leaderboard as a UX improvement — eliminate loading spinners on back-navigation, tab switches, and "Jump to My Position". The leaderboard is global data that changes slowly (points recompute runs every ~15 minutes), making it an ideal candidate for aggressive client-side caching.

## Work Items

1. **WI-L1: React Query client-side caching** — Eliminates spinners on return visits to pages/tabs
2. **WI-L2: Prefetch adjacent pages** — Makes "Next" button instant
3. **WI-L3: Separate user position cache** — Makes "Jump to My Position" instant
4. **WI-L4: Event-driven cache invalidation** — Invalidate after points recompute + longer server TTL
5. **WI-L5: generatedAt freshness indicator** — Shows when data was last computed

See PR description for full implementation details.
