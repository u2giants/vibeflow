# VibeFlow — Handoff Document

Last updated: 2026-04-14
Written by: Architect (Documentation Hardening Sprint)

This is the single best file for a new developer or AI session to read to understand where VibeFlow is and what to do next.

---

## What Is VibeFlow?

VibeFlow is a Windows desktop Electron app that lets non-programmers build and maintain software using AI. The user talks to an AI Orchestrator, which delegates work to specialist Modes (Architect, Coder, Debugger, DevOps, Reviewer). The app has a 5-panel layout showing conversation, code, terminal, execution stream, and status — all at once.

**Tech stack:** Electron + TypeScript + React + Vite + Supabase + OpenRouter + sql.js + keytar

**Repo:** `d:/repos/vibeflow` (on an exFAT drive — this matters, see idiosyncrasies)

---

## Current State of the App (2026-04-14)

**All 10 MVP milestones are complete.** The app launches, you can sign in with GitHub, create projects, chat with the AI, manage Modes, deploy via DevOps, and generate handoffs.

**However, there are significant caveats:**

| Area | State |
|---|---|
| App launches via `pnpm dev` | ✅ Works |
| GitHub OAuth sign-in | ✅ Works (dual-flow: PKCE + implicit) |
| Project CRUD | ✅ Works |
| Conversation + AI streaming | ✅ Works |
| Mode system (6 Modes, soul editor, model picker) | ✅ Works |
| OpenRouter integration | ✅ Works (user-scoped models) |
| File viewer + diff viewer | ✅ Works |
| Terminal (streaming output) | ✅ Works |
| Git status/commit/push | ✅ Works |
| SSH discovery + connection testing | ✅ Works |
| DevOps templates + Coolify deploy | ✅ Works |
| Three-tier approval system | ✅ Works |
| Handoff generation | ✅ Works |
| Build metadata in top bar | ✅ Works |
| Self-maintenance mode | ✅ Works |
| **Cloud sync** | **🔴 Disabled** |
| **Packaged installer** | **⚠️ Not tested** |
| **Auto-update** | **⚠️ Not tested with real release** |
| **Multi-Mode orchestration** | **⚠️ Basic (single-Mode only)** |

---

## What Was Finished, Milestone by Milestone

| # | Milestone | Sprint | Key Deliverable |
|---|---|---|---|
| 1 | Electron Shell + Auth + Projects | 2 | App launches, GitHub OAuth, project list, local SQLite |
| 2 | Mode System + OpenRouter | 3 | 6 Modes, soul editor, model picker, API key in keytar |
| 3 | Conversation UI + Orchestrator | 4 | 5-panel layout, chat, streaming AI responses, conversation history |
| 4 | Cloud Sync + Realtime + Device Ownership | 5 | Sync engine implemented (but later disabled), lease/heartbeat model |
| 5 | Local Tooling | 6 | File, terminal, git, SSH services + right panel + bottom panel |
| 6 | DevOps Subsystem | 7 | Templates, GitHub Actions, Coolify, health checks, DevOps screen |
| 7 | Approval System | 8 | Three-tier approval, second-model review, approval cards |
| 8 | Handoff System | 9 | One-click handoff, copy-to-clipboard, Supabase Storage |
| 9 | Build Metadata + Auto-Update | 10 | Metadata injection, UpdateBanner, electron-updater |
| 10 | Self-Maintenance Mode | 13 | Self-maintenance project, Tier 3 forced, yellow banner |

---

## Major Bugs Hit and How They Were Solved

### 1. better-sqlite3 native compilation failure
- **Problem:** `better-sqlite3` requires native C++ compilation via `node-gyp`. On Albert's machine, this repeatedly failed (missing Visual Studio build tools, ABI mismatch, NAPI version conflicts).
- **Solution:** Replaced with `sql.js` — a pure JavaScript SQLite implementation. Zero native compilation needed. Required rewriting the entire database layer (`local-db.ts`) to use sql.js API patterns.
- **Impact:** Sync was disabled as a stability measure during the transition.

### 2. GitHub OAuth "No auth code received"
- **Problem:** The original OAuth handler only checked for PKCE code flow (`?code=` query parameter). Supabase was returning tokens via implicit flow as a hash fragment (`#access_token=...`), which browsers don't send to servers.
- **Solution:** Added dual-flow support. The callback handler now serves an HTML page with JavaScript that extracts the hash fragment client-side, then POSTs the tokens to a `/callback-tokens` endpoint on the localhost server.
- **File:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) — auth handler

### 3. ELECTRON_RUN_AS_NODE environment variable
- **Problem:** A pre-existing `ELECTRON_RUN_AS_NODE=1` environment variable on Albert's machine caused Electron to run as plain Node.js, crashing on `app.whenReady()`.
- **Solution:** Unset the environment variable. Documented in idiosyncrasies.

### 4. OpenRouter returning 349+ models
- **Problem:** The model list endpoint `/api/v1/models` returned the full OpenRouter catalog, overwhelming the UI.
- **Solution:** Changed to `/api/v1/models/user` which returns only user-accessible models (~31).
- **File:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) — lines ~514, ~536

### 5. Streaming token duplication (listener stacking)
- **Problem:** `ipcRenderer.on()` in the preload script accumulated listeners on re-render, causing each token to be appended N times (producing `7a7a7a7a...`).
- **Solution:** Added `ipcRenderer.removeAllListeners()` before each `ipcRenderer.on()` call.
- **File:** [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts) — lines ~52–65

### 6. Modes screen layout bugs (Sprints 15–18)
- **Problem:** Nested flex children with `min-height: auto` caused overflow, pushing the bottom bar off-screen. Default browser margin on `body` caused `100vh` to overflow.
- **Solution:** Added global CSS reset (`html, body, #root { margin: 0; height: 100%; overflow: hidden }`), replaced `100vh` with `100%`, added `minHeight: 0` to flex children.
- **Files:** `index.html`, `App.tsx`, `ModesScreen.tsx`, `ProjectScreen.tsx`

### 7. DevTools auto-opening
- **Problem:** Chromium DevTools auto-opened on every app launch, disrupting the UI.
- **Solution:** Removed `mainWindow.webContents.openDevTools()` from the development startup path.

---

## What Is Still Left to Do

See [`docs/what-is-left.md`](what-is-left.md) for the full list. The critical items are:

1. **Re-enable cloud sync** — Run Supabase migration, adapt sync engine for sql.js, test with two devices
2. **Test packaged build** — Run `electron-builder`, install on a clean machine, verify everything works
3. **Test auto-update** — Publish a real GitHub Release, verify the update flow
4. **Enhance Orchestrator intelligence** — Multi-Mode routing, task analysis, context management
5. **Fix handoff path for packaged builds** — The relative path to `docs/idiosyncrasies.md` will break

---

## Where the Code Lives

### Main Application

| Component | Path | Lines | Purpose |
|---|---|---|---|
| Main process | [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) | 959 | IPC handler registry, app lifecycle |
| Preload bridge | [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts) | ~120 | window.vibeflow API |
| React app root | [`apps/desktop/src/renderer/App.tsx`](../apps/desktop/src/renderer/App.tsx) | ~110 | Screen routing |
| HTML shell | [`apps/desktop/src/renderer/index.html`](../apps/desktop/src/renderer/index.html) | ~30 | Global CSS reset |

### Screens

| Screen | Path | Purpose |
|---|---|---|
| Sign In | [`SignInScreen.tsx`](../apps/desktop/src/renderer/screens/SignInScreen.tsx) | GitHub OAuth sign-in |
| Project List | [`ProjectListScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectListScreen.tsx) | Create/list projects, self-maintenance button |
| Project | [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) | 5-panel layout, conversation sidebar |
| Conversation | [`ConversationScreen.tsx`](../apps/desktop/src/renderer/screens/ConversationScreen.tsx) | Chat, streaming, execution stream, approval overlay |
| Modes | [`ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx) | Mode editor, soul editor, model picker |
| DevOps | [`DevOpsScreen.tsx`](../apps/desktop/src/renderer/screens/DevOpsScreen.tsx) | 4-tab DevOps management |
| SSH | [`SshScreen.tsx`](../apps/desktop/src/renderer/screens/SshScreen.tsx) | SSH host discovery, connection testing |

### Libraries (in `apps/desktop/src/lib/`)

| Library | Path | Purpose |
|---|---|---|
| Storage | `lib/storage/local-db.ts` | Local SQLite database (sql.js), 489 lines |
| Storage | `lib/storage/supabase-client.ts` | Supabase client wrapper |
| Sync | `lib/sync/sync-engine.ts` | Full sync engine (disabled), 501 lines |
| Orchestrator | `lib/orchestrator/orchestrator.ts` | OpenRouter streaming call |
| Modes | `lib/modes/default-modes.ts` | 6 default Mode definitions |
| Approval | `lib/approval/approval-engine.ts` | Tier classification + second-model review |
| Approval | `lib/approval/approval-logger.ts` | In-memory approval audit log |
| Handoff | `lib/handoff/handoff-generator.ts` | Handoff document + prompt generation |
| Handoff | `lib/handoff/handoff-storage.ts` | Supabase Storage save |
| Tooling | `lib/tooling/file-service.ts` | File read/write/list/diff |
| Tooling | `lib/tooling/terminal-service.ts` | Command execution + streaming |
| Tooling | `lib/tooling/git-service.ts` | Git operations |
| Tooling | `lib/tooling/ssh-service.ts` | SSH discovery + testing |
| DevOps | `lib/devops/devops-templates.ts` | Template definitions |
| DevOps | `lib/devops/github-actions-client.ts` | GitHub Actions API |
| DevOps | `lib/devops/coolify-client.ts` | Coolify API |
| DevOps | `lib/devops/health-check.ts` | URL health monitoring |
| Updater | `lib/updater/auto-updater.ts` | electron-updater wrapper |
| Build Metadata | `lib/build-metadata/index.ts` | Version/commit/date export |
| Types | `lib/shared-types/` | All TypeScript interfaces |

### Configuration

| File | Purpose |
|---|---|
| [`electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts) | Vite config with @vibeflow/* resolveId plugin |
| [`electron-builder.yml`](../apps/desktop/electron-builder.yml) | Packaging config (GitHub Releases) |
| [`tsconfig.json`](../apps/desktop/tsconfig.json) | TypeScript config with @vibeflow/* paths |
| [`.npmrc`](../.npmrc) | `node-linker=hoisted` (no symlinks) |
| [`.env.example`](../.env.example) | Environment variable template |

### Documentation

| File | Purpose |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | AI agent team rules |
| [`PROJECT_SOUL.md`](../PROJECT_SOUL.md) | Product vision and non-negotiables |
| [`CURRENT_TASK.md`](../CURRENT_TASK.md) | Sprint state and history |
| [`docs/product-overview.md`](product-overview.md) | What VibeFlow is |
| [`docs/architecture.md`](architecture.md) | Technical architecture |
| [`docs/decisions.md`](decisions.md) | Decision log with alternatives and tradeoffs |
| [`docs/risks.md`](risks.md) | Current risks |
| [`docs/idiosyncrasies.md`](idiosyncrasies.md) | Intentional weirdness |
| [`docs/what-is-left.md`](what-is-left.md) | Remaining work |
| [`docs/troubleshooting.md`](troubleshooting.md) | Diagnosis and recovery |

---

## Known Weak Spots

1. **`main/index.ts` is 959 lines** — It's the IPC handler registry. Works but could be split into domain-specific handler files.
2. **Sync engine untested** — 501 lines of sync code that has never run against a real Supabase instance with the current sql.js database.
3. **Handoff path breaks in packaged builds** — The relative path `../../../../docs/idiosyncrasies.md` won't resolve correctly when the app is packaged.
4. **No automated tests** — There are no unit tests, integration tests, or E2E tests. The test plan exists (`docs/test-plan.md`) but no tests have been written.
5. **Layout is fragile** — The flex/overflow fixes work but are spread across multiple files and could regress.
6. **Orchestrator is single-Mode** — It calls OpenRouter directly without routing to specialist Modes.
7. **No conversation summarization** — Long conversations will exceed context limits without warning.

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
This runs `inject-build-metadata.js` first, then `electron-vite dev`.

### What You Should See
1. Electron window opens with the sign-in screen
2. Click "Sign in with GitHub" → browser opens → authorize → redirected back to app
3. Project list screen appears with your email in the top bar
4. Sync indicator shows 🔴 Offline (this is expected — sync is disabled)

---

## Exact Files to Read First

If you are a new developer or AI session, read these files in this order:

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

1. **Do NOT add `workspace:*` dependencies** — The repo is on an exFAT drive. Symlinks don't work. See idiosyncrasies entry #3.
2. **Do NOT rename `electron.vite.config.ts`** — electron-vite requires this exact filename. See idiosyncrasies entry #1.
3. **Do NOT remove `removeAllListeners()` from preload** — This prevents the streaming token duplication bug. See idiosyncrasies entry #10.
4. **Do NOT change the OAuth port (54321)** without also updating Supabase Dashboard redirect URLs.
5. **Do NOT use `/api/v1/models`** for OpenRouter — use `/api/v1/models/user` instead.
6. **Sync is disabled on purpose** — Do not try to "fix" the offline indicator without first running the Supabase migration and adapting the sync engine.
7. **The `ELECTRON_RUN_AS_NODE` env var must NOT be set** — Check with `echo %ELECTRON_RUN_AS_NODE%` before debugging startup crashes.
8. **Layout changes are risky** — The flex/overflow fixes are fragile. Test on the Modes screen (most complex layout) after any CSS changes.
