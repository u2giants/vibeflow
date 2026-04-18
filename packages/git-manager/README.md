# @vibeflow/git-manager

> **Status: Stub package — canonical code lives elsewhere**
>
> The actual implementation lives in [`apps/desktop/src/lib/git-manager/`](../../apps/desktop/src/lib/git-manager/).
> This package is not imported via `workspace:*` dependencies (exFAT drive, pnpm symlinks don't work).
> See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

## What This Package Is For

This package wraps all Git operations. It uses the local `git` binary (not a JS git library) to ensure compatibility with the user's existing git configuration, credentials, and SSH setup.

## What It Exports

- `GitService` — the main service with methods for all git operations
  - `status(repoPath)` — get current branch, staged/unstaged changes
  - `diff(repoPath, options)` — get diff output
  - `commit(repoPath, message)` — stage all and commit
  - `push(repoPath, remote, branch)` — push to remote
  - `pull(repoPath)` — pull from remote
  - `log(repoPath, limit)` — get recent commit history
  - `branch(repoPath)` — list branches
  - `checkout(repoPath, branch)` — switch branches

## Who Depends On It

- `apps/desktop` main process (IPC handlers)

## Dependencies

- `@vibeflow/shared-types`

## Notes

- Runs in the Electron MAIN process only
- Uses `child_process.spawn` to call the local `git` binary
- All git operations go through the approval system (commit = Tier 2, push to main = Tier 3)
- Git output is streamed back to the renderer via IPC events
- Requires git to be installed and in the PATH
