# @vibeflow/mode-system

## What This Package Does

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
