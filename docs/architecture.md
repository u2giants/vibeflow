# VibeFlow — Architecture Reference

Last updated: 2026-04-18
Status: Updated to reflect brownfield rebuild Components 10–22 and sync re-enablement

---

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VIBEFLOW DESKTOP APP                         │
│                         (Electron + React)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │  LEFT PANEL  │  │    CENTER PANEL      │  │   RIGHT PANEL     │ │
│  │  Execution   │  │    Conversation      │  │   Editor / Diff   │ │
│  │  Stream      │  │    (Orchestrator)    │  │   File View       │ │
│  └──────────────┘  └──────────────────────┘  └───────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  BOTTOM: Terminal | Logs | Mode | Model | Approval | Git        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ELECTRON MAIN PROCESS                     │  │
│  │  File System | Terminal | Git | SSH | OS Secrets (keytar)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      SYNC CLIENT                             │  │
│  │  Local SQLite Cache ←→ Supabase Realtime + Postgres          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLOUD                              │
│                                                                     │
│  Auth (accounts, sessions, devices)                                 │
│  Postgres (all synced state — 21+ tables)                           │
│  Realtime (live push to all clients)                                │
│  Storage (handoff artifacts)                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ API calls
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          OPENROUTER                                 │
│  AI model routing, multiple models, pricing metadata               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why Electron Was Chosen

VibeFlow needs full access to the local filesystem, terminal, git, SSH, and OS-level secret storage. A web app cannot do this. A VS Code extension would inherit VS Code's assumptions and fight the standalone product vision.

Electron provides:
- **Full Node.js access** in the main process for file I/O, terminal execution, git, SSH
- **Chromium renderer** for a rich React UI
- **Cross-platform packaging** via electron-builder (Windows-first, macOS/Linux possible later)
- **Auto-update** via electron-updater + GitHub Releases
- **OS-secure secret storage** via keytar (Windows Credential Manager)
- **IPC bridge** for secure communication between the sandboxed UI and the privileged main process

The tradeoff is a larger app size (~150MB+ packaged) and Electron's memory overhead. This is acceptable for a desktop IDE product.

---

## Why Supabase Was Chosen

VibeFlow needs cloud sync, authentication, real-time updates, and file storage. Supabase provides all four in one hosted service:

| Need | Supabase Feature |
|---|---|
| User accounts | Supabase Auth (GitHub OAuth) |
| Data sync | Supabase Postgres + Row Level Security |
| Real-time push | Supabase Realtime (Postgres Changes + Broadcast) |
| File storage | Supabase Storage (handoff artifacts) |

**Alternatives considered:** Firebase (vendor lock-in, less SQL-friendly), Railway + custom backend (more moving parts), Cloudflare Workers + D1 (too new, limited Realtime). Supabase won because it minimizes moving parts for a solo builder using AI, and it's open-source and self-hostable if needed later.

**Current state:** Supabase Auth works (GitHub OAuth). All Postgres tables have been created and verified (migration run 2026-04-18). Sync is active and real — the app registers devices, pushes conversations to Supabase, and subscribes to Realtime. The Supabase project ref is `wnbazobqhyhncksjfxvq`.

---

## Why OpenRouter Was Chosen

VibeFlow needs access to multiple AI models (Claude, GPT-4, Gemini, etc.) through a single API. OpenRouter provides:

- **One API key** for access to dozens of models
- **Per-model pricing metadata** (input/output cost per token)
- **Model catalog** with context window sizes
- **User-scoped model list** via `/api/v1/models/user` (returns only models the user has access to)

The provider abstraction layer means other providers (direct Anthropic, OpenAI, etc.) can be added later without rewriting the core.

**Important:** The model list endpoint must use `/api/v1/models/user`, not `/api/v1/models`. The latter returns the full catalog (349+ models). This is documented in idiosyncrasies #8.

---

## Electron Main / Preload / Renderer Split

Electron enforces a security boundary between the main process and the renderer:

### Main Process ([`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts))
- Runs in Node.js with full OS access
- Handles all IPC requests from the renderer
- Manages: file I/O, terminal execution, git operations, SSH, keytar secrets, auto-updater, database
- Creates the BrowserWindow and initializes the local SQLite database on startup
- Seeds default Modes on first run
- **~2,441 lines** — intentionally large; it is an IPC handler registry, not business logic. Business logic lives in `src/lib/`. See [`docs/what-is-left.md`](what-is-left.md) for the planned split.

### Preload Script ([`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts))
- Runs in a special context between main and renderer
- Exposes a typed `window.vibeflow` API to the renderer via `contextBridge`
- Groups API by domain: `auth`, `projects`, `modes`, `openrouter`, `conversations`, `sync`, `files`, `terminal`, `git`, `ssh`, `devops`, `approval`, `handoff`, `buildMetadata`, `updater`, `orchestrator`, `capabilities`, `mcp`, `runtime`, `browser`, `evidence`, `verification`, `acceptance`, `secrets`, `migration`, `deploy`, `environment`, `drift`, `memory`, `skills`, `decisions`, `audit`, `rollback`, `watch`, `anomaly`, `incident`, `selfHealing`, `projectIntelligence`, `contextPacks`

### Renderer Process ([`apps/desktop/src/renderer/`](../apps/desktop/src/renderer/))
- Runs in sandboxed Chromium
- React application with screens and components
- Calls `window.vibeflow.*` for all privileged operations
- No direct Node.js access, no direct file system access

```
Renderer (React)  →  window.vibeflow.*  →  preload/index.ts  →  ipcMain.handle()  →  Main Process
                  ←  ipcRenderer.on()   ←  mainWindow.webContents.send()           ←
```

---

## Mode System Architecture

Modes are the core abstraction for AI specialization in VibeFlow.

### Data Model

Each Mode is stored in the local SQLite `modes` table with these fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | string (UUID) | Unique identifier |
| `slug` | string | URL-safe identifier (e.g., `orchestrator`, `coder`) |
| `name` | string | Display name |
| `description` | string | One-line description |
| `icon` | string | Emoji icon |
| `color` | string | Hex color for UI |
| `soul` | string | Full instructions text (editable by user) |
| `model_id` | string | OpenRouter model ID |
| `fallback_model_id` | string? | Fallback model if primary is unavailable |
| `temperature` | number | Inference temperature |
| `approval_policy` | JSON string | Per-mode approval tier overrides |
| `is_built_in` | boolean | Whether this is a default Mode (cannot be deleted) |

### Default Modes

6 default Modes: Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer. Seeded on first launch from [`default-modes.ts`](../apps/desktop/src/lib/modes/default-modes.ts).

### Orchestration Engine

[`apps/desktop/src/lib/orchestrator/orchestration-engine.ts`](../apps/desktop/src/lib/orchestrator/orchestration-engine.ts) — implements role-based routing, dispatching sub-tasks to specialist Modes based on task type. The legacy `orchestrator.ts` wrapper is still present for backward-compatible IPC channel compatibility.

---

## Sync Architecture

### Current State (as of 2026-04-18)

Cloud sync is **active**. The full sequence was completed:

1. Supabase migration SQL run — all tables created and verified (projects, conversations, messages, conversation_leases, plus 17 tables from Components 10–22)
2. Handoffs storage bucket created with 4 RLS policies
3. `conversation_leases` RLS hotfix applied (WITH CHECK clause + race-condition guard in `acquireLease()`)
4. `SyncEngine` constructor now accepts an already-authenticated `SupabaseClient` (not raw URL + key) — critical for RLS to work
5. `initSyncEngine()` is a real implementation — creates the SyncEngine, starts it, subscribes to Realtime

```
[Device A]                          [Supabase]                    [Device B]
  Local SQLite cache                 Postgres                      Local SQLite cache
       │                                │                                │
       │  write change                  │                                │
       ├──────────────────────────────► │                                │
       │                                │  Realtime push                 │
       │                                ├──────────────────────────────► │
       │                                │                                │  update local cache
```

- **Supabase Postgres** is the canonical cloud source of truth
- **Local SQLite** (sql.js) is the local cache for speed and offline resilience
- **Supabase Realtime** pushes changes to all connected clients
- **Lease/heartbeat model** ensures only one device actively drives a conversation at a time

### Known Gap

Two-device sync has not yet been tested in practice. The implementation is complete; the validation test with two real devices is outstanding. See [`docs/what-is-left.md`](what-is-left.md).

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/sync/sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) | Full sync engine (re-enabled 2026-04-18) |
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) | Local SQLite database (sql.js) |
| [`apps/desktop/src/lib/storage/supabase-client.ts`](../apps/desktop/src/lib/storage/supabase-client.ts) | Supabase client wrapper |
| [`docs/cloud-sync.md`](cloud-sync.md) | Full sync architecture design |

---

## Approval Architecture

The approval system has been extended from 3 tiers (Component 7) to 6 risk classes (Component 19):

### Tier / Risk Classification

| Original Tier | Risk Class | Trigger | Examples |
|---|---|---|---|
| **Tier 1 (Auto)** | informational / low | Safe, read-only actions | `file:read`, `terminal:run` (read-only) |
| **Tier 2 (Second-Model)** | medium | Reversible write actions | `file:write`, `git:commit`, `git:push-branch` |
| **Tier 3 (Human)** | high / destructive / privileged-production | Irreversible or high-risk actions | `file:delete`, `git:push-main`, `deploy:trigger` |

Risk scoring considers: subsystem, environment, data risk, blast radius, reversibility, and evidence completeness.

All approval decisions are now persisted to SQLite audit history (survives app restarts) and linked to checkpoints for rollback recovery.

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/approval/approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) | Tier classification + second-model review + 6-class risk scoring |
| [`apps/desktop/src/lib/approval/audit-store.ts`](../apps/desktop/src/lib/approval/audit-store.ts) | Persistent audit history (SQLite) |
| [`apps/desktop/src/lib/approval/approval-logger.ts`](../apps/desktop/src/lib/approval/approval-logger.ts) | In-memory approval log |
| [`docs/approval-policy.md`](approval-policy.md) | Full approval policy documentation |

---

## Brownfield Rebuild Components (10–22)

The brownfield rebuild added major subsystems. Each component has a binding spec in `rebuild/` and an implementation analysis file.

| Component | Subsystem | Key Files |
|---|---|---|
| **10** | Product Shell | `LeftRail`, `PanelWorkspace`, 14 panels, `useUiState` |
| **11** | Project Intelligence | `project-intelligence/` (context-pack-assembler, framework-detector, impact-analyzer, indexing-pipeline, topology-builder) |
| **12** | Agent Orchestration / Mode System | `orchestrator/orchestration-engine.ts` with role routing |
| **13** | Change Engine / Code Operations | `change-engine/` (change-engine, checkpoint-manager, patch-applier, semantic-grouper, validity-pipeline, workspace-manager, duplicate-detector) |
| **14** | Capability Fabric / MCP | `capability-fabric/`, `mcp-manager/` (connection-manager, tester, health-monitor, tool-executor, tool-registry) |
| **15** | Runtime Execution / Debugging | `runtime-execution/` (browser-automation-service, evidence-capture-engine, runtime-execution-service) |
| **16** | Verification / Acceptance | `verification/` (verification-engine, bundles, acceptance-criteria-generator, flow-runner, test-runner, policy-check-runner, deploy-check-runner) |
| **17** | Environments / Deploy / Service Control | `environment-manager.ts`, `deploy-engine.ts`, `service-control-plane.ts`, `drift-detector.ts` |
| **18** | Secrets / Config / Migration Safety | `secrets/` (secrets-store, migration-safety) |
| **19** | Approval / Risk / Audit / Rollback | `audit-store.ts`, 6-class risk scoring, checkpoint-linked rollback, `AuditPanel` |
| **20** | Memory / Skills / Decision Knowledge | `memory/` (memory-lifecycle, memory-retriever, memory-seed) |
| **21** | Observability / Incident / Self-Healing | `observability/` (watch-engine, anomaly-detector, self-healing-engine) |
| **22** | Sync / Collaboration | Sync re-enablement, `SyncEngine` constructor change, M4 hotfix RLS |

---

## Repository Structure (Actual)

```
vibeflow/
├── apps/desktop/                    ← Electron app
│   ├── electron.vite.config.ts      ← Vite config (MUST be this name, not vite.config.ts)
│   ├── electron-builder.yml         ← Packaging config (GitHub Releases publish)
│   ├── package.json                 ← App dependencies
│   ├── tsconfig.json                ← TypeScript config with @vibeflow/* paths
│   └── src/
│       ├── main/index.ts            ← Main process entry (~2,441 lines, IPC handler registry)
│       ├── preload/index.ts         ← Preload bridge (window.vibeflow API)
│       ├── renderer/                ← React app
│       │   ├── App.tsx              ← Root component, screen routing
│       │   ├── screens/             ← 8 full-page screens
│       │   │   ├── ConversationScreen.tsx
│       │   │   ├── DevOpsScreen.tsx
│       │   │   ├── McpScreen.tsx
│       │   │   ├── ModesScreen.tsx
│       │   │   ├── ProjectListScreen.tsx
│       │   │   ├── ProjectScreen.tsx
│       │   │   ├── SignInScreen.tsx
│       │   │   └── SshScreen.tsx
│       │   └── components/          ← Reusable components + 14 panels
│       │       ├── LeftRail.tsx
│       │       ├── PanelWorkspace.tsx
│       │       ├── TopBar.tsx
│       │       ├── BottomBar.tsx
│       │       ├── ApprovalCard.tsx
│       │       ├── ApprovalQueue.tsx
│       │       ├── HandoffDialog.tsx
│       │       ├── EvidenceRail.tsx
│       │       ├── UpdateBanner.tsx
│       │       └── panels/          ← 14 mission workspace panels
│       │           ├── MissionPanel.tsx
│       │           ├── PlanPanel.tsx
│       │           ├── ContextPanel.tsx
│       │           ├── EvidencePanel.tsx
│       │           ├── ChangePanel.tsx
│       │           ├── VerificationPanel.tsx
│       │           ├── AcceptancePanel.tsx
│       │           ├── AuditPanel.tsx
│       │           ├── EnvironmentPanel.tsx
│       │           ├── SecretsPanel.tsx
│       │           ├── CapabilitiesPanel.tsx
│       │           ├── MemoryPanel.tsx
│       │           ├── WatchPanel.tsx
│       │           └── MigrationPanel.tsx
│       └── lib/                     ← ALL authoritative app library code
│           ├── shared-types/        ← TypeScript interfaces (entities, IPC)
│           ├── storage/             ← LocalDb (sql.js), Supabase client, sql-js.d.ts
│           ├── sync/                ← SyncEngine (active)
│           ├── orchestrator/        ← OrchestrationEngine + orchestrator wrapper
│           ├── modes/               ← Default mode definitions
│           ├── approval/            ← Approval engine, audit store, logger
│           ├── handoff/             ← Handoff generator + Supabase Storage
│           ├── tooling/             ← File, terminal, git, SSH services
│           ├── devops/              ← DevOps templates, GitHub Actions, Coolify, health check
│           ├── updater/             ← Auto-updater wrapper
│           ├── build-metadata/      ← Version/commit/date injection
│           ├── capability-fabric/   ← Capability registry and adapter
│           ├── change-engine/       ← Change engine, checkpoint, patch applier
│           ├── mcp-manager/         ← MCP connections, tool registry, executor
│           ├── memory/              ← Memory lifecycle, retriever, seed
│           ├── observability/       ← Anomaly detector, self-healing, watch
│           ├── project-intelligence/ ← Context packs, framework detector, indexing
│           ├── providers/           ← OpenRouter provider
│           ├── runtime-execution/   ← Browser automation, evidence capture
│           ├── secrets/             ← Secrets store, migration safety
│           ├── verification/        ← Verification engine, acceptance criteria
│           ├── deploy-engine.ts
│           ├── drift-detector.ts
│           ├── environment-manager.ts
│           └── service-control-plane.ts
├── packages/                        ← Canonical sources for 3 packages (NOT used via workspace:*)
│   ├── shared-types/                ← Canonical type definitions
│   ├── storage/                     ← Canonical storage code
│   ├── build-metadata/              ← Canonical build metadata code
│   └── (others: README stubs only)
├── rebuild/                         ← Binding spec files for Components 10–22
├── docs/                            ← All documentation
├── scripts/                         ← Build and dev scripts
├── supabase/                        ← Migration SQL files
└── .github/workflows/               ← CI/CD (ci.yml, release.yml, build.yml)
```

**Important:** Due to the exFAT drive limitation, `packages/*` source files are copied into `apps/desktop/src/lib/` rather than linked via `workspace:*`. The `packages/` directory contains the canonical source for only 3 packages; the app builds from `apps/desktop/src/lib/`. See [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry #3.

---

## Tooling Architecture (Files / Terminal / Git / SSH)

All tool actions run in the Electron main process for security. The renderer never has direct access.

### File Service ([`apps/desktop/src/lib/tooling/file-service.ts`](../apps/desktop/src/lib/tooling/file-service.ts))
- Read, write, list, exists operations
- Diff generation (unified diff format)
- Path traversal protection

### Terminal Service ([`apps/desktop/src/lib/tooling/terminal-service.ts`](../apps/desktop/src/lib/tooling/terminal-service.ts))
- Run commands with streaming output via IPC events
- Kill running processes

### Git Service ([`apps/desktop/src/lib/tooling/git-service.ts`](../apps/desktop/src/lib/tooling/git-service.ts))
- Status, diff, commit, push, log
- Uses the local `git` binary

### SSH Service ([`apps/desktop/src/lib/tooling/ssh-service.ts`](../apps/desktop/src/lib/tooling/ssh-service.ts))
- Discover hosts from `~/.ssh/config`
- Test connections using the local `ssh` binary

---

## Build Metadata Architecture

1. [`scripts/inject-build-metadata.js`](../scripts/inject-build-metadata.js) runs before `pnpm dev` and `pnpm build`
2. Reads version from `apps/desktop/package.json`, commit SHA and date from git, `RELEASE_CHANNEL` from env
3. Writes [`apps/desktop/src/lib/build-metadata/generated.ts`](../apps/desktop/src/lib/build-metadata/generated.ts) (gitignored)
4. [`apps/desktop/src/lib/build-metadata/index.ts`](../apps/desktop/src/lib/build-metadata/index.ts) exports `BUILD_METADATA` with a try/catch fallback

### Auto-Update

- `autoDownload = false` — user decides when to download
- Only runs in packaged builds (`app.isPackaged` check)
- Checks for updates 5 seconds after startup

---

## Security Boundaries

| What | Where It Lives | Notes |
|---|---|---|
| OpenRouter API key | keytar (OS-secure) | Never synced by default |
| SSH private keys | Local `~/.ssh/` | Never synced |
| Supabase anon key | App bundle (`.env` file) | Public, safe to include |
| Supabase service key | Never in desktop app | Server-side only |
| GitHub token (DevOps) | keytar (OS-secure) | Never synced by default |
| Coolify API key | keytar (OS-secure) | Never synced by default |
| Local files | Electron main process only | Renderer cannot access directly |
| Terminal commands | Electron main process only | Renderer cannot execute directly |

---

## Where the App Is Intentionally Simplified Right Now

| Area | Current State | Full Design |
|---|---|---|
| **Cloud sync** | Active but two-device validation not yet done | Full verified multi-device sync |
| **Database** | sql.js (pure JS, in-memory with file persistence) | better-sqlite3 (native, faster) — blocked by native compilation issues |
| **Approval second-model** | Calls OpenRouter for review | Could cache common approval patterns to reduce API calls |
| **Conversation summarization** | Not implemented | Auto-summarize long conversations |
| **Packaged installer** | Not yet tested | Verified NSIS installer on clean machine |
| **main/index.ts split** | ~2,441-line monolith (intentional IPC registry) | Split into domain handler files |
