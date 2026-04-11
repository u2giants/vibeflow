# @vibeflow/handoff

## What This Package Does

This package generates handoff artifacts: the documents and prompts that allow a brand-new AI session to continue a project without confusion. It also triggers updates to the architecture and idiosyncrasies documentation before generating the handoff.

## What It Exports

- `HandoffGenerator` — orchestrates the full handoff generation process
- `HandoffDocBuilder` — builds the `handoff-<timestamp>.md` document
- `HandoffPromptBuilder` — builds the `handoff-prompt.md` ready-to-paste prompt
- `IdiosyncrasiesUpdater` — prompts the Orchestrator to review and update `/docs/idiosyncrasies.md`
- `HandoffArtifactStore` — saves handoff artifacts to Supabase Storage

## Who Depends On It

- `@vibeflow/core-orchestrator`
- `apps/desktop` renderer (Handoff button in conversation panel)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/storage`
- `@vibeflow/providers` (for Orchestrator summarization call)

## Notes

- Handoff artifacts are versioned — never overwritten, always a new file per handoff
- Handoff artifacts are stored in Supabase Storage and synced to all devices
- See `/docs/handoff-process.md` for the full handoff procedure and document format
