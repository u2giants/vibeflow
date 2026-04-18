# @vibeflow/mode-system

> **Status: Stub package — canonical code lives elsewhere**
>
> The actual implementation lives in [`apps/desktop/src/lib/mode-system/`](../../apps/desktop/src/lib/mode-system/).
> This package is not imported via `workspace:*` dependencies (exFAT drive, pnpm symlinks don't work).
> See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

## What This Package Is For

This package manages Mode definitions, souls (instructions), configuration, and per-mode model assignments. It is the registry of all Modes in the system.

A Mode is a specialist AI persona with a name, slug, soul (detailed instructions), assigned model, tool permissions, and approval policy. Modes are not hardcoded — they are stored in the database and editable in the GUI.

## What It Exports

- `ModeRegistry` — loads, stores, and retrieves Mode definitions
- `ModeConfigManager` — CRUD operations for Mode configs (create, read, update, delete)
- `SoulValidator` — validates that a soul/instruction set is well-formed
- `DefaultModes` — the six default Mode definitions (Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer)
- Type re-exports from shared-types for Mode-related interfaces

## Who Depends On It

- `@vibeflow/core-orchestrator`
- `apps/desktop` renderer (Mode settings panel)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/storage`
