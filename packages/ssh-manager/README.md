# @vibeflow/ssh-manager

> **Status: Stub package — canonical code lives elsewhere**
>
> The actual implementation lives in [`apps/desktop/src/lib/ssh-manager/`](../../apps/desktop/src/lib/ssh-manager/).
> This package is not imported via `workspace:*` dependencies (exFAT drive, pnpm symlinks don't work).
> See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

## What This Package Is For

This package handles SSH operations: discovering the user's existing SSH configuration, listing available identities/keys, and testing SSH connections. It uses the local `ssh` binary and reads `~/.ssh/config` directly.

The goal is to make SSH ergonomic for a non-programmer: the system discovers what is already set up on the machine and presents it clearly, rather than asking the user to manually configure everything.

## What It Exports

- `SshConfigReader` — reads and parses `~/.ssh/config`
- `SshKeyDiscovery` — discovers available SSH keys in `~/.ssh/`
- `SshConnectionTester` — tests an SSH connection and returns success/failure with error details
- `SshTargetManager` — CRUD for SSH target metadata (stored in Supabase, not the keys themselves)

## Who Depends On It

- `apps/desktop` main process (IPC handlers)

## Dependencies

- `@vibeflow/shared-types`

## Notes

- Runs in the Electron MAIN process only
- SSH private key material NEVER leaves the device and is NEVER synced
- Only SSH target metadata (hostname, user, port, key name) is synced to Supabase
- Uses `child_process.spawn` to call the local `ssh` binary for connection testing
- Reads `~/.ssh/config` using Node.js `fs` — no external SSH library needed for config parsing
