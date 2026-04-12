# VibeFlow — Idiosyncrasies

Last updated: 2026-04-12 (Sprint 2 — Milestone 1 OAuth fix + build config fixes)

---

## What This File Is

This file documents code or architecture choices that may look wrong, unusual, non-standard, or suspicious to a new developer or new AI session — but were done intentionally for a good reason.

**Every agent must read this file before making changes.**
**Every agent must add an entry here when introducing intentional weirdness.**

If you see something in the codebase that looks odd and it is NOT in this file, it may be a genuine bug. If it IS in this file, it was done on purpose — do not "fix" it without understanding the entry first.

---

## Entry Format

```
## [Short title of the oddity]
- **What looks odd:** ...
- **Where it is:** [file path, or "TBD" if not yet implemented]
- **Why it was done:** ...
- **What breaks if cleaned up:** ...
- **Permanent or temporary:** Permanent / Temporary
- **How to safely remove later:** [instructions, or "N/A" if permanent]
```

---

## Entries

### No workspace:* on exFAT — Vite aliases replace pnpm symlinks
- **What looks odd:** No `package.json` in the repo uses `workspace:*` to reference sibling packages. Instead, `apps/desktop/vite.config.ts` has `resolve.alias` entries mapping `@vibeflow/shared-types`, `@vibeflow/build-metadata`, and `@vibeflow/storage` to their source directories. `apps/desktop/tsconfig.json` has matching `paths` entries.
- **Where it is:** `apps/desktop/vite.config.ts`, `apps/desktop/tsconfig.json`, `.npmrc`
- **Why it was done:** The D: drive is formatted exFAT, which does not support symlinks. pnpm (and npm) workspaces use symlinks to link packages. Every `pnpm install` with a `workspace:*` dep fails with `EISDIR: illegal operation on a directory, symlink`.
- **What breaks if cleaned up:** If you add `workspace:*` deps back, `pnpm install` will fail on exFAT. If you remove the Vite aliases, `@vibeflow/*` imports won't resolve at bundle time. If you remove the TS paths, typecheck will fail.
- **Permanent or temporary:** Temporary — once the repo moves to an NTFS drive, switch to standard `workspace:*` deps and remove the aliases/paths.
- **How to safely remove later:** (1) Move repo to NTFS. (2) Add `workspace:*` deps to each consumer's `package.json`. (3) Remove `resolve.alias` from `vite.config.ts`. (4) Remove `paths` from `tsconfig.json`. (5) Run `pnpm install` to verify symlinks work.

### packages/storage inlines its own Project type
- **What looks odd:** `packages/storage/src/local-db.ts` defines its own `Project` interface instead of importing from `@vibeflow/shared-types`.
- **Where it is:** `packages/storage/src/local-db.ts`
- **Why it was done:** The storage package cannot depend on shared-types via `workspace:*` (exFAT, see above). TypeScript `paths` only work for the consumer (`apps/desktop`), not for the package's own `tsc` build. Inlining the type is the simplest workaround.
- **What breaks if cleaned up:** If you import from `@vibeflow/shared-types` without a `workspace:*` dep, `pnpm --filter @vibeflow/storage build` will fail with "Cannot find module".
- **Permanent or temporary:** Temporary — same fix as above (move to NTFS).
- **How to safely remove later:** Add `"@vibeflow/shared-types": "workspace:*"` to storage's `package.json`, replace the inline type with `import type { Project } from '@vibeflow/shared-types'`.

### GitHub OAuth uses a temporary localhost HTTP server instead of a custom URL scheme
- **What looks odd:** In `apps/desktop/src/main/index.ts`, the `auth:signInWithGitHub` handler starts a temporary Node.js `http` server on port 54321, opens the GitHub OAuth URL in the system browser, waits for the callback on `http://127.0.0.1:54321/callback`, exchanges the code for a session, and then closes the server.
- **Where it is:** `apps/desktop/src/main/index.ts` — `auth:signInWithGitHub` IPC handler
- **Why it was done:** In a desktop Electron app, OAuth cannot use a simple redirect URL like a web app. The two common approaches are: (1) register a custom URL scheme (e.g., `vibeflow://auth/callback`) and capture the callback via Electron protocol handler, or (2) spin up a temporary local HTTP server. Approach (1) requires registering the custom scheme in the Electron app and configuring it in Supabase, which is more complex and error-prone for Milestone 1. Approach (2) is simpler and works reliably — the server only lives for the duration of the OAuth flow and closes itself after receiving the callback.
- **What breaks if cleaned up:** If you remove the HTTP server, OAuth will not work. If you change the port from 54321, you must also update the redirect URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
- **Permanent or temporary:** Temporary — a custom URL scheme (`vibeflow://`) is the more "proper" Electron OAuth approach and should be implemented later. The localhost approach is intentional for Milestone 1 simplicity.
- **How to safely remove later:** (1) Register a custom URL scheme in `electron-builder.yml` (Windows: `protocols` array). (2) Handle `app.on('open-url', ...)` or `setAsDefaultProtocolClient` in main process. (3) Update Supabase redirect URL to `vibeflow://auth/callback`. (4) Remove the temporary HTTP server code from `auth:signInWithGitHub`.

### electron-vite requires electron.vite.config.ts, not vite.config.ts
- **What looks odd:** The Vite config file is named `electron.vite.config.ts` instead of the standard `vite.config.ts`.
- **Where it is:** `apps/desktop/electron.vite.config.ts`
- **Why it was done:** electron-vite explicitly looks for a config file named `electron.vite.config.*` and will throw an error if you name it `vite.config.*`. This is documented in the electron-vite source code (`CONFIG_FILE_NAME = 'electron.vite.config'`).
- **What breaks if cleaned up:** If you rename it to `vite.config.ts`, electron-vite will not pick up the config and all dependencies (including `@supabase/supabase-js` and `electron`) will be bundled inline, resulting in a 730KB bundle that crashes at runtime.
- **Permanent or temporary:** Permanent — this is how electron-vite works.
- **How to safely remove later:** N/A — this is the correct file name for electron-vite projects.

### ELECTRON_RUN_AS_NODE=1 environment variable breaks Electron
- **What looks odd:** The app crashes with `TypeError: Cannot read properties of undefined (reading 'whenReady')` on `electron.app.whenReady()`.
- **Where it is:** System environment variable
- **Why it was done:** This was NOT intentional — it was a pre-existing environment variable that forces Electron to run as plain Node.js instead of the full Electron runtime. When `ELECTRON_RUN_AS_NODE=1` is set, `require('electron')` returns an empty module with no `app`, `BrowserWindow`, etc.
- **What breaks if cleaned up:** If this env var is set, the app will always crash on startup. It must be unset for Electron to work.
- **Permanent or temporary:** Permanent fix — ensure this env var is never set.
- **How to safely remove later:** Run `set ELECTRON_RUN_AS_NODE=` in cmd.exe or `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell. Check with `echo %ELECTRON_RUN_AS_NODE%` (cmd) or `$env:ELECTRON_RUN_AS_NODE` (PowerShell) — it should be empty.

---

## How to Add an Entry

When you introduce intentional weirdness:

1. Add an entry to this file immediately (do not wait for handoff)
2. Use the format above
3. Be specific about the file path and line number if known
4. Explain the "why" clearly — future AI sessions will read this
5. Update the "Last updated" date at the top of this file

During handoff, the Orchestrator reviews this file and adds any entries that were missed during the session.
