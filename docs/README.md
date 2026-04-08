# Babylon internal docs

Human-written design and roadmap notes. **Agent rules** live in [`../CLAUDE.md`](../CLAUDE.md) at the repo root (do not duplicate them here).

| Doc | Purpose |
|-----|---------|
| [database-layer.md](./database-layer.md) | **Why** we split `@babylon/db`, `drizzle-orm`, and `@babylon/db/runtime`; RLS (`asUser` / `asSystem` / `asPublic`); where `where` clauses belong. |
| [roadmap-database-layer.md](./roadmap-database-layer.md) | Planned follow-ups (engine query extraction, replica helpers, etc.) with **done when** criteria. |
| [skills.md](./skills.md) | Agent skills / tooling notes. |
| [vendors/](./vendors/) | Generated or curated vendor API references (`bun run docs:generate`). |
