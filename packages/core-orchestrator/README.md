# @vibeflow/core-orchestrator

## What This Package Does

This package contains the Orchestrator logic: the brain that receives user messages, decides which Mode should handle each task, dispatches work to specialist Modes, collects results, and synthesizes a final response.

The Orchestrator is the user-facing coordinator. It sees the big picture. It does not do the detailed work itself — it delegates to specialist Modes and reports back.

## What It Exports

- `OrchestratorEngine` — the main class that drives conversation routing
- `ModeRouter` — decides which Mode handles a given message or sub-task
- `TaskDispatcher` — sends tasks to specialist Modes and waits for results
- `ResponseSynthesizer` — combines specialist Mode results into a coherent Orchestrator response
- `ExecutionStreamEmitter` — emits events to the left-panel execution stream

## Who Depends On It

- `apps/desktop` renderer process (the conversation panel calls the Orchestrator)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/mode-system`
- `@vibeflow/providers`
- `@vibeflow/approval`

## Rules

- No UI code in this package
- No direct file system or terminal access — use the tooling package via IPC
- All routing decisions must be logged with provenance
