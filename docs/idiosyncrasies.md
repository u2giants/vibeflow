# VibeFlow — Idiosyncrasies

Last updated: 2026-04-14 (Documentation Hardening Sprint)

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

### 1. electron.vite.config.ts naming requirement

- **What looks odd:** The Vite config file is named `electron.vite.config.ts` instead of the standard `vite.config.ts`.
- **Where it is:** [`apps/desktop/electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts)
- **Why it was done:** electron-vite explicitly looks for a config file named `electron.vite.config.*` and will throw an error if you name it `vite.config.*`. This is documented in the electron-vite source code (`CONFIG_FILE_NAME = 'electron.vite.config'`).
- **What breaks if cleaned up:** If you rename it to `vite.config.ts`, electron-vite will not pick up the config and all dependencies (including `@supabase/supabase-js` and `electron`) will be bundled inline, resulting in a 730KB bundle that crashes at runtime.
- **Permanent or temporary:** Permanent — this is how electron-vite works.
- **How to safely remove later:** N/A — this is the correct file name for electron-vite projects.

---

### 2. ELECTRON_RUN_AS_NODE environment variable breaks Electron

- **What looks odd:** The app crashes with `TypeError: Cannot read properties of undefined (reading 'whenReady')` on `electron.app.whenReady()`.
- **Where it is:** System environment variable (not in code)
- **Why it was done:** This was NOT intentional — it was a pre-existing environment variable on Albert's machine that forces Electron to run as plain Node.js instead of the full Electron runtime. When `ELECTRON_RUN_AS_NODE=1` is set, `require('electron')` returns an empty module with no `app`, `BrowserWindow`, etc.
- **What breaks if cleaned up:** If this env var is set, the app will always crash on startup. It must be unset for Electron to work.
- **Permanent or temporary:** Permanent fix — ensure this env var is never set.
- **How to safely remove later:** Run `set ELECTRON_RUN_AS_NODE=` in cmd.exe or `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell. Check with `echo %ELECTRON_RUN_AS_NODE%` (cmd) or `$env:ELECTRON_RUN_AS_NODE` (PowerShell) — it should be empty.

---

### 3. No workspace:* on exFAT — Vite plugin replaces pnpm symlinks

- **What looks odd:** No `package.json` in the repo uses `workspace:*` to reference sibling packages. Instead, [`apps/desktop/electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts) has a Vite plugin with a `resolveId` hook mapping `@vibeflow/*` imports to their source directories. [`apps/desktop/tsconfig.json`](../apps/desktop/tsconfig.json) has matching `paths` entries.
- **Where it is:** `apps/desktop/electron.vite.config.ts`, `apps/desktop/tsconfig.json`, `.npmrc`
- **Why it was done:** The D: drive is formatted exFAT, which does not support symlinks. pnpm (and npm) workspaces use symlinks to link packages. Every `pnpm install` with a `workspace:*` dep fails with `EISDIR: illegal operation on a directory, symlink`. The Vite plugin's `resolveId` hook with `enforce: 'pre'` runs before Node's module resolution, guaranteeing interception even in electron-vite's SSR mode. A simpler `resolve.alias` approach was tried first but **failed** because electron-vite's SSR mode resolves bare specifiers through Node before applying aliases.
- **What breaks if cleaned up:** If you add `workspace:*` deps back, `pnpm install` will fail on exFAT. If you remove the Vite plugin, `@vibeflow/*` imports won't resolve at bundle time. If you remove the TS paths, typecheck will fail.
- **Permanent or temporary:** Temporary — once the repo moves to an NTFS drive, switch to standard `workspace:*` deps and remove the plugin/paths.
- **How to safely remove later:** (1) Move repo to NTFS. (2) Add `workspace:*` deps to each consumer's `package.json`. (3) Remove the `resolveId` plugin from `electron.vite.config.ts`. (4) Remove `paths` from `tsconfig.json`. (5) Run `pnpm install` to verify symlinks work.

---

### 4. packages/storage inlines its own Project type

- **What looks odd:** [`packages/storage/src/local-db.ts`](../packages/storage/src/local-db.ts) defines its own `Project` interface instead of importing from `@vibeflow/shared-types`.
- **Where it is:** `packages/storage/src/local-db.ts`
- **Why it was done:** The storage package cannot depend on shared-types via `workspace:*` (exFAT, see above). TypeScript `paths` only work for the consumer (`apps/desktop`), not for the package's own `tsc` build. Inlining the type is the simplest workaround.
- **What breaks if cleaned up:** If you import from `@vibeflow/shared-types` without a `workspace:*` dep, `pnpm --filter @vibeflow/storage build` will fail with "Cannot find module".
- **Permanent or temporary:** Temporary — same fix as above (move to NTFS).
- **How to safely remove later:** Add `"@vibeflow/shared-types": "workspace:*"` to storage's `package.json`, replace the inline type with `import type { Project } from '@vibeflow/shared-types'`.

---

### 5. GitHub OAuth uses localhost HTTP server with dual-flow support

- **What looks odd:** In [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts), the `auth:signInWithGitHub` handler starts a temporary Node.js `http` server on port 54321, opens the GitHub OAuth URL in the system browser, waits for the callback on `http://127.0.0.1:54321/callback`, and handles TWO different OAuth response formats.
- **Where it is:** `apps/desktop/src/main/index.ts` — `auth:signInWithGitHub` IPC handler (lines ~132–310)
- **Why it was done:** In a desktop Electron app, OAuth cannot use a simple redirect URL like a web app. The two common approaches are: (1) register a custom URL scheme (e.g., `vibeflow://auth/callback`) or (2) spin up a temporary local HTTP server. Approach (2) was chosen for Milestone 1 simplicity.
- **OAuth flow detail (implicit vs PKCE):** Supabase may return OAuth tokens in two different formats. (a) **PKCE flow**: returns `?code=...` as a query parameter — handled by `exchangeCodeForSession()`. (b) **Implicit flow**: returns `#access_token=...&refresh_token=...` as a hash fragment — hash fragments are NOT sent to the server by browsers, so the callback handler serves an HTML page with JavaScript that extracts the hash, then POSTs the tokens to `/callback-tokens` which resolves the promise. The handler then uses `setSession()` to establish the session. This dual-flow support was added after Albert reported "No auth code received" because Supabase was returning implicit flow tokens.
- **What breaks if cleaned up:** If you remove the HTTP server, OAuth will not work. If you change the port from 54321, you must also update the redirect URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. If you remove the implicit flow handling, sign-in will fail with "No auth code received" when Supabase returns hash fragment tokens.
- **Permanent or temporary:** Temporary — a custom URL scheme (`vibeflow://`) is the more "proper" Electron OAuth approach and should be implemented later.
- **How to safely remove later:** (1) Register a custom URL scheme in `electron-builder.yml` (Windows: `protocols` array). (2) Handle `app.on('open-url', ...)` or `setAsDefaultProtocolClient` in main process. (3) Update Supabase redirect URL to `vibeflow://auth/callback`. (4) Remove the temporary HTTP server code from `auth:signInWithGitHub`.

---

### 6. sql.js replaces better-sqlite3

- **What looks odd:** The app uses `sql.js` (a pure JavaScript SQLite implementation compiled from C via Emscripten) instead of `better-sqlite3` (the standard native SQLite library for Node.js). The database layer in [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) uses `db.exec()` and `db.run()` with array-based results instead of the more ergonomic `db.prepare().get()` pattern.
- **Where it is:** `apps/desktop/src/lib/storage/local-db.ts`, `apps/desktop/package.json` (dependency: `sql.js`), `apps/desktop/src/lib/storage/sql-js.d.ts` (custom type declarations)
- **Why it was done:** `better-sqlite3` requires native C++ compilation via `node-gyp`. On Albert's machine, this repeatedly failed due to missing Visual Studio build tools, ABI mismatches, and NAPI version conflicts. Multiple fix attempts failed. `sql.js` requires zero native compilation and works identically on every platform.
- **What breaks if cleaned up:** If you switch back to `better-sqlite3`, you need to ensure native compilation works on the target machine. The entire `local-db.ts` file would need to be rewritten to use `better-sqlite3` API patterns. The `sql-js.d.ts` type declaration file can be removed.
- **Permanent or temporary:** Potentially permanent. `sql.js` works reliably. Switching back to `better-sqlite3` is only worth it if performance becomes an issue with large datasets.
- **How to safely remove later:** (1) Install `better-sqlite3` and verify native compilation works. (2) Rewrite `local-db.ts` to use `better-sqlite3` API. (3) Remove `sql.js` from dependencies. (4) Remove `sql-js.d.ts`.

---

### 7. Cloud sync intentionally disabled

- **What looks odd:** The [`initSyncEngine()`](../apps/desktop/src/main/index.ts:94) function in the main process is a no-op. It logs a message and sends `'offline'` status to the renderer. All sync IPC handlers (`sync:syncAll`, `sync:acquireLease`, etc.) return stub values. The sync indicator permanently shows 🔴 Offline.
- **Where it is:** `apps/desktop/src/main/index.ts` — lines ~94–102 (initSyncEngine), lines ~632–646 (stub IPC handlers), line ~956 (before-quit handler)
- **Why it was done:** Sync was disabled to stabilize the app after the `better-sqlite3` → `sql.js` migration. The Supabase migration SQL has not been run. The sync engine was written against `better-sqlite3` API patterns and needs adaptation.
- **What breaks if cleaned up:** Nothing breaks if sync is re-enabled correctly. But re-enabling without running the Supabase migration will cause errors. Re-enabling without adapting the sync engine for sql.js will cause type/API mismatches.
- **Permanent or temporary:** Temporary — sync should be re-enabled after the Supabase migration is run and the sync engine is adapted for sql.js.
- **How to safely remove later:** (1) Run `docs/supabase-migration-m4.sql` on the Supabase instance. (2) Adapt `sync-engine.ts` to work with the sql.js-based `LocalDb`. (3) Re-implement `initSyncEngine()` to actually create and start the SyncEngine. (4) Replace stub IPC handlers with real sync calls. (5) Test with two devices.

---

### 8. OpenRouter user-scoped models endpoint

- **What looks odd:** The OpenRouter model list and test connection handlers use `https://openrouter.ai/api/v1/models/user` instead of the more commonly documented `https://openrouter.ai/api/v1/models`.
- **Where it is:** `apps/desktop/src/main/index.ts` — `openrouter:listModels` handler (line ~514) and `openrouter:testConnection` handler (line ~536)
- **Why it was done:** The general `/api/v1/models` endpoint returns the full OpenRouter catalog (349+ models), which is overwhelming and includes models the user can't access. The `/api/v1/models/user` endpoint returns only models the user's API key has access to (~31 models typically), which is much more manageable.
- **What breaks if cleaned up:** If you switch back to `/api/v1/models`, the model picker will show 349+ models including ones the user can't use. The UI will be slow and confusing.
- **Permanent or temporary:** Permanent — this is the correct endpoint for user-facing model lists.
- **How to safely remove later:** N/A — this is the intended behavior.

---

### 9. Handoff system reads docs from relative path

- **What looks odd:** In [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts), the handoff IPC handler reads `docs/idiosyncrasies.md` using a relative path `../../../../docs/idiosyncrasies.md` from the compiled `out/main/index.js` location.
- **Where it is:** `apps/desktop/src/main/index.ts` — `handoff:generate` and `handoff:getIdiosyncrasies` IPC handlers (lines ~756, ~818)
- **Why it was done:** The handoff system needs to include current idiosyncrasies in the generated handoff document so a new AI session knows about intentional weirdness. Reading from the source repo path ensures the latest content is included.
- **What breaks if cleaned up:** If you change the relative path, the handoff generator will fail to read idiosyncrasies.md and the handoff document will be incomplete. If the file doesn't exist, it falls back to an error message. **This path will break in packaged builds** where the directory structure is different — this needs to be fixed before packaging.
- **Permanent or temporary:** Temporary — needs to be fixed for packaged builds. Should use `app.getAppPath()` or bundle the docs into the app resources.
- **How to safely remove later:** Use `app.isPackaged` to determine the correct path. In dev, use the relative path. In packaged builds, either bundle docs into `extraResources` or read from a known location.

---

### 10. Listener stacking fix in preload

- **What looks odd:** In [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts), the `onStreamToken`, `onStreamDone`, and `onStreamError` functions call `ipcRenderer.removeAllListeners()` before `ipcRenderer.on()`.
- **Where it is:** `apps/desktop/src/preload/index.ts` — lines ~52–65
- **Why it was done:** Without the `removeAllListeners()` call, every time `ConversationScreen.tsx` re-renders or switches conversations, a new listener is added without removing the old one. This causes listener stacking — each token is appended N times (producing `7a7a7a7a...` repeating tokens). The fix ensures there is never more than one listener per channel.
- **What breaks if cleaned up:** If you remove the `removeAllListeners()` calls, the streaming token bug will return. Tokens will be duplicated exponentially as the user switches conversations.
- **Permanent or temporary:** Permanent — this is the correct pattern for Electron IPC event listeners that are re-registered on component mount.
- **How to safely remove later:** N/A — this is the correct fix.

---

## How to Add an Entry

When you introduce intentional weirdness:

1. Add an entry to this file immediately (do not wait for handoff)
2. Use the format above
3. Be specific about the file path and line number if known
4. Explain the "why" clearly — future AI sessions will read this
5. Update the "Last updated" date at the top of this file

During handoff, the Orchestrator reviews this file and adds any entries that were missed during the session.
