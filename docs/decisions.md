# VibeFlow — Decision Log

This file records every major architecture or product decision, why it was made, and what alternatives were considered.
Agents must add an entry here whenever a significant decision is made or changed.

---

## Decision 1 — Foundation Strategy: Roo-Inspired Reimplementation

**Date:** 2026-04-11
**Decision:** Implement Mode/orchestration behavior in our own TypeScript codebase, inspired by Roo Code's concepts but not using Roo Code as a base.
**Decided by:** Orchestrator + Albert

**Alternatives considered:**
1. Use Roo Code as the primary base (wrap it in Electron)
2. **Roo-inspired reimplementation in our own TypeScript** ← CHOSEN
3. Hybrid: borrow selected Roo modules, write core orchestration ourselves

**Why this was chosen:**
Roo Code is a VS Code extension at its core. Its architecture assumes VS Code's extension host, VS Code's file system APIs, VS Code's terminal, and VS Code's editor. Wrapping that in a standalone Electron app would mean fighting VS Code's assumptions in every AI handoff session. A clean reimplementation gives us a codebase that any AI session can understand immediately, with no hidden VS Code dependencies.

**What we borrow from Roo conceptually:**
- Mode definitions with name, slug, soul/instructions, model assignment, tool permissions, approval policy
- Orchestrator-as-primary-user-facing-mode pattern
- Handoff artifact generation
- Per-mode temperature and inference settings

**Consequences:**
- More upfront work to implement Mode system from scratch
- Much cleaner codebase for AI-assisted maintenance
- No dependency on Roo Code's release cycle or VS Code API changes

---

## Decision 2 — Cloud Backend: Hosted Supabase

**Date:** 2026-04-11
**Decision:** Use hosted Supabase for Auth, Postgres, Realtime, and Storage.
**Decided by:** Orchestrator + Albert

**Alternatives considered:**
- Railway + custom backend
- Cloudflare Workers + D1
- Firebase
- Custom Node.js server + PostgreSQL
- **Hosted Supabase** ← CHOSEN

**Why this was chosen:**
Minimal moving parts for a solo non-technical builder using AI. Auth + Postgres + Realtime + Storage in one hosted service. Supabase Realtime handles live push to all clients. Supabase Auth handles device registration and sessions. No need to build or maintain a custom backend server for v1.

**Consequences:**
- Dependent on Supabase availability and pricing
- Supabase Realtime has some limitations for very high-frequency events (mitigated by using Broadcast channels for ephemeral events)
- Easy to migrate away from if needed — Supabase is open source and self-hostable

---

## Decision 3 — Approval Strategy: Three-Tier with Second-Model Review

**Date:** 2026-04-11
**Decision:** Implement a three-tier approval system: auto-allow / second-model review / human approval.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
The product requirement is to minimize human interruption. A second AI model (cheap and fast, e.g., Gemini Flash) handles routine review, so the human only sees genuinely risky or irreversible actions. This dramatically reduces approval fatigue while maintaining safety.

**Consequences:**
- Requires a second model call for Tier 2 actions (small cost, fast)
- Second-model review decisions are logged for auditability
- Human approval is rare and meaningful

See [`docs/approval-policy.md`](approval-policy.md) for full details.

---

## Decision 4 — Secrets: keytar + Encrypted Supabase Vault

**Date:** 2026-04-11
**Decision:** Local device secrets use keytar (Windows Credential Manager). Synced secrets use encrypted Supabase Storage. SSH private keys stay local only.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
Local secrets (API keys, SSH passphrases) should never leave the device by default. keytar uses the OS-native secure storage on Windows. For users who want their API keys on multiple devices, we offer opt-in encrypted sync via Supabase Storage with AES-256 encryption. SSH private key material never syncs — only SSH target metadata (hostname, user, port) syncs.

**Consequences:**
- Users must enter their OpenRouter API key on each device (unless they opt into encrypted sync)
- SSH keys are always local — this is a feature, not a limitation
- keytar has some Windows-specific quirks (documented in idiosyncrasies.md when encountered)

---

## Decision 5 — AI Provider: OpenRouter First-Class

**Date:** 2026-04-11
**Decision:** OpenRouter is the primary AI provider from day one. Other providers can be added later via the provider abstraction layer.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
OpenRouter provides access to many models (GPT-4, Claude, Gemini, etc.) through a single API. It shows current pricing and model metadata. It supports per-mode model assignment. The provider abstraction layer means we can add direct Anthropic, OpenAI, or other providers later without rewriting the core.

**Consequences:**
- Dependent on OpenRouter availability and pricing
- Users need an OpenRouter API key
- Provider abstraction adds a small layer of indirection (worth it for future flexibility)

---

## Decision 6 — DevOps Templates: Standard + Albert

**Date:** 2026-04-11
**Decision:** Ship two starter DevOps templates: Standard (feature branch workflow) and Albert (push-to-main → GitHub Actions → GHCR → Coolify).
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
Albert's specific workflow (push directly to main, GitHub Actions builds Docker image, pushes to GHCR, triggers Coolify via API) is the primary use case. The Standard template covers a more conventional branching workflow. Both are editable and duplicable.

**Consequences:**
- Albert template assumes: GitHub repo, GitHub Actions, GHCR access, Coolify instance with API access
- Standard template is more general but less opinionated
- Both templates are documented in [`docs/devops-templates.md`](devops-templates.md)

---

## Decision 7 — Monorepo Structure: pnpm Workspaces

**Date:** 2026-04-11
**Decision:** Use pnpm workspaces for the monorepo with apps/desktop and packages/*.
**Decided by:** Orchestrator

**Why this was chosen:**
pnpm workspaces are fast, well-supported, and work well with TypeScript monorepos. The structure keeps the Electron app and shared packages cleanly separated. Each package has a clear purpose and can be tested independently.

**Consequences:**
- Requires pnpm (not npm or yarn)
- Package linking is handled by pnpm workspaces
- Builder must use pnpm for all package management

---

## Decision 8 — exFAT Workaround: Vite resolveId Plugin + TS Paths Instead of workspace:* Symlinks

**Date:** 2026-04-11 (updated 2026-04-11)
**Decision:** On the current dev machine, the D: drive is exFAT which does not support symlinks. pnpm `workspace:*` dependencies fail with `EISDIR`. We use a **Vite plugin with `resolveId` hook** and TypeScript `paths` to resolve `@vibeflow/*` imports to source files without symlinks.
**Decided by:** Architect

**Alternatives considered:**
1. Move repo to an NTFS drive — not practical right now
2. Use npm workspaces — also fails with symlinks on exFAT
3. Flatten all code into `apps/desktop` — works but loses monorepo structure
4. Vite `resolve.alias` — **FAILED**: electron-vite's SSR mode resolves bare specifiers through Node before aliases
5. **Vite plugin with `resolveId` hook + TS paths** ← CHOSEN

**Why this was chosen:**
`resolve.alias` does not work for electron-vite's main/preload builds because electron-vite sets `config.build.ssr = true` and `config.ssr.noExternal = true`. In SSR mode, Vite resolves bare specifiers (like `@vibeflow/storage`) through Node's module resolution before applying aliases. A Vite plugin's `resolveId` hook with `enforce: 'pre'` runs at the earliest stage of resolution, before any node_modules lookup, guaranteeing interception.

Preserves the monorepo package structure. The plugin resolves `@vibeflow/*` at bundle time. TypeScript `paths` resolve them at typecheck time. No symlinks needed. The `.npmrc` file sets `node-linker=hoisted` so pnpm uses flat `node_modules` instead of symlinked `.pnpm` store.

**Consequences:**
- No `package.json` can declare `workspace:*` dependencies
- Cross-package imports are resolved by a custom Vite plugin (not Node.js module resolution)
- `packages/storage` inlines its own `Project` type instead of importing from `@vibeflow/shared-types`
- When the repo moves to NTFS, we can switch back to standard `workspace:*` deps and remove the plugin

**See also:** [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry "No workspace:* on exFAT"

---

## Decision 9 — Move from better-sqlite3 to sql.js

**Date:** 2026-04-12
**Decision:** Replace `better-sqlite3` (native C++ bindings) with `sql.js` (pure JavaScript SQLite compiled from C via Emscripten) for the local database.
**Decided by:** Builder (escalated from repeated build failures)

**Alternatives considered:**
1. Fix `better-sqlite3` native compilation — **FAILED repeatedly**: the native bindings could not be built or loaded on Albert's machine. Multiple attempts with `node-gyp rebuild`, `electron-rebuild`, and manual binary downloads all failed with various errors (missing Visual Studio build tools, ABI mismatch, NAPI version conflicts).
2. Use a different native SQLite library (e.g., `better-sqlite3` prebuilt binaries) — not reliably available for the exact Electron + Node.js version combination.
3. **Use `sql.js` (pure JavaScript)** ← CHOSEN
4. Use IndexedDB or LevelDB — would require rewriting all SQL queries.

**Why this was chosen:**
`sql.js` is a pure JavaScript implementation of SQLite compiled from the official C source via Emscripten. It requires **zero native compilation** — no `node-gyp`, no Visual Studio, no platform-specific binaries. It works identically on every platform. The API is different from `better-sqlite3` (it uses `db.exec()` and `db.run()` instead of `db.prepare().get()`), so the database layer had to be rewritten, but the SQL schema and queries remained the same.

**Consequences:**
- No native compilation issues — works on any machine with Node.js
- Slightly slower than `better-sqlite3` for large datasets (JavaScript vs. native C++)
- Database is loaded into memory and periodically flushed to disk (vs. `better-sqlite3` which operates directly on the file)
- The `sql.js` API is less ergonomic than `better-sqlite3` — results come as arrays of arrays instead of objects
- A custom type declaration file [`sql-js.d.ts`](../apps/desktop/src/lib/storage/sql-js.d.ts) was needed because `@types/sql.js` doesn't exist
- The `local-db.ts` file was rewritten to use `sql.js` API patterns

**Impact on sync:**
This decision contributed to sync being disabled. The database layer change was significant enough that re-enabling sync required careful testing. Sync was disabled as a stability measure during the transition.

---

## Decision 10 — Temporary Sync Disablement

**Date:** 2026-04-12
**Decision:** Disable cloud sync in the main process. The app operates in local-only mode. The sync status indicator shows 🔴 Offline.
**Decided by:** Builder + Orchestrator

**Alternatives considered:**
1. Keep sync enabled and debug issues live — too risky, could cause data loss
2. **Disable sync entirely and stabilize the app first** ← CHOSEN
3. Implement a partial sync (projects only, not conversations) — added complexity for unclear benefit

**Why this was chosen:**
Multiple issues converged:
1. `better-sqlite3` could not be built, requiring migration to `sql.js`
2. The Supabase migration SQL (`docs/supabase-migration-m4.sql`) had not been run on the Supabase instance
3. The sync engine was written against `better-sqlite3` API patterns and needed adaptation for `sql.js`
4. Enabling sync with an unverified database layer risked data corruption or loss

Disabling sync was the safest path to a working app. The sync engine code ([`sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts), 501 lines) is fully implemented and preserved — it just isn't called.

**How sync is disabled:**
- [`initSyncEngine()`](../apps/desktop/src/main/index.ts:94) is a no-op that logs a message and sends `'offline'` status
- All sync IPC handlers (`sync:syncAll`, `sync:acquireLease`, etc.) return stub values
- The `before-quit` handler skips `syncEngine.stop()` because syncEngine is null

**Consequences:**
- App works fully in local-only mode
- No multi-device sync
- Sync indicator always shows 🔴 Offline
- All data is stored in a local SQLite file only — if the file is lost, data is lost
- Re-enabling sync requires: running the Supabase migration, adapting the sync engine for sql.js, and testing with two devices

**UPDATE 2026-04-18:** Sync re-enabled. See Decision 16.

---

## Decision 11 — GitHub OAuth: Localhost Callback with Implicit Flow Support

**Date:** 2026-04-12
**Decision:** Use a temporary localhost HTTP server on port 54321 for GitHub OAuth callback, supporting both PKCE code flow and Supabase implicit flow (hash fragment).
**Decided by:** Builder (after debugging sign-in failure)

**Alternatives considered:**
1. Custom URL scheme (`vibeflow://auth/callback`) — more "proper" but requires protocol registration in electron-builder and Supabase configuration. Deferred to a future milestone.
2. **Localhost HTTP server with dual-flow support** ← CHOSEN

**Why this was chosen:**
The original implementation only handled PKCE code flow (`?code=...` query parameter). When Albert tested sign-in, it failed with "No auth code received" because Supabase was returning tokens via the implicit flow — as a hash fragment (`#access_token=...&refresh_token=...`).

Hash fragments are **not sent to the server by browsers** (they stay client-side). The fix was to serve an HTML page with JavaScript that:
1. Extracts the hash fragment on the client side
2. POSTs the tokens to a `/callback-tokens` endpoint on the same localhost server
3. The server receives the tokens and calls `supabase.auth.setSession()` to establish the session

The handler now supports both flows:
- **PKCE flow:** `?code=` query param → `exchangeCodeForSession()`
- **Implicit flow:** no code → serve HTML → JS extracts hash → POST tokens → `setSession()`

**Consequences:**
- Port 54321 must be available on the local machine
- The redirect URL `http://127.0.0.1:54321/callback` must be configured in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
- If the port is changed, both the code and Supabase config must be updated
- A custom URL scheme is the better long-term solution

---

## Decision 12 — DevTools No Longer Auto-Open

**Date:** 2026-04-13
**Decision:** Remove the `mainWindow.webContents.openDevTools()` call from the development startup path.
**Decided by:** Builder

**Alternatives considered:**
1. Keep DevTools auto-opening in development — annoying, takes focus away from the app
2. **Remove the auto-open call** ← CHOSEN
3. Add a keyboard shortcut to toggle DevTools — could be added later

**Why this was chosen:**
During development, the Chromium DevTools were auto-opening every time the app launched, which was disruptive. The DevTools can still be opened manually via `Ctrl+Shift+I` or the Electron menu. Removing the auto-open makes the development experience cleaner.

**Consequences:**
- DevTools no longer open automatically on startup
- Developers must manually open DevTools when needed (`Ctrl+Shift+I`)
- No impact on production builds (DevTools were already disabled in production)

---

## Decision 13 — OpenRouter Models Must Use /api/v1/models/user

**Date:** 2026-04-12
**Decision:** The OpenRouter model list and test connection endpoints must use `https://openrouter.ai/api/v1/models/user` instead of `https://openrouter.ai/api/v1/models`.
**Decided by:** Builder (after debugging model list issue)

**Alternatives considered:**
1. Use `/api/v1/models` (the general catalog) and filter client-side — returns 349+ models, overwhelming and includes models the user can't access
2. **Use `/api/v1/models/user`** ← CHOSEN — returns only models the user has access to (~31 models for a typical account)

**Why this was chosen:**
The original implementation used `/api/v1/models` which returned the full OpenRouter model catalog (349+ models). This was:
- Overwhelming in the model picker UI
- Included models the user didn't have access to
- Slow to load and render

The `/api/v1/models/user` endpoint returns only models the user's API key has access to, which is typically ~31 models. This is much more manageable and accurate.

**Consequences:**
- Model list is smaller and more relevant
- Requires a valid API key to fetch models (the general catalog doesn't require auth)
- If OpenRouter changes this endpoint, the model list will break
- Both `openrouter:listModels` and `openrouter:testConnection` handlers use this endpoint

**Files changed:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) (lines 514, 536)

---

## Decision 14 — Brownfield Rebuild Planning: Implementation Order, Salvage Map, and Current State Assessment

**Date:** 2026-04-14
**Decision:** Adopt the fixed 13-component implementation order (10, 22, 12, 14, 11, 13, 19, 15, 16, 18, 17, 21, 20) with a Phase 0 stabilization prerequisite. Classify 86% of existing modules as keep/adapt (not replace). Begin with Component 10 (Product Shell) after Phase 0.
**Decided by:** Architect (`anthropic/claude-opus-4.6`)

**Key findings:**
- The existing codebase (~6,000 lines across ~43 source files) is a genuine strategic asset
- Only 2 modules require replacement: `orchestrator.ts` (87 lines, too simple for target design) and `docs/what-is-left.md` (superseded by rebuild plan)
- 18 modules keep as-is, 14 keep with adapter, 12 refactor in place, 2 extract into boundary
- 7 of 11 master spec domain objects do not exist yet (Mission, Plan, ContextPack, Capability, ChangeSet, EvidenceItem, Incident)
- Cloud sync is disabled but fully implemented — high-value salvage asset
- Zero automated tests — must be established in Phase 0

**Alternatives considered:**
1. Greenfield rewrite — rejected per brownfield mandate in [`rebuild/01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md`](../rebuild/01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md)
2. Different component order — rejected; the fixed order is constitutional per master spec §15
3. Skip Phase 0 stabilization — rejected; the monolithic main process and lack of tests make brownfield evolution unsafe

**Consequences:**
- Phase 0 must complete before Component 10 begins
- Every component implementation requires a salvage audit and reuse matrix before coding
- The `orchestrator.ts` replacement must preserve IPC channel interfaces
- The app must remain launchable throughout the rebuild

**Files created:**
- [`rebuild/04_PROJECT_IMPLEMENTATION_PLAN.md`](../rebuild/04_PROJECT_IMPLEMENTATION_PLAN.md)
- [`rebuild/05_REPO_SALVAGE_MAP.md`](../rebuild/05_REPO_SALVAGE_MAP.md)
- [`rebuild/06_CURRENT_PROGRAM_STATE.md`](../rebuild/06_CURRENT_PROGRAM_STATE.md)

---

## Decision 15 — Component 10 Post-Implementation Audit: Cleanup Pass Required Before Component 22

**Date:** 2026-04-14
**Decision:** Component 10 (Product Shell) is implemented but requires a short cleanup pass before Component 22 (Sync) begins. Three residual issues must be resolved first: duplicated chrome in the legacy fallback path, partially wired persistent UI state, and incomplete conversation integration into the mission workspace.
**Decided by:** Architect (`anthropic/claude-opus-4.6`), based on Orchestrator post-implementation audit findings

**Key findings:**
- Component 10 delivered: left rail (8 sections), project header, 9-panel collapsible workspace, evidence rail, additive shell domain types, placeholder panels, error boundary, useUiState hook
- The work broadly respected reuse and stayed in scope
- DevOps A-to-Z surfaces exist as placeholders (acceptable for C10)
- Three residual issues identified:
  1. [`App.tsx`](../apps/desktop/src/renderer/App.tsx) renders [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) inside the new shell for non-mission sections, but ProjectScreen still renders its own TopBar (line 50) and BottomBar (line 204), causing doubled chrome
  2. [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) exists but [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) and [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) keep collapse state in local useState instead of using it
  3. The mission workspace is scaffolded but the conversation experience is still reached only through the legacy fallback path, not integrated into the mission panels

**Alternatives considered:**
1. **Proceed directly to Component 22 and fix later** — rejected; the duplicated chrome is a visible bug and the disconnected navigation models will compound when sync is added
2. **Require cleanup pass before Component 22** ← CHOSEN
3. **Revert Component 10 and redo** — rejected; the scaffolding is sound, only wiring is incomplete

**Consequences:**
- A small Builder task (3 files, no new IPC, no new dependencies) must complete before Component 22
- Phase 0 stabilization tasks remain outstanding and should be addressed in parallel or immediately after cleanup
- The codebase now has ~59 source files and ~7,250 lines (up from ~43 files and ~6,000 lines pre-C10)

**Files updated:**
- [`rebuild/04_PROJECT_IMPLEMENTATION_PLAN.md`](../rebuild/04_PROJECT_IMPLEMENTATION_PLAN.md) (v1.0 → v1.1)
- [`rebuild/06_CURRENT_PROGRAM_STATE.md`](../rebuild/06_CURRENT_PROGRAM_STATE.md) (v1.0 → v1.1)


---

## Decision 16 — Cloud Sync Re-Enabled

**Date:** 2026-04-18
**Decision:** Re-enable cloud sync. `initSyncEngine()` is now a real implementation. The SyncEngine constructor now accepts an already-authenticated `SupabaseClient` (not raw credentials) so RLS policies work correctly.
**Decided by:** Builder + Orchestrator

**What was done:**
1. Ran all Supabase migration SQL on the live Supabase instance — all 6 original tables plus ~15 brownfield tables created and verified
2. Created the `handoffs` Supabase Storage bucket with 4 RLS policies
3. Applied the M4 hotfix RLS: `conversation_leases` policy updated with WITH CHECK clause
4. Added the `ensure-remote` race-condition guard in `SyncEngine.acquireLease()` — calls `pushConversation()` before attempting lease insert to satisfy FK constraint
5. Changed `SyncEngine` constructor to accept an authenticated `SupabaseClient` instead of raw URL + anon key
6. Re-implemented `initSyncEngine()` to create and start the SyncEngine with the authenticated client
7. Updated `before-quit` handler to call `syncEngine.stop()`
8. Removed all stub sync IPC handlers

**Consequences:**
- App now syncs to Supabase on startup
- The sync indicator shows 🟢 Synced (or 🟡 Syncing briefly) instead of 🔴 Offline
- The `ensure-remote` guard is load-bearing — do NOT remove it (see idiosyncrasies #11)
- Two-device validation has not been done yet — this is still a pending test

---

## Decision 17 — Default Branch Renamed master → main

**Date:** 2026-04-18
**Decision:** Rename the default git branch from `master` to `main`.
**Decided by:** DevOps

**What was done:**
1. `.github/workflows/build.yml` and `ci.yml` updated to use `main` in branch refs
2. GitHub default branch renamed to `main`
3. Local tracking branch updated
4. Historical `CURRENT_TASK.md` entries referencing `master` are intentionally preserved as historical record

**Consequences:**
- All new branches should be based on `main`, not `master`
- Any CI/CD references to `master` are now broken; update to `main`
- Old `master` entries in `CURRENT_TASK.md` are historical only — do not update them

---

## Decision 18 — Brownfield Rebuild Components 10–22 Completed

**Date:** 2026-04-14 to 2026-04-18
**Decision:** Execute the fixed 13-component implementation order. All 13 components (10, 22, 12, 14, 11, 13, 19, 15, 16, 18, 17, 21, 20) completed.
**Decided by:** Architect + Builder

**What was added:**
- ~21 new SQLite tables
- 100+ new IPC handlers
- 14 panel components (`MissionPanel` through `MigrationPanel`)
- 2 new screens (`McpScreen`, plus enhanced `ProjectScreen`)
- OrchestrationEngine with role routing
- Capability fabric (capability-registry, capability-adapter)
- MCP management (connection-manager, tool-registry, tool-executor)
- Project intelligence (context-pack-assembler, framework-detector, indexing)
- Change engine (change-engine, checkpoint-manager, patch-applier)
- Verification engine (5-level bundles, acceptance-criteria-generator)
- Runtime execution (browser-automation with Playwright stub, evidence capture)
- Environments + deploy workflow tracking + drift detection
- Secrets store + migration safety
- Memory lifecycle + retriever
- Observability (watch-engine, anomaly-detector, self-healing-engine)
- Persistent audit history (linked to checkpoints for rollback)
- 6-class risk scoring (expanded from 3 tiers)

**Consequences:**
- The codebase is now ~200+ source files and well over 10,000 lines
- `main/index.ts` has grown to ~2,441 lines — splitting into domain handler files is the next refactor priority
- The rebuild spec in `rebuild/` remains the binding design source of truth
- The `capabilities` table has dual schema (old columns + new columns) pending back-fill migration (see idiosyncrasies #14)

---

## Decision 19 — Handoff Path Packaging Fix

**Date:** 2026-04-17
**Decision:** Fix the handoff system's path to `docs/idiosyncrasies.md` so it works in both dev mode and packaged builds.
**Decided by:** Builder

**What was done:**
1. Added `app.isPackaged` guard to the handoff IPC handlers
2. In dev mode: use the repo-relative path (same as before)
3. In packaged builds: use `process.resourcesPath` + `/docs/idiosyncrasies.md`
4. Added `docs/idiosyncrasies.md` to `extraResources` in `electron-builder.yml`

**Consequences:**
- Handoff generation now works correctly in both dev and packaged builds
- The relative path hack (`../../../../docs/idiosyncrasies.md`) is still present for dev mode — this is correct behavior

---

## Decision 20 — getCurrentUserId() Required at All User-Scoped Read Sites

**Date:** 2026-04-17
**Decision:** All calls to user-scoped database methods (`listProjects`, `listConversations`, etc.) must pass the result of `getCurrentUserId()` as the user ID. Passing `''` (empty string) is a silent data loss bug.
**Decided by:** Builder (after debugging "projects list is always empty")

**Why:**
The sql.js `WHERE user_id = ?` clause with an empty string returns zero rows without an error. Two separate bugs of this shape were found on 2026-04-17: one in the project list on startup, one in a conversation fetch. The fix is to always call `getCurrentUserId()` and never pass a literal empty string.

**Consequences:**
- All existing call sites have been fixed
- Any future call site that passes `''` will silently return empty results — there is no compile-time protection
- The rule is enforced only by convention and idiosyncrasies #17

