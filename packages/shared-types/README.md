# @vibeflow/shared-types

> **Status: Partially canonical — types live in two places**
>
> The shared types are defined in both this package (`packages/shared-types/src/`) and in
> [`apps/desktop/src/lib/shared-types/`](../../apps/desktop/src/lib/shared-types/) (the canonical runtime location).
> The desktop app uses the `lib/` version directly via TypeScript path aliases in `tsconfig.json`
> and Vite `resolveId` plugin rather than `workspace:*` imports (exFAT drive, pnpm symlinks don't work).
> See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

## What This Package Is For

This package contains all TypeScript interfaces and types used across the entire VibeFlow codebase. It is the single source of truth for the data model.

Every entity in the system — Account, Project, Conversation, Message, Mode, ActionRun, ApprovalItem, etc. — is defined here as a TypeScript interface.

## What It Exports

- All entity interfaces (Account, Device, Project, ConversationThread, Message, Mode, ModeSoul, etc.)
- All enum types (RunState, ApprovalTier, SyncStatus, etc.)
- All IPC message types (for communication between Electron main and renderer)
- Shared utility types and type guards

## Who Depends On It

Everything. Every other package and the desktop app imports from this package.

## Rules

- No business logic in this package — only type definitions
- No external dependencies — pure TypeScript types only
- If you add a new entity anywhere in the system, add its interface here first
