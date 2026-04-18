# VibeFlow — Idiosyncrasies

Last updated: 2026-04-18 (Doc Audit + Sync Re-enablement Sprint)

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

### 7. ~~Cloud sync intentionally disabled~~ — RESOLVED 2026-04-18

- **Resolution:** Cloud sync was re-enabled on 2026-04-18 (commit `7e2ce7d`). `initSyncEngine()` is now a real implementation that creates a SyncEngine with an authenticated SupabaseClient and starts it. All stub IPC handlers were replaced. The Supabase migration was run; all tables, RLS policies, and the handoffs storage bucket are created.
- **What this entry was:** Sync had been disabled during the `better-sqlite3` → `sql.js` migration to stabilize the app. It is now fully re-enabled.
- **Permanent or temporary:** Resolved — this entry is kept for historical reference only.
- **Remaining gap:** Two-device sync has not yet been validated in practice. See [`docs/what-is-left.md`](what-is-left.md).

---

### 8. OpenRouter user-scoped models endpoint

- **What looks odd:** The OpenRouter model list and test connection handlers use `https://openrouter.ai/api/v1/models/user` instead of the more commonly documented `https://openrouter.ai/api/v1/models`.
- **Where it is:** `apps/desktop/src/main/index.ts` — `openrouter:listModels` handler (line ~514) and `openrouter:testConnection` handler (line ~536)
- **Why it was done:** The general `/api/v1/models` endpoint returns the full OpenRouter catalog (349+ models), which is overwhelming and includes models the user can't access. The `/api/v1/models/user` endpoint returns only models the user's API key has access to (~31 models typically), which is much more manageable.
- **What breaks if cleaned up:** If you switch back to `/api/v1/models`, the model picker will show 349+ models including ones the user can't use. The UI will be slow and confusing.
- **Permanent or temporary:** Permanent — this is the correct endpoint for user-facing model lists.
- **How to safely remove later:** N/A — this is the intended behavior.

---

### 9. ~~Handoff system reads docs from relative path~~ — RESOLVED 2026-04-17

- **Resolution:** Fixed on 2026-04-17. The handoff IPC handlers now use `app.isPackaged` to determine the correct path. In dev mode, they use the repo-relative path. In packaged builds, `docs/idiosyncrasies.md` is bundled into `extraResources` via `electron-builder.yml` and read from `process.resourcesPath`.
- **What this entry was:** The handoff system originally used a hardcoded relative path (`../../../../docs/idiosyncrasies.md`) that would have broken in packaged builds.
- **Permanent or temporary:** Resolved — this entry is kept for historical reference only.

---

### 10. Listener stacking fix in preload

- **What looks odd:** In [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts), the `onStreamToken`, `onStreamDone`, and `onStreamError` functions call `ipcRenderer.removeAllListeners()` before `ipcRenderer.on()`.
- **Where it is:** `apps/desktop/src/preload/index.ts` — lines ~52–65
- **Why it was done:** Without the `removeAllListeners()` call, every time `ConversationScreen.tsx` re-renders or switches conversations, a new listener is added without removing the old one. This causes listener stacking — each token is appended N times (producing `7a7a7a7a...` repeating tokens). The fix ensures there is never more than one listener per channel.
- **What breaks if cleaned up:** If you remove the `removeAllListeners()` calls, the streaming token bug will return. Tokens will be duplicated exponentially as the user switches conversations.
- **Permanent or temporary:** Permanent — this is the correct pattern for Electron IPC event listeners that are re-registered on component mount.
- **How to safely remove later:** N/A — this is the correct fix.

---

---

### 11. conversation_leases RLS requires WITH CHECK + ensure-remote race-condition guard

- **What looks odd:** In [`apps/desktop/src/lib/sync/sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts), the `acquireLease()` method calls `pushConversation()` at the very top before attempting to acquire the lease. This looks like redundant work — why push the conversation before acquiring the lease?
- **Where it is:** `apps/desktop/src/lib/sync/sync-engine.ts` — `acquireLease()` method (near line 571)
- **Why it was done:** The `conversation_leases` table has a foreign key to `conversations`. Under concurrent access, attempting to insert a lease before the conversation row exists in Supabase causes a FK violation. The `ensure-remote` guard (`pushConversation` at the top of `acquireLease`) guarantees the conversation row exists in Supabase before any lease insert. This was added as a hotfix after the M4 RLS migration revealed a race condition.
- **What breaks if cleaned up:** If you remove the `pushConversation` call, lease acquisition will fail with FK violations when a conversation exists locally but hasn't been synced yet. This is a silent failure mode — the lease appears to succeed locally but Supabase rejects it.
- **Permanent or temporary:** Permanent — this is the correct guard for the FK constraint.
- **How to safely remove later:** N/A — keep this guard.

---

### 12. apps/desktop/src/lib/ is the authoritative source; packages/ is canonical for only 3

- **What looks odd:** The `packages/` directory has 14 subdirectories, but most of them only contain a `README.md` with no `src/` directory. The actual code for all these subsystems lives in `apps/desktop/src/lib/`.
- **Where it is:** `packages/` root — subdirectories like `core-orchestrator/`, `mode-system/`, `tooling/`, `git-manager/`, etc. have no code.
- **Why it was done:** The repo is on an exFAT drive (see idiosyncrasies #3). Only three packages have canonical source in `packages/` (`shared-types`, `storage`, `build-metadata`). All other packages were originally planned as separate packages but ended up implemented directly in `apps/desktop/src/lib/` during the brownfield rebuild. The `packages/` README stubs describe the intended API and serve as design documentation.
- **What breaks if cleaned up:** If you move code from `apps/desktop/src/lib/` back to `packages/`, the exFAT symlink problem re-emerges. The app cannot resolve `@vibeflow/*` workspace imports via normal pnpm workspace links on exFAT.
- **Permanent or temporary:** Temporary — same fix as idiosyncrasies #3 (move to NTFS).
- **How to safely remove later:** Move repo to NTFS, then refactor code back into proper packages.

---

### 13. main/index.ts is intentionally large (~2,441 lines)

- **What looks odd:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) is approximately 2,441 lines. For most TypeScript projects this would be a red flag.
- **Where it is:** `apps/desktop/src/main/index.ts`
- **Why it was done:** The file is an IPC handler registry — a flat list of `ipcMain.handle()` registrations, each delegating immediately to a service in `apps/desktop/src/lib/`. Business logic does not live in this file. The size reflects the breadth of the IPC API surface (100+ handlers across 30+ domains), not complexity. Splitting it into per-domain handler files is desirable but has been deferred.
- **What breaks if cleaned up:** Nothing breaks if you split it correctly (same IPC channel names, same handler implementations). But a bad split risks breaking channel names or handler registration order.
- **Permanent or temporary:** Temporary — a split into `src/main/handlers/*.ts` files is planned (see [`docs/what-is-left.md`](what-is-left.md) item #7).
- **How to safely remove later:** Create `src/main/handlers/` directory, move groups of handlers by domain, import and register them all in `index.ts`. Keep `index.ts` as the registration file only.

---

### 14. Brownfield migrations use ALTER TABLE ADD COLUMN — old columns preserved

- **What looks odd:** Several SQLite tables in `local-db.ts` have both old columns (`type`, `permissions_json`) and new columns (`class`, `owner`, `description`, `scope`, `actions_json`) coexisting. It may look like someone forgot to remove the old columns.
- **Where it is:** `capabilities` table (and a few others) in `apps/desktop/src/lib/storage/local-db.ts`
- **Why it was done:** Components 14, 17, and 21 added columns to existing tables using `ALTER TABLE ADD COLUMN`. Dropping and recreating tables during brownfield evolution would destroy all existing user data. Old columns are intentionally preserved for backward compatibility until a data migration back-fills the old rows into the new schema.
- **What breaks if cleaned up:** If you drop the old columns without back-filling, existing rows will lose data. UI components reading the new columns will show empty fields for legacy rows.
- **Permanent or temporary:** Temporary — once old rows are back-filled to the new schema, old columns can be dropped in a future migration.
- **How to safely remove later:** (1) Write a migration that back-fills old rows. (2) Update all read paths to use new columns only. (3) DROP COLUMN in a subsequent migration.

---

### 15. Duplicate IPC handler blocks will crash the app at boot

- **What looks odd:** There is no obvious guard against registering the same `ipcMain.handle()` channel twice.
- **Where it is:** `apps/desktop/src/main/index.ts` — anywhere handler-registration blocks appear
- **Why it was done:** Electron throws `Attempted to register a second handler for 'channel-name'` if you register a handler twice. During the brownfield rebuild, copy-paste merges introduced 5 duplicate `secrets:*`/`migration:*` blocks (461 lines of duplicates). This was fixed on 2026-04-17.
- **What breaks if cleaned up incorrectly:** If duplicate blocks are introduced again during a future merge, the app will crash at boot with `Attempted to register a second handler`. The crash message includes the channel name.
- **Permanent or temporary:** Permanent rule — handler-registration blocks must appear exactly once per domain.
- **How to safely remove later:** N/A — this is the correct pattern.

---

### 16. SQL strings must use -- for comments, never //

- **What looks odd:** All SQL strings in `local-db.ts` use `--` for comments, not the more common `//` JavaScript single-line comment style.
- **Where it is:** `apps/desktop/src/lib/storage/local-db.ts` — all SQL template literal strings
- **Why it was done:** sql.js parses JavaScript template literals as raw SQL. If you put `//` inside a SQL string, sql.js interprets it as integer division (e.g., `some_value // other_value`), causing `near "/": syntax error` at boot. This was a real boot crash fixed on 2026-04-17.
- **What breaks if cleaned up:** If you add `//` comments inside SQL template literals (even accidentally via a code formatter), the app will crash at boot with a SQL syntax error.
- **Permanent or temporary:** Permanent — sql.js is the SQL engine and it does not recognize `//` as a comment.
- **How to safely remove later:** N/A — always use `--` for SQL comments.

---

### 17. listProjects(userId) must receive a real user ID — empty string returns zero rows silently

- **What looks odd:** Every call to `localDb.listProjects(userId)` (and similar user-scoped read methods) passes `userId` explicitly. You might expect a default or a "get all" mode.
- **Where it is:** Any call site that calls `listProjects`, `listConversations`, or similar user-scoped methods in `apps/desktop/src/lib/storage/local-db.ts`
- **Why it was done:** The sql.js WHERE clause `WHERE user_id = ?` with an empty string argument (`''`) is valid SQL — it just matches no rows. This caused "projects list is always empty" bugs that were hard to trace because no error was thrown. The fix is to always call `getCurrentUserId()` and pass the result. Two bugs of this shape were fixed on 2026-04-17.
- **What breaks if cleaned up:** If you remove the user ID parameter and use a global or default, the RLS semantics break and users could see each other's data.
- **Permanent or temporary:** Permanent rule — always pass a real user ID.
- **How to safely remove later:** N/A — always pass `getCurrentUserId()`.

---

### 18. SyncEngine constructor accepts an authenticated SupabaseClient, not raw credentials

- **What looks odd:** The `SyncEngine` constructor in [`apps/desktop/src/lib/sync/sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) takes a pre-authenticated `SupabaseClient` instance, not a URL and anon key. This differs from most Supabase client patterns where you construct the client inside the module.
- **Where it is:** `apps/desktop/src/lib/sync/sync-engine.ts` — constructor signature
- **Why it was done:** The SyncEngine operates under the signed-in user's session. If it creates its own Supabase client with just the anon key, RLS policies reject writes (because the anon key has no user context). By accepting an already-authenticated client (one that has called `supabase.auth.setSession()`), the SyncEngine's writes are automatically scoped to the signed-in user.
- **What breaks if cleaned up:** If you change the constructor to accept raw credentials and call `createClient()` internally, all sync writes will fail with RLS policy violations.
- **Permanent or temporary:** Permanent — this is the correct design for RLS-enforced sync.
- **How to safely remove later:** N/A — this is intentional.

---

## How to Add an Entry

When you introduce intentional weirdness:

1. Add an entry to this file immediately (do not wait for handoff)
2. Use the format above
3. Be specific about the file path and line number if known
4. Explain the "why" clearly — future AI sessions will read this
5. Update the "Last updated" date at the top of this file

During handoff, the Orchestrator reviews this file and adds any entries that were missed during the session.
