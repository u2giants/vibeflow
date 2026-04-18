# @vibeflow/devops

> **Status: Stub package — canonical code lives elsewhere**
>
> The actual implementation lives in [`apps/desktop/src/lib/devops/`](../../apps/desktop/src/lib/devops/).
> This package is not imported via `workspace:*` dependencies (exFAT drive, pnpm symlinks don't work).
> See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

## What This Package Is For

This package is the DevOps subsystem. It manages deployment templates, deploy runs, GitHub Actions visibility, Coolify integration, health checks, and secret mapping. It is the "DevOps hand-holding" layer for non-programmer operators.

## What It Exports

- `DeployTemplateManager` — CRUD for DevOps templates, assignment to projects
- `GitHubActionsClient` — list workflow runs, view logs, trigger dispatches
- `CoolifyClient` — deploy, redeploy, rollback, restart, view logs, health check
- `GHCRClient` — view images, tags, sizes in GitHub Container Registry
- `HealthCheckRunner` — URL checks, response time, HTTP status codes
- `SecretMapper` — overview of which secrets go where (GitHub Secrets vs Coolify env vs local)
- `DeployRunTracker` — records every deploy run with full provenance

## Who Depends On It

- `apps/desktop` renderer (DevOps panel)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/storage`

## Notes

- Coolify API key is stored in keytar, not synced
- GitHub token is stored in keytar, not synced
- Deploy run history is synced to Supabase for visibility across devices
- See `/docs/devops-templates.md` for the Standard and Albert template specifications
- The `DeployTargetClient` interface allows adding new deploy targets (Railway, Render, etc.) without rewriting this package
