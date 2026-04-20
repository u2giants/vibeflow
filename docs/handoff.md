# VibeFlow — Handoff Document

Last updated: 2026-04-18
Written by: Architect (updated after brownfield rebuild Components 10–22 and sync re-enablement)

**This is the single best file for a new developer or AI session to read to understand where VibeFlow is and what to do next.**

---

## What Is VibeFlow?

VibeFlow is a Windows desktop Electron app that lets non-programmers build and maintain software using AI. The user talks to an AI Orchestrator, which delegates work to specialist Modes (Architect, Coder, Debugger, DevOps, Reviewer). The app has a 5-panel layout showing conversation, code, terminal, execution stream, and status — all at once.

**Tech stack:** Electron + TypeScript + React + Vite + Supabase + OpenRouter + sql.js + keytar

**Repo:** `d:/repos/vibeflow` (on an exFAT drive — this matters, see idiosyncrasies #3)

**Default branch:** `main`

---

## Current State of the App (2026-04-18)

All 10 MVP milestones are complete. The brownfield rebuild (Components 10–22) is also complete. Cloud sync is re-enabled.

| Area | State |
|---|---|
| App launches via `pnpm dev` | ✅ Works |
| GitHub OAuth sign-in | ✅ Works (dual-flow: PKCE + implicit) |
| Project CRUD (list, create, configure, delete) | ✅ Works |
| Conversation + AI streaming | ✅ Works |
| Mode system (6 Modes, soul editor, model picker) | ✅ Works |
| OpenRouter integration | ✅ Works (user-scoped models) |
| File viewer + diff viewer | ✅ Works |
| Terminal (streaming output) | ✅ Works |
| Git status/commit/push | ✅ Works |
| SSH discovery + connection testing | ✅ Works |
| DevOps templates + Coolify deploy | ✅ Works |
| Three-tier approval system (extended to 6 risk classes) | ✅ Works |
| Handoff generation | ✅ Works |
| Build metadata in top bar | ✅ Works |
| Self-maintenance mode | ✅ Works |
| MCP server connections | ✅ Works (Component 14) |
| Project intelligence / context packs | ✅ Works (Component 11) |
| Orchestration engine with role routing | ✅ Works (Component 12) |
| Change engine + checkpoint manager | ✅ Works (Component 13) |
| Verification + acceptance criteria | ✅ Works (Component 16) |
| Environments + deploy workflow tracking | ✅ Works (Component 17) |
| Secrets / migration safety | ✅ Works (Component 18) |
| Persistent audit history + rollback | ✅ Works (Component 19) |
| Memory / skills / decision knowledge | ✅ Works (Component 20) |
| Observability / self-healing | ✅ Works (Component 21) |
| **Cloud sync** | **✅ Re-enabled 2026-04-18** |
| **IPC handlers split** | **✅ Done 2026-04-18 (handlers/*.ts)** |
| **Domain tables in Supabase** | **✅ Migrated 2026-04-18 (missions, evidence_items, capabilities, incidents, environments)** |
| **Two-device sync validation** | **⚠️ Not yet tested in practice** |
| **Packaged installer** | **⚠️ Not tested on clean machine** |
| **Auto-update** | **⚠️ Not tested with real release** |

---

## What Was Finished, Phase by Phase

### Phase 1 — MVP Milestones (Sprints 2–13)

| # | Milestone | Key Deliverable |
|---|---|---|
| 1 | Electron Shell + Auth + Projects | App launches, GitHub OAuth, project list, local SQLite |
| 2 | Mode System + OpenRouter | 6 Modes, soul editor, model picker, API key in keytar |
| 3 | Conversation UI + Orchestrator | 5-panel layout, chat, streaming AI responses, conversation history |
| 4 | Cloud Sync + Realtime + Device Ownership | Sync engine, lease/heartbeat model |
| 5 | Local Tooling | File, terminal, git, SSH services + right panel + bottom panel |
| 6 | DevOps Subsystem | Templates, GitHub Actions, Coolify, health checks |
| 7 | Approval System | Three-tier approval, second-model review, approval cards |
| 8 | Handoff System | One-click handoff, copy-to-clipboard, Supabase Storage |
| 9 | Build Metadata + Auto-Update | Metadata injection, UpdateBanner, electron-updater |
| 10 | Self-Maintenance Mode | Self-maintenance project, Tier 3 forced, yellow banner |

### Phase 2 — Brownfield Rebuild (Components 10–22, Sprints 14–28+)

| Component | Subsystem Added |
|---|---|
| C10 | Product shell: LeftRail (8 sections), PanelWorkspace (9 collapsible panels), EvidenceRail, useUiState, ErrorBoundary |
| C11 | Project intelligence: context-pack-assembler, framework-detector, impact-analyzer, indexing-pipeline, topology-builder |
| C12 | Agent orchestration: OrchestrationEngine with role routing (replaces simple orchestrator.ts) |
| C13 | Change engine: change-engine, checkpoint-manager, patch-applier, semantic-grouper, validity-pipeline, workspace-manager |
| C14 | Capability fabric + MCP: capability-registry, capability-adapter, mcp-connection-manager, mcp-tool-registry, mcp-tool-executor |
| C15 | Runtime execution: browser-automation-service (Playwright, stubbed if not installed), evidence-capture-engine, runtime-execution-service |
| C16 | Verification + acceptance: verification-engine, 5-level bundles, acceptance-criteria-generator, VerificationPanel, AcceptancePanel |
| C17 | Environments + deploy: environment-manager, deploy-engine, service-control-plane, drift-detector, EnvironmentPanel |
| C18 | Secrets + migration safety: secrets-store, migration-safety, SecretsPanel, MigrationPanel |
| C19 | Approval expansion: 6 risk classes, audit-store (persistent SQLite), checkpoint-linked rollback, AuditPanel |
| C20 | Memory + skills: memory-lifecycle, memory-retriever, memory-seed, MemoryPanel |
| C21 | Observability: watch-engine, anomaly-detector, self-healing-engine, WatchPanel |
| C22 | Sync re-enablement: SyncEngine constructor fix, Supabase migration run, handoffs bucket, RLS hotfix |

---

## Major Bugs Hit and How They Were Solved

### 1. better-sqlite3 native compilation failure
- **Problem:** `node-gyp` native builds failed repeatedly on Albert's machine.
- **Solution:** Replaced with `sql.js` — pure JavaScript SQLite, zero native compilation needed. Entire `local-db.ts` rewritten to use sql.js API. A custom `sql-js.d.ts` type declaration was written.

### 2. GitHub OAuth "No auth code received"
- **Problem:** Supabase returned tokens as a hash fragment (`#access_token=...`), not a `?code=` query param. Browsers don't send hash fragments to servers.
- **Solution:** Dual-flow support. The callback handler serves an HTML page that extracts the hash client-side, then POSTs tokens to `/callback-tokens`. Supports both PKCE and implicit flow.

### 3. ELECTRON_RUN_AS_NODE environment variable
- **Problem:** Pre-existing `ELECTRON_RUN_AS_NODE=1` env var caused Electron to run as plain Node.js, crashing on `app.whenReady()`.
- **Solution:** Unset the env var. See idiosyncrasies #2.

### 4. OpenRouter returning 349+ models
- **Solution:** Changed endpoint from `/api/v1/models` to `/api/v1/models/user`. Returns only user-accessible models (~31). See idiosyncrasies #8.

### 5. Streaming token duplication (listener stacking)
- **Problem:** `ipcRenderer.on()` accumulated listeners on re-render, causing tokens to be repeated N times.
- **Solution:** `ipcRenderer.removeAllListeners()` before each `ipcRenderer.on()` in preload. See idiosyncrasies #10.

### 6. Layout bugs (Sprints 15–18)
- **Problem:** Nested flex children with `min-height: auto` caused overflow; `100vh` + body margin caused overflow.
- **Solution:** Global CSS reset, `height: '100%'` instead of `100vh`, `minHeight: 0` on flex children.

### 7. conversation_leases RLS race condition
- **Problem:** A missing WITH CHECK clause allowed lease-acquire to fail silently under concurrent writes.
- **Solution:** M4 hotfix RLS applied; `acquireLease()` in SyncEngine now has an `ensure-remote` guard (calls `pushConversation` at the top of every lease acquire). See idiosyncrasies #11.

### 8. SQL comments using `//` instead of `--`
- **Problem:** sql.js parses `//` as a division operator, causing `near "/": syntax error` on boot.
- **Solution:** All SQL uses `--` for comments. See idiosyncrasies #16.

### 9. `listProjects('')` returning empty rows
- **Problem:** Accidentally passing empty string as user ID caused WHERE clause to match nothing.
- **Solution:** All `localDb.listProjects(userId)` call sites now pass a real user ID via `getCurrentUserId()`. See idiosyncrasies #17.

### 10. Duplicate IPC handler blocks
- **Problem:** `main/index.ts` had 5 duplicate `secrets:*`/`migration:*` handler blocks (461 lines). App crashed at boot with `Attempted to register a second handler`.
- **Solution:** Removed duplicates. See idiosyncrasies #15.

### 11. `Cannot find module './handlers/state'` runtime crash
- **Problem:** Dynamic `require('./handlers/state')` calls in handler function bodies crashed at runtime. electron-vite/Rollup bundles everything into a single `out/main/index.js` — no `state.js` exists at runtime. TypeScript compiled fine; the crash was only at runtime.
- **Solution:** Replaced all dynamic requires with static ES module imports + the `container` pattern in `handlers/state.ts` (a plain object with getters/setters for all mutable service references). Static imports are resolved at bundle time and always work. See idiosyncrasies #19.

---

## Where the Code Lives

### Main Application Entry Points

| Component | Path | Lines | Purpose |
|---|---|---|---|
| Main process entry | [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) | ~120 | App lifecycle, window creation, register*Handlers() |
| IPC handlers | [`apps/desktop/src/main/handlers/`](../apps/desktop/src/main/handlers/) | ~2,400 total | One file per domain (auth, projects, modes, …) |
| Shared state | [`apps/desktop/src/main/handlers/state.ts`](../apps/desktop/src/main/handlers/state.ts) | ~100 | container object with getters/setters for all mutable service refs |
| Preload bridge | [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts) | ~200+ | window.vibeflow API |
| React app root | [`apps/desktop/src/renderer/App.tsx`](../apps/desktop/src/renderer/App.tsx) | ~150 | Screen routing |

### Screens (8)

| Screen | Purpose |
|---|---|
| `SignInScreen.tsx` | GitHub OAuth sign-in |
| `ProjectListScreen.tsx` | Create/list projects, self-maintenance button |
| `ProjectScreen.tsx` | 5-panel layout, conversation sidebar, mission workspace |
| `ConversationScreen.tsx` | Chat, streaming, execution stream, approval overlay |
| `ModesScreen.tsx` | Mode editor, soul editor, model picker |
| `DevOpsScreen.tsx` | 4-tab DevOps management |
| `SshScreen.tsx` | SSH host discovery, connection testing |
| `McpScreen.tsx` | MCP server connection management |

### Libraries (in `apps/desktop/src/lib/`)

| Library | Purpose |
|---|---|
| `storage/local-db.ts` | Local SQLite database (sql.js) |
| `storage/supabase-client.ts` | Supabase client wrapper |
| `sync/sync-engine.ts` | Full sync engine (active) |
| `orchestrator/orchestration-engine.ts` | OrchestrationEngine with role routing |
| `orchestrator/orchestrator.ts` | Legacy wrapper for IPC compatibility |
| `modes/default-modes.ts` | 6 default Mode definitions |
| `approval/approval-engine.ts` | Tier classification + 6-class risk scoring + second-model review |
| `approval/audit-store.ts` | Persistent approval audit history |
| `handoff/handoff-generator.ts` | Handoff document + prompt generation |
| `handoff/handoff-storage.ts` | Supabase Storage save |
| `tooling/file-service.ts` | File read/write/list/diff |
| `tooling/terminal-service.ts` | Command execution + streaming |
| `tooling/git-service.ts` | Git operations |
| `tooling/ssh-service.ts` | SSH discovery + testing |
| `capability-fabric/capability-registry.ts` | Capability registry |
| `change-engine/change-engine.ts` | Change proposals and application |
| `change-engine/checkpoint-manager.ts` | Checkpoint-linked rollback |
| `mcp-manager/mcp-connection-manager.ts` | MCP connections |
| `mcp-manager/mcp-tool-registry.ts` | Tool listing from MCP servers |
| `memory/memory-lifecycle.ts` | Memory write/read lifecycle |
| `observability/watch-engine.ts` | Post-deploy watching |
| `observability/anomaly-detector.ts` | Anomaly detection |
| `observability/self-healing-engine.ts` | Self-healing actions |
| `project-intelligence/context-pack-assembler.ts` | Context pack assembly |
| `runtime-execution/browser-automation-service.ts` | Playwright-based browser automation (stubbed if not installed) |
| `runtime-execution/evidence-capture-engine.ts` | Test evidence capture |
| `secrets/secrets-store.ts` | Secrets management |
| `secrets/migration-safety.ts` | Database migration safety checks |
| `verification/verification-engine.ts` | Layered verification runs |
| `environment-manager.ts` | Environment + deploy workflow tracking |
| `deploy-engine.ts` | Deploy candidate selection + rollout |
| `drift-detector.ts` | Config/schema drift detection |
| `service-control-plane.ts` | Service dependency view |
| `devops/coolify-client.ts` | Coolify API |
| `devops/github-actions-client.ts` | GitHub Actions API |
| `devops/health-check.ts` | URL health monitoring |
| `updater/auto-updater.ts` | electron-updater wrapper |
| `build-metadata/index.ts` | Version/commit/date export |

---

## What Is Still Left to Do

See [`docs/what-is-left.md`](what-is-left.md) for the full list. The critical items are:

1. **Test packaged build** — Run `electron-builder`, install on a clean machine, verify everything works
2. **Fix .env loading for packaged builds** — The `.env` load path needs `app.isPackaged` guard
3. **Validate two-device sync** — Sync is on and implemented; run the test with two devices
4. **Test auto-update** — Publish a real GitHub Release, verify the update flow
5. **Wire `pnpm test`** — ~90+ scoped `.test.cjs` tests exist but are not yet wired to a test runner

---

## Exact Startup Instructions

### Prerequisites
- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Git installed
- An OpenRouter API key (get one at https://openrouter.ai/)
- A `.env` file in the repo root (copy from `.env.example` and fill in Supabase URL + anon key)

### First-Time Setup
```bash
cd d:/repos/vibeflow
pnpm install --ignore-scripts
node node_modules/electron/install.js
```

### Run in Development
```bash
pnpm dev
```

### What You Should See
1. Electron window opens with the sign-in screen
2. Click "Sign in with GitHub" → browser opens → authorize → redirected back to app
3. Project list screen appears with your email in the top bar
4. Sync indicator shows 🟢 Synced (or 🟡 Syncing briefly) — Offline would indicate a problem

---

## Exact Files to Read First

If you are a new developer or AI session, read these in order:

1. [`AGENTS.md`](../AGENTS.md) — Team structure and rules
2. [`PROJECT_SOUL.md`](../PROJECT_SOUL.md) — Product vision and non-negotiables
3. [`CURRENT_TASK.md`](../CURRENT_TASK.md) — Sprint history and current state
4. **This file** (`docs/handoff.md`) — You're reading it
5. [`docs/idiosyncrasies.md`](idiosyncrasies.md) — Intentional weirdness (read before changing anything)
6. [`docs/architecture.md`](architecture.md) — Technical architecture
7. [`docs/decisions.md`](decisions.md) — Why things are the way they are
8. [`docs/what-is-left.md`](what-is-left.md) — What still needs to be done

---

## Important Warnings

1. **Do NOT add `workspace:*` dependencies** — The repo is on an exFAT drive. Symlinks don't work. See idiosyncrasies #3.
2. **Do NOT rename `electron.vite.config.ts`** — electron-vite requires this exact filename. See idiosyncrasies #1.
3. **Do NOT remove `removeAllListeners()` from preload** — This prevents the streaming token duplication bug. See idiosyncrasies #10.
4. **Do NOT change the OAuth port (54321)** without also updating Supabase Dashboard redirect URLs.
5. **Do NOT use `/api/v1/models`** for OpenRouter — use `/api/v1/models/user` instead. See idiosyncrasies #8.
6. **Do NOT remove the `ensure-remote` guard in `acquireLease()`** — It is a load-bearing race-condition fix. See idiosyncrasies #11.
7. **Do NOT use `//` in SQL strings** — sql.js parses them as division operators. Use `--`. See idiosyncrasies #16.
8. **Always pass a real user ID to `listProjects()`** — Passing `''` returns zero rows silently. See idiosyncrasies #17.
9. **Do NOT register duplicate IPC handlers** — The app will crash at boot with `Attempted to register a second handler`. See idiosyncrasies #15.
10. **The `ELECTRON_RUN_AS_NODE` env var must NOT be set** — See idiosyncrasies #2.
11. **Layout changes are risky** — Test on the Modes screen (most complex layout) after any CSS changes. See idiosyncrasies #6 in risks.md.
12. **`apps/desktop/src/lib/` is authoritative** — Do not look for code in `packages/` (except shared-types, storage, build-metadata).
13. **Do NOT use `require('./state')` inside function bodies in the main process** — Rollup bundles everything into one file; dynamic requires for local modules crash at runtime. Use static imports + the `container` object from `handlers/state.ts`. See idiosyncrasies #19.
