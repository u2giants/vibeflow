# @vibeflow/tooling

## What This Package Does

This package provides clean wrappers for all local machine capabilities: file operations, terminal command execution, diff generation, build runs, and test runs. It runs in the Electron main process and is called via IPC from the renderer.

Every action in this package has provenance: which Mode requested it, which model, which conversation, which project, and when.

## What It Exports

- `FileService` — read, write, list, delete local files
- `TerminalService` — execute shell commands, stream output, capture exit codes
- `DiffService` — generate unified diffs between file versions
- `BuildService` — run build commands and capture output
- `TestService` — run test suites and capture results
- `ActionLogger` — logs every tool action with full provenance

## Who Depends On It

- `apps/desktop` main process (IPC handlers call these services)

## Dependencies

- `@vibeflow/shared-types`

## Notes

- This package runs in the Electron MAIN process only — never in the renderer
- All file paths must be validated before use (no path traversal)
- Terminal commands go through the approval system before execution
- Output is streamed back to the renderer via IPC events
