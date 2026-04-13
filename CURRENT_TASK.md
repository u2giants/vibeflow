# CURRENT_TASK.md — VibeFlow Active Sprint State

Every agent must update this file when work begins and when work ends.

---

## CURRENT SPRINT

**Sprint 3 — Milestone 2: Mode System + OpenRouter Provider**

| Step | Description | Status |
|---|---|---|
| | 3.1 | Add Mode and OpenRouterModel types to shared-types/entities.ts | ✅ Done |
| | 3.2 | Add Mode IPC types to shared-types/ipc.ts | ✅ Done |
| | 3.3 | Add modes table + CRUD methods to local-db.ts | ✅ Done |
| | 3.4 | Create default-modes.ts with 6 default modes | ✅ Done |
| | 3.5 | Add Mode IPC handlers to main/index.ts | ✅ Done |
| | 3.6 | Add OpenRouter IPC handlers to main/index.ts (keytar, listModels, testConnection) | ✅ Done |
| | 3.7 | Seed default modes in app.whenReady() | ✅ Done |
| | 3.8 | Update preload/index.ts to expose modes and openrouter APIs | ✅ Done |
| | 3.9 | Create ModesScreen.tsx with soul editor and model picker | ✅ Done |
| | 3.10 | Create BottomBar.tsx showing current Mode and model | ✅ Done |
| | 3.11 | Update App.tsx to add navigation to ModesScreen | ✅ Done |
| | 3.12 | Update ProjectListScreen.tsx to add Modes button | ✅ Done |
| | 3.13 | Smoke test: pnpm dev launches, modes appear, soul saves, API key works | ✅ Done — app launches, all UI renders |

**Bug Fix — OpenRouter model list endpoint (2026-04-12):**
- Changed `openrouter:listModels` and `openrouter:testConnection` from `/api/v1/models` to `/api/v1/models/user`
- Now returns only user-allowed models (~31) instead of all 349+ models
- File changed: `apps/desktop/src/main/index.ts` (lines 514, 536)

**Bug Fix — Auto-open DevTools on startup (2026-04-13):**
- Removed `mainWindow!.webContents.openDevTools()` from the development block in `app.whenReady()`
- App no longer auto-opens Chromium DevTools on startup
- File changed: `apps/desktop/src/main/index.ts` (line 117 removed)

**Current Step:** Milestone 2 complete. Ready for Milestone 3 (Conversation UI + Orchestrator).

---

## COMPLETED SPRINTS

### Sprint 0 — Architecture & Planning (Complete)
- Delivered full planning document to Albert
- Albert approved architecture on 2026-04-11
- Confirmed: Supabase ✅ | OpenRouter ✅ | Coolify ✅ | Second device ✅
- Product name confirmed: VibeFlow
- Architecture approved: Roo-inspired reimplementation + Supabase + Electron + React + Vite + OpenRouter

### Sprint 1 — Repo Scaffold & Documentation (Complete)
- Created AGENTS.md, PROJECT_SOUL.md, CURRENT_TASK.md
- Created all /docs files
- Created package README files
- Created directory scaffold

### Sprint 2 — Milestone 1: Electron Shell + Supabase Auth + Project Scaffold (Complete)
- Electron app launches with sign-in screen
- GitHub OAuth sign-in works (via localhost redirect on port 54321)
- Project list screen renders with create project functionality
- Top bar shows version, commit, sync status, email
- Local SQLite database initialized with projects and modes tables
- 6 default Modes seeded on first run

### Sprint 3 — Milestone 2: Mode System + OpenRouter Provider (Complete)
- Mode system with 6 default Modes (Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer)
- Mode soul editor — edit and persist Mode instructions in local SQLite
- OpenRouter API key management — stored securely in Windows Credential Manager
- Model picker with pricing — assign different AI models to different Modes
- Bottom status bar shows current Mode and assigned model

### Sprint 4 — Milestone 3: Conversation UI + Orchestrator Mode (Complete)
- 5-panel layout: top bar, left execution stream, center chat, right editor placeholder, bottom bar
- ProjectScreen with conversation list sidebar
- ConversationScreen with message list, streaming input, and execution events
- Orchestrator calls OpenRouter with streaming — tokens appear in real time
- Conversation history persists in local SQLite after app restart
- Multiple conversations per project supported
- "← Back to Projects" button returns to project list

---

### Sprint 5 — Milestone 4: Cloud Sync + Real-time + Device Ownership (In Progress)
- Supabase migration SQL created at `docs/supabase-migration-m4.sql` (needs to be run by DevOps/Orchestrator)
- New sync types: `RunState`, `SyncStatus`, `DeviceInfo`, `ConversationLease`
- `ConversationThread` extended with `runState`, `ownerDeviceId`, `ownerDeviceName`, `leaseExpiresAt`
- Local SQLite extended with `settings` table for device ID, conversation run state columns
- Sync engine created: device registration, initial sync, push to Supabase, lease/heartbeat, realtime subscriptions
- Sync IPC handlers added: `getDeviceId`, `registerDevice`, `syncAll`, `acquireLease`, `releaseLease`, `takeoverLease`, `getLease`
- TopBar updated with real sync status indicator (🟢 Synced / 🟡 Syncing / 🔴 Offline)
- ConversationScreen updated with ownership banner, run state badge, recoverable takeover UI
- Preload exposes sync API to renderer

**Current Step:** Milestone 4 implementation complete. Needs Supabase migration to be run before full testing.

---

### Sprint 6 — Milestone 5: Local Tooling (Files, Terminal, Git, SSH) (Complete)
- File service: read, write, list, exists, diff generation with path traversal protection
- Terminal service: run commands with streaming output, kill processes
- Git service: status (branch, staged/unstaged/untracked), diff, commit, push, log
- SSH service: discover hosts from ~/.ssh/config, discover keys, test connections
- Right panel: shows file contents with monospace font, diff view with green/red highlighting
- Bottom panel: Terminal tab (streaming command output) and Git tab (branch + changed files)
- SSH screen: discovered hosts list with test connection buttons, SSH keys list
- All IPC calls typed with ToolingChannel interface
- Every tool action runs in Electron main process for security

**Current Step:** Milestone 5 complete. Ready for Milestone 6 (DevOps Subsystem + Templates).

---

### Sprint 7 — Milestone 6: DevOps Subsystem + Templates (Complete)
- DevOps templates: Standard (feature branch + PR) and Albert (push-to-main) defined with plain-English explanations
- GitHub Actions client: fetches workflow runs from GitHub API with status, branch, commit SHA
- Coolify client: deploy, restart, stop operations via Coolify REST API
- Health check: URL-based health monitoring with response time and status
- DevOps types: ProjectDevOpsConfig and DeployRun added to shared entities
- DevOps IPC: 11 channels (listTemplates, getProjectConfig, saveProjectConfig, setGitHubToken, setCoolifyApiKey, listWorkflowRuns, deploy, restart, stop, healthCheck, listDeployRuns)
- Local SQLite: project_devops_configs and deploy_runs tables with full CRUD
- DevOpsScreen: 4-tab UI (Overview, GitHub Actions, Deploy, Health) with template selector sidebar
- Secrets stored via keytar (Windows Credential Manager) — GitHub token and Coolify API key
- All API calls run in Electron main process via IPC — no keys in renderer
- DevOps button added to ProjectScreen sidebar

**Current Step:** Milestone 6 complete. Ready for Milestone 7 (Approval System + Second-Model Review).

---

### Sprint 8 — Milestone 7: Approval System + Second-Model Review (Complete)
- Three-tier approval system: Tier 1 (auto-allow), Tier 2 (second-model review), Tier 3 (human approval)
- Approval engine: classifies actions into tiers based on ActionType
  - Tier 1 (auto): file:read, terminal:run
  - Tier 2 (second-model review): file:write, git:commit, git:push-branch, ssh:connect
  - Tier 3 (human): file:delete, git:push-main, deploy:trigger, deploy:restart, deploy:stop
- Second-model review: uses google/gemini-flash-1.5 via OpenRouter to review Tier 2 actions
  - Returns approve/escalate_to_human/reject with plain-English reason
  - If approved: action proceeds, logged as "second-model approved"
  - If rejected: requesting Mode is told why
  - If escalated: human sees approval card
- Approval card modal: shows plain-English description, why, affected resources, rollback difficulty, requesting Mode and model
  - Three buttons: Approve, Reject, Ask for more info
- Approval queue indicator in BottomBar: shows pending count and recent approvals
  - Green checkmarks for Tier 1 auto-approvals
  - Blue checkmarks for Tier 2 second-model approvals
  - Yellow badge for pending human approvals
- Approval logger: in-memory log tracking all approval decisions with full provenance
- IPC handlers: approval:requestAction, approval:humanDecision, approval:getQueue, approval:getLog
- ConversationScreen: subscribes to approval:pendingApproval events, shows ApprovalCard overlay
- Execution stream shows approval events (auto-approved, waiting for human approval, approved, rejected)

**Current Step:** Milestone 7 complete. Ready for review.

---

### Sprint 9 — Milestone 8: Handoff System + Idiosyncrasies Tracking (Complete)
- Handoff button (📋) added to conversation panel header (top-right, purple button)
- Handoff form: asks for current goal, next step, and optional warnings
- Handoff generator: pure functions that generate handoff document and prompt
  - `handoff-generator.ts`: `generateHandoffDoc()` and `generateHandoffPrompt()` — no side effects
- Handoff storage: saves documents to Supabase Storage bucket (`handoffs`)
  - `handoff-storage.ts`: `HandoffStorage` class with `saveHandoffDoc()` and `listHandoffs()`
- HandoffDialog: modal dialog showing generated prompt with copy-to-clipboard
  - Copy button with visual feedback ("✅ Copied!")
  - Expandable full handoff document viewer
  - Storage status indicator (✅ Saved to cloud / ⚠️ Storage error)
- IPC handlers: `handoff:generate` and `handoff:getIdiosyncrasies` in main process
- Preload exposes `handoff.generate()` and `handoff.getIdiosyncrasies()` to renderer
- Supabase migration notes in `docs/supabase-migration-m8.sql` (bucket creation instructions)
- Idiosyncrasies tracking: new entry for handoff system reading docs from relative path

**Current Step:** Milestone 8 complete. Ready for Milestone 9.

---

### Sprint 10 — Milestone 9: Build Metadata + Auto-Update (Complete)
- Build metadata injection script rewritten as plain CommonJS (`scripts/inject-build-metadata.js`)
  - Reads version from `apps/desktop/package.json`
  - Gets commit SHA via `git rev-parse --short HEAD`
  - Gets commit date via `git log -1 --format=%ci`
  - Reads `RELEASE_CHANNEL` from environment (default: `dev`)
  - Writes to `apps/desktop/src/lib/build-metadata/generated.ts`
- `build-metadata/index.ts` updated with try/catch fallback — safe if generated.ts doesn't exist yet
- `generated.ts` added to `.gitignore` and removed from git tracking
- Root `package.json` scripts updated: `pnpm dev` and `pnpm build` now run metadata injection first
- `electron-updater` added to `apps/desktop/package.json` dependencies
- Auto-updater module created: `apps/desktop/src/lib/updater/auto-updater.ts`
  - Configured for GitHub Releases publishing
  - `autoDownload = false` — user decides when to download
  - Non-fatal error handling — app never crashes on updater failures
  - Only runs in packaged builds (`app.isPackaged` check)
  - Checks for updates 5 seconds after startup
- Updater IPC handlers added to `main/index.ts`: `updater:downloadUpdate`, `updater:installUpdate`
- Updater API exposed in `preload/index.ts`: downloadUpdate, installUpdate, onUpdateAvailable, onDownloadProgress, onUpdateDownloaded, removeListeners
- Updater types added to `shared-types/ipc.ts`: `UpdaterChannel` interface
- `UpdateBanner.tsx` component created:
  - Shows "Update available: v{version}" with "Install Now" and "Later" buttons
  - Shows download progress bar during download
  - Shows "Update ready — Restart to apply" with "Restart Now" button
  - Non-intrusive banner below TopBar, not a modal
- `TopBar.tsx` updated to show version, commit SHA, and release channel
- `App.tsx` updated to include `UpdateBanner` below `TopBar`
- `electron-builder.yml` updated with GitHub publish config (owner: u2giants, repo: vibeflow)
- `.github/workflows/ci.yml` created: type check on push/PR to master/main
- `.github/workflows/release.yml` created: build and publish on `v*` tags

**Current Step:** Milestone 9 complete. Ready for Milestone 10.

---

### Sprint 13 — Milestone 10: Self-Maintenance Mode (Complete)
- `getSelfMaintenanceProject()` added to `apps/desktop/src/lib/storage/local-db.ts`
- `getConversation()` added to `apps/desktop/src/lib/storage/local-db.ts`
- IPC handlers added to `apps/desktop/src/main/index.ts`: `projects:getSelfMaintenance`, `projects:createSelfMaintenance`, `projects:getVibeFlowRepoPath`
- `apps/desktop/src/preload/index.ts` updated to expose new project methods
- `apps/desktop/src/lib/shared-types/ipc.ts` updated with new `ProjectsChannel` methods and `isSelfMaintenance` on `GenerateHandoffArgs`
- `apps/desktop/src/renderer/screens/ProjectListScreen.tsx` — "🔧 Work on VibeFlow itself →" button added at bottom
- `apps/desktop/src/renderer/screens/ProjectScreen.tsx` — yellow self-maintenance banner + 🔧 prefix on project name
- `apps/desktop/src/renderer/screens/ConversationScreen.tsx` — "🔧 Self-Maintenance" badge in header + warning in execution stream
- `apps/desktop/src/lib/approval/approval-engine.ts` — `classifyAction()` now accepts options with `isSelfMaintenance` flag, forces Tier 3 for file writes/deletes
- `apps/desktop/src/lib/handoff/handoff-generator.ts` — `HandoffContext` now has `isSelfMaintenance` and `vibeFlowRepoPath` fields; handoff doc/prompt labeled for self-maintenance
- `apps/desktop/src/main/index.ts` — approval handler checks if project is self-maintenance and passes flag to `classifyAction()`
- `apps/desktop/src/main/index.ts` — handoff handler passes `isSelfMaintenance` and `vibeFlowRepoPath` to context

**Current Step:** Milestone 10 complete. ALL MILESTONES DONE. MVP is complete.

---

### Sprint 11 — Bug Fix: Runaway Streaming Loop (Listener Stacking) (Complete)
- Root cause: `onStreamToken`, `onStreamDone`, `onStreamError` in `apps/desktop/src/preload/index.ts` used `ipcRenderer.on()` which accumulates listeners
- When `ConversationScreen.tsx` re-renders or switches conversations, new listeners stack up, causing each token to be appended N times (producing `7a7a7a7a...` repeating tokens)
- Fix: added `ipcRenderer.removeAllListeners()` before `ipcRenderer.on()` in all three `onStream*` functions
- This ensures there is never more than one listener per channel at a time
- File changed: `apps/desktop/src/preload/index.ts` (lines 52–65 only)

**Current Step:** Bug fix complete. Ready for review.

---

### Sprint 12 — Bug Fix: GitHub OAuth Sign-in Broken (Complete)
- Root cause: Supabase returns OAuth tokens as hash fragment (`#access_token=...&refresh_token=...`) instead of PKCE code (`?code=...`) in the implicit flow
- The original handler only checked for `?code=` query parameter, resulting in "No auth code received" error
- Fix: refactored `auth:signInWithGitHub` handler in `apps/desktop/src/main/index.ts` to handle BOTH flows:
  - PKCE flow: `?code=` query param → `exchangeCodeForSession()`
  - Implicit flow: no code in query → serve HTML page that extracts hash fragment via JS and POSTs tokens to `/callback-tokens` → `setSession()`
- Additional fix: `ELECTRON_RUN_AS_NODE=1` environment variable was set, causing Electron to run as plain Node.js (pre-existing issue, documented in idiosyncrasies.md)
- Additional fix: `node_modules/electron/path.txt` was missing — created with content `electron.exe`
- Files changed: `apps/desktop/src/main/index.ts` (OAuth handler refactored), `docs/idiosyncrasies.md` (updated OAuth entry with implicit flow detail)

**Current Step:** Bug fix complete. Sign-in tested and working. Ready for review.

---

### Sprint 14 — Bug Fix: OpenRouter Model List Stale / Does Not Refresh (Complete)
- Added `modelsLoading` and `modelsMessage` state to ModesScreen
- Improved `loadModels()` to set loading state before fetch, show success message (`Loaded N models ✅`) or error message (`Failed to load models: ...`)
- Added explicit "Refresh Models" button next to the model picker select box
- Button shows "Refreshing..." text and is disabled while loading
- Saving a new API key now calls `await loadModels()` to auto-refresh the list
- Success/error message displayed below model picker in green/red
- Current model remains visible as first option if not in refreshed list
- File changed: `apps/desktop/src/renderer/screens/ModesScreen.tsx`

**Current Step:** Bug fix complete. Ready for review.

---

### Sprint 15 — Bug Fix: Modes Screen Layout — Vertical Blank Space, Bottom Bar Obscured (Complete)
- Root cause: nested flex children default to `min-height: auto`, preventing them from shrinking and pushing the bottom bar off-screen
- Fix: added `minHeight: 0` and proper `overflow: 'hidden'` / `overflow: 'auto'` on the right containers
- Files changed:
  - `apps/desktop/src/renderer/App.tsx` (line 91): added `minHeight: 0` to the ModesScreen wrapper div
  - `apps/desktop/src/renderer/screens/ModesScreen.tsx` (lines 108, 137, 175): added `minHeight: 0` to root container, two-column content row, and right details panel
- Result: Modes screen fills available space correctly, no page-level vertical scrollbar, bottom bar fully visible, right panel scrolls internally

**Current Step:** Bug fix complete. Ready for review.

---

### Sprint 16 — Bug Fix: Modes Screen Layout — Remaining Overflow (Complete)
- Root cause: left sidebar missing `minWidth` constraint, right panel content not properly constrained in flex column
- Fix: added `minWidth: 240` to left sidebar to prevent shrinkage issues, changed right panel to `display: 'flex', flexDirection: 'column'` for proper internal scrolling
- Files changed:
  - `apps/desktop/src/renderer/screens/ModesScreen.tsx` (line 140): added `minWidth: 240` to left sidebar
  - `apps/desktop/src/renderer/screens/ModesScreen.tsx` (line 175): added `display: 'flex', flexDirection: 'column'` to right details panel
- Result: No page-level vertical scrollbar, bottom bar fully visible, both panels scroll internally

**Current Step:** Bug fix complete. Ready for review.

---

### Sprint 17 — Bug Fix: OpenRouter Model List Endpoint + Refresh Confirmation (Complete)
- Verified `openrouter:listModels` handler uses `https://openrouter.ai/api/v1/models/user` (line 514)
- Verified `openrouter:testConnection` handler uses `https://openrouter.ai/api/v1/models/user` (line 536)
- Model refresh button already shows "Refresh Models" / "Refreshing..." state
- Model count confirmation already displays: `Loaded N models ✅` in green
- Error messages display in red: `Failed to load models: ...`
- Files changed: None (already implemented in Sprint 14)

**Current Step:** Bug fix verified. Ready for review.

---

### Sprint 18 — Bug Fix: Modes Screen Layout — Global Page Sizing / Browser Margin (Complete)
- Root cause: default browser margin on `body` and missing explicit full-height constraints on `html`, `body`, and `#root` caused `100vh` wrappers to overflow, creating a large blank center gap and pushing the bottom bar off-screen
- Fix: added global CSS reset in `index.html` setting `html, body, #root` to `margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden`
- Replaced all `height: '100vh'` with `height: '100%'` in outer wrappers across App.tsx, ProjectScreen.tsx, and ModesScreen.tsx
- Added `overflow: 'hidden'` to App.tsx default branch wrapper and ProjectScreen.tsx outer wrapper
- Added `minHeight: 0` to ProjectScreen.tsx main content area flex child
- Files changed:
  - `apps/desktop/src/renderer/index.html` (lines 7–24): added `<style>` block with html/body/#root reset, body font/background, and box-sizing
  - `apps/desktop/src/renderer/App.tsx` (line 88): changed `height: '100vh'` to `height: '100%'` in modes branch
  - `apps/desktop/src/renderer/App.tsx` (line 100): changed `height: '100vh'` to `height: '100%'` and added `overflow: 'hidden'` in default branch
  - `apps/desktop/src/renderer/screens/ProjectScreen.tsx` (line 49): changed `height: '100vh'` to `height: '100%'` and added `overflow: 'hidden'`
  - `apps/desktop/src/renderer/screens/ProjectScreen.tsx` (line 67): added `minHeight: 0` to main content area
  - `apps/desktop/src/renderer/screens/ModesScreen.tsx` (line 108): changed `flex: 1` to `height: '100%'` on root container
- Result: No page-level vertical scrollbar, bottom bar fully visible, no large blank center gap, left and right panels scroll internally only

**Current Step:** Bug fix complete. Ready for review.

---

## BLOCKERS

**Resolved:** Windows EPERM file lock on `node_modules/electron-vite` — use `pnpm install --ignore-scripts` then manually run `node node_modules/electron/install.js`.

**Resolved:** `ELECTRON_RUN_AS_NODE=1` environment variable was set globally, causing Electron to run as plain Node.js. Removed.

**Known constraint:** D: drive is exFAT — no symlinks. pnpm `workspace:*` deps cannot be used. Workaround: source files from `packages/` are copied into `apps/desktop/src/lib/`. See `docs/idiosyncrasies.md`.

**Pending:** Supabase migration `docs/supabase-migration-m4.sql` must be run before sync features work. Tables: `conversations`, `messages`, `conversation_leases`.

---

## LAST UPDATED

- Date: 2026-04-12
- Updated by: Builder (Milestone 10: Self-Maintenance Mode — ALL MILESTONES COMPLETE)
- Next update due: After next task
