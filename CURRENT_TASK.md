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

## BLOCKERS

**Resolved:** Windows EPERM file lock on `node_modules/electron-vite` — use `pnpm install --ignore-scripts` then manually run `node node_modules/electron/install.js`.

**Resolved:** `ELECTRON_RUN_AS_NODE=1` environment variable was set globally, causing Electron to run as plain Node.js. Removed.

**Known constraint:** D: drive is exFAT — no symlinks. pnpm `workspace:*` deps cannot be used. Workaround: source files from `packages/` are copied into `apps/desktop/src/lib/`. See `docs/idiosyncrasies.md`.

**Pending:** Supabase migration `docs/supabase-migration-m4.sql` must be run before sync features work. Tables: `conversations`, `messages`, `conversation_leases`.

---

## LAST UPDATED

- Date: 2026-04-12
- Updated by: Builder (Milestone 7 implementation complete — Approval System + Second-Model Review)
- Next update due: After Milestone 8 implementation
