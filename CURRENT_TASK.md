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

## BLOCKERS

**Resolved:** Windows EPERM file lock on `node_modules/electron-vite` — use `pnpm install --ignore-scripts` then manually run `node node_modules/electron/install.js`.

**Resolved:** `ELECTRON_RUN_AS_NODE=1` environment variable was set globally, causing Electron to run as plain Node.js. Removed.

**Known constraint:** D: drive is exFAT — no symlinks. pnpm `workspace:*` deps cannot be used. Workaround: source files from `packages/` are copied into `apps/desktop/src/lib/`. See `docs/idiosyncrasies.md`.

**Pending:** Supabase migration `docs/supabase-migration-m4.sql` must be run before sync features work. Tables: `conversations`, `messages`, `conversation_leases`.

---

## LAST UPDATED

- Date: 2026-04-12
- Updated by: Builder (Milestone 4 implementation complete — Cloud Sync, Real-time, Device Ownership)
- Next update due: After Supabase migration is run and smoke testing passes
