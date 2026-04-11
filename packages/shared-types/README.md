# @vibeflow/shared-types

## What This Package Does

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
