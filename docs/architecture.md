# VibeFlow — Architecture Reference

Last updated: 2026-04-14
Status: Approved by Albert (original 2026-04-11, expanded 2026-04-14)

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
│  Postgres (all synced state)                                        │
│  Realtime (live push to all clients)                                │
│  Storage (large artifacts, handoff docs)                            │
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

**Current state:** Supabase Auth works (GitHub OAuth sign-in). Supabase Postgres tables are defined but the migration has not been run. Sync is disabled in the main process. The app works fully in local-only mode using sql.js.

---

## Why OpenRouter Was Chosen

VibeFlow needs access to multiple AI models (Claude, GPT-4, Gemini, etc.) through a single API. OpenRouter provides:

- **One API key** for access to dozens of models
- **Per-model pricing metadata** (input/output cost per token)
- **Model catalog** with context window sizes
- **User-scoped model list** via `/api/v1/models/user` (returns only models the user has access to)

The provider abstraction layer means other providers (direct Anthropic, OpenAI, etc.) can be added later without rewriting the core.

**Important:** The model list endpoint must use `/api/v1/models/user`, not `/api/v1/models`. The latter returns the full catalog (349+ models), which is overwhelming and includes models the user may not have access to. This was a bug that was fixed in Sprint 14.

---

## Why the App Is Conversation-Centric

Most AI coding tools put the editor first and chat second. VibeFlow inverts this: **conversation is the center of gravity**.

The reasoning:
1. VibeFlow's target user is a non-programmer. They think in terms of "what I want to build," not "which file to edit."
2. The Orchestrator pattern (one AI coordinates multiple specialists) requires a conversation-first interface.
3. The code editor is always visible in the right panel, but the user's primary interaction is talking to the Orchestrator.
4. This matches how non-technical users naturally work with AI — they describe what they want, not how to implement it.

The five-panel layout ensures the code is always visible even though conversation is primary. This is a deliberate design tension: conversation-first but code-always-visible.

---

## Electron Main / Preload / Renderer Split

Electron enforces a security boundary between the main process and the renderer:

### Main Process ([`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts))
- Runs in Node.js with full OS access
- Handles all IPC requests from the renderer
- Manages: file I/O, terminal execution, git operations, SSH, keytar secrets, auto-updater, database
- Creates the BrowserWindow
- Initializes the local SQLite database on startup
- Seeds default Modes on first run
- **959 lines** — the largest single file in the codebase (acceptable because it's the IPC handler registry)

### Preload Script ([`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts))
- Runs in a special context between main and renderer
- Exposes a typed `window.vibeflow` API to the renderer via `contextBridge`
- The renderer can only call methods exposed here — it cannot access Node.js directly
- Groups API by domain: `auth`, `projects`, `modes`, `openrouter`, `conversations`, `sync`, `files`, `terminal`, `git`, `ssh`, `devops`, `approval`, `handoff`, `buildMetadata`, `updater`

### Renderer Process ([`apps/desktop/src/renderer/`](../apps/desktop/src/renderer/))
- Runs in sandboxed Chromium
- React application with screens and components
- Calls `window.vibeflow.*` for all privileged operations
- No direct Node.js access, no direct file system access
- Communicates with main process exclusively through the preload bridge

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
| `model_id` | string | OpenRouter model ID (e.g., `anthropic/claude-3.5-sonnet`) |
| `fallback_model_id` | string? | Fallback model if primary is unavailable |
| `temperature` | number | Inference temperature |
| `approval_policy` | JSON string | Per-mode approval tier overrides |
| `is_built_in` | boolean | Whether this is a default Mode (cannot be deleted) |

### Mode Lifecycle

1. On first launch, 6 default Modes are seeded from [`default-modes.ts`](../apps/desktop/src/lib/modes/default-modes.ts)
2. User can edit any Mode's soul, model assignment, and approval policy via the Modes screen
3. Changes are persisted to local SQLite immediately
4. When sync is re-enabled, Mode changes will sync to Supabase

### Mode Routing (Future)

The Orchestrator is intended to route tasks to specialist Modes based on the task type. Currently, the Orchestrator handles all tasks directly via OpenRouter. Multi-Mode delegation is a future enhancement.

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/modes/default-modes.ts`](../apps/desktop/src/lib/modes/default-modes.ts) | 6 default Mode definitions |
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) | Mode CRUD in SQLite |
| [`apps/desktop/src/renderer/screens/ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx) | Mode editor UI |
| [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) | Mode IPC handlers |

---

## Sync Architecture

### Design

The sync system is designed around a local-first architecture:

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
- **Local SQLite** is the local cache for speed and offline resilience
- **Supabase Realtime** pushes changes to all connected clients
- **Lease/heartbeat model** ensures only one device actively drives a conversation at a time

### Current State

**Sync is intentionally disabled.** The [`initSyncEngine()`](../apps/desktop/src/main/index.ts:94) function in the main process is a no-op that logs a message and sends `'offline'` status to the renderer. All sync IPC handlers return stub values.

This was done because:
1. `better-sqlite3` (the original SQLite library) could not be built on the dev machine due to native binding compilation failures
2. The app was migrated to `sql.js` (pure JavaScript SQLite) which works but required changes to the database layer
3. Sync was disabled to stabilize the app while the database migration was in progress
4. The Supabase migration SQL (`docs/supabase-migration-m4.sql`) has not been run yet

The app works fully in local-only mode. All data is stored in a local SQLite file managed by sql.js.

### Sync Re-enablement Plan

1. Run the Supabase migration SQL to create cloud tables
2. Re-implement `initSyncEngine()` to actually start the SyncEngine
3. Test with two devices
4. Remove the stub IPC handlers

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/sync/sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) | Full sync engine (501 lines, implemented but not called) |
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) | Local SQLite database (489 lines) |
| [`apps/desktop/src/lib/storage/supabase-client.ts`](../apps/desktop/src/lib/storage/supabase-client.ts) | Supabase client wrapper |
| [`docs/supabase-migration-m4.sql`](supabase-migration-m4.sql) | Migration SQL for sync tables |
| [`docs/cloud-sync.md`](cloud-sync.md) | Full sync architecture design |

---

## Approval Architecture

The approval system has three tiers designed to minimize human interruption:

### Tier Classification

| Tier | Trigger | Examples |
|---|---|---|
| **Tier 1 (Auto)** | Safe, read-only actions | `file:read`, `terminal:run` (read-only) |
| **Tier 2 (Second-Model)** | Reversible write actions | `file:write`, `git:commit`, `git:push-branch`, `ssh:connect` |
| **Tier 3 (Human)** | Irreversible or high-risk actions | `file:delete`, `git:push-main`, `deploy:trigger`, `deploy:restart`, `deploy:stop` |

### Second-Model Review

Tier 2 actions are reviewed by a fast, cheap AI model (`google/gemini-flash-1.5` via OpenRouter). The reviewer receives the action description, affected resources, and requesting Mode, then returns `approve`, `escalate_to_human`, or `reject` with a plain-English reason.

### Self-Maintenance Override

When working on VibeFlow's own source code (self-maintenance mode), all file writes and deletes are forced to Tier 3 (human approval) regardless of the normal tier classification.

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/approval/approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) | Tier classification + second-model review |
| [`apps/desktop/src/lib/approval/approval-logger.ts`](../apps/desktop/src/lib/approval/approval-logger.ts) | In-memory approval audit log |
| [`apps/desktop/src/renderer/components/ApprovalCard.tsx`](../apps/desktop/src/renderer/components/ApprovalCard.tsx) | Human approval UI |
| [`apps/desktop/src/renderer/components/ApprovalQueue.tsx`](../apps/desktop/src/renderer/components/ApprovalQueue.tsx) | Approval queue indicator |
| [`docs/approval-policy.md`](approval-policy.md) | Full approval policy documentation |

---

## Tooling Architecture (Files / Terminal / Git / SSH)

All tool actions run in the Electron main process for security. The renderer never has direct access to the filesystem, terminal, or git.

### File Service ([`apps/desktop/src/lib/tooling/file-service.ts`](../apps/desktop/src/lib/tooling/file-service.ts))
- Read, write, list, exists operations
- Diff generation (unified diff format)
- Path traversal protection (prevents reading outside project directory)

### Terminal Service ([`apps/desktop/src/lib/tooling/terminal-service.ts`](../apps/desktop/src/lib/tooling/terminal-service.ts))
- Run commands with streaming output via IPC events
- Kill running processes
- Output streams back to the renderer's bottom panel in real time

### Git Service ([`apps/desktop/src/lib/tooling/git-service.ts`](../apps/desktop/src/lib/tooling/git-service.ts))
- Status: branch, staged, unstaged, untracked files
- Diff: unified diff output
- Commit: stage and commit with message
- Push: push to remote (with branch specification)
- Log: recent commit history
- Uses the local `git` binary (not a JS library)

### SSH Service ([`apps/desktop/src/lib/tooling/ssh-service.ts`](../apps/desktop/src/lib/tooling/ssh-service.ts))
- Discover hosts from `~/.ssh/config`
- Discover SSH keys from `~/.ssh/`
- Test connections (returns success/failure with latency)
- Uses the local `ssh` binary

### IPC Pattern

All tool calls follow the same pattern:
1. Renderer calls `window.vibeflow.files.read(path)` (or similar)
2. Preload forwards to `ipcRenderer.invoke('files:read', path)`
3. Main process handler executes the operation
4. Result returns to renderer via the invoke promise
5. For streaming operations (terminal), main process sends events via `webContents.send()`

---

## DevOps Subsystem Architecture

The DevOps subsystem provides deployment guidance and automation:

### Components

| Component | File | Purpose |
|---|---|---|
| **Templates** | [`devops-templates.ts`](../apps/desktop/src/lib/devops/devops-templates.ts) | Standard and Albert deployment templates |
| **GitHub Actions Client** | [`github-actions-client.ts`](../apps/desktop/src/lib/devops/github-actions-client.ts) | Fetch workflow runs from GitHub API |
| **Coolify Client** | [`coolify-client.ts`](../apps/desktop/src/lib/devops/coolify-client.ts) | Deploy, restart, stop via Coolify REST API |
| **Health Check** | [`health-check.ts`](../apps/desktop/src/lib/devops/health-check.ts) | URL-based health monitoring |
| **DevOps Screen** | [`DevOpsScreen.tsx`](../apps/desktop/src/renderer/screens/DevOpsScreen.tsx) | 4-tab UI (Overview, GitHub Actions, Deploy, Health) |

### Data Storage

- `project_devops_configs` table in local SQLite: stores per-project DevOps configuration
- `deploy_runs` table in local SQLite: stores deploy run history
- GitHub token and Coolify API key stored in keytar (Windows Credential Manager)

### Templates

Two built-in templates:
1. **Standard** — Feature branch → PR → merge to main → GitHub Actions → Docker → GHCR → Coolify
2. **Albert** — Push directly to main → GitHub Actions → Docker → GHCR → Coolify

See [`docs/devops-templates.md`](devops-templates.md) for full details.

---

## Handoff Subsystem Architecture

The handoff system generates complete context packages for fresh AI sessions:

### Components

| Component | File | Purpose |
|---|---|---|
| **Generator** | [`handoff-generator.ts`](../apps/desktop/src/lib/handoff/handoff-generator.ts) | Pure functions: `generateHandoffDoc()` and `generateHandoffPrompt()` |
| **Storage** | [`handoff-storage.ts`](../apps/desktop/src/lib/handoff/handoff-storage.ts) | Save to Supabase Storage bucket (`handoffs`) |
| **Dialog** | [`HandoffDialog.tsx`](../apps/desktop/src/renderer/components/HandoffDialog.tsx) | Modal with copy-to-clipboard and cloud save status |

### Flow

1. User clicks 📋 Handoff button in conversation header
2. User fills in current goal, next step, and optional warnings
3. Main process reads `docs/idiosyncrasies.md` from the repo
4. Generator creates a handoff document and a ready-to-paste prompt
5. Document is saved to Supabase Storage (if available)
6. User copies the prompt and pastes it into a new AI session

### Self-Maintenance Handoff

When generating a handoff for self-maintenance work, the document is labeled "🔧 VibeFlow Self-Maintenance Handoff" and includes the VibeFlow repo path.

---

## Self-Maintenance Architecture

VibeFlow can work on its own source code with extra safety:

### How It Works

1. A special "self-maintenance" project is created with `isSelfMaintenance: true`
2. The project's local path points to the VibeFlow repo root
3. The approval engine checks `isSelfMaintenance` and forces Tier 3 for all file writes/deletes
4. The UI shows a yellow warning banner and 🔧 prefix
5. Handoff documents are labeled for self-maintenance

### Key Files

| File | Purpose |
|---|---|
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) | `getSelfMaintenanceProject()`, `isSelfMaintenance` field |
| [`apps/desktop/src/lib/approval/approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) | `classifyAction()` with `isSelfMaintenance` option |
| [`apps/desktop/src/renderer/screens/ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) | Yellow self-maintenance banner |

---

## Build Metadata Architecture

Build metadata is injected at build time so the top bar always shows real version info:

### Injection Flow

1. [`scripts/inject-build-metadata.js`](../scripts/inject-build-metadata.js) runs before `pnpm dev` and `pnpm build`
2. It reads version from `apps/desktop/package.json`, gets commit SHA and date from git, reads `RELEASE_CHANNEL` from environment
3. It writes [`apps/desktop/src/lib/build-metadata/generated.ts`](../apps/desktop/src/lib/build-metadata/generated.ts) (gitignored)
4. [`apps/desktop/src/lib/build-metadata/index.ts`](../apps/desktop/src/lib/build-metadata/index.ts) exports `BUILD_METADATA` with a try/catch fallback if generated.ts doesn't exist

### Auto-Update

- [`apps/desktop/src/lib/updater/auto-updater.ts`](../apps/desktop/src/lib/updater/auto-updater.ts) uses `electron-updater` configured for GitHub Releases
- `autoDownload = false` — user decides when to download
- Only runs in packaged builds (`app.isPackaged` check)
- Checks for updates 5 seconds after startup
- [`UpdateBanner.tsx`](../apps/desktop/src/renderer/components/UpdateBanner.tsx) shows a non-intrusive banner below the top bar

---

## Where the App Is Intentionally Simplified Right Now

These are areas where the architecture is deliberately simpler than the full design:

| Area | Current State | Full Design |
|---|---|---|
| **Orchestrator routing** | Orchestrator calls OpenRouter directly, no multi-Mode delegation | Orchestrator analyzes task, routes to specialist Modes, collects results |
| **Cloud sync** | Disabled; all data local only | Full Supabase sync with Realtime push and lease/heartbeat |
| **Database** | sql.js (pure JS, in-memory with file persistence) | better-sqlite3 (native, faster) or sql.js with proper migration |
| **Approval second-model** | Calls OpenRouter for review | Could cache common approval patterns to reduce API calls |
| **Mode tool permissions** | All Modes have access to all tools | Per-Mode tool permission configuration |
| **Conversation summarization** | Not implemented | Auto-summarize long conversations to stay within context limits |
| **MCP integration** | Package exists but not implemented | Connect to external MCP servers for additional tools |
| **Custom Modes** | Can edit built-in Modes but creating new ones is limited | Full Mode creation, duplication, import/export |

---

## Security Boundaries

| What | Where It Lives | Notes |
|---|---|---|
| OpenRouter API key | keytar (OS-secure) | Never synced by default |
| SSH private keys | Local `~/.ssh/` | Never synced |
| SSH target metadata | Supabase Postgres (when sync enabled) | Synced (no key material) |
| Supabase anon key | App bundle (`.env` file) | Public, safe to include |
| Supabase service key | Never in desktop app | Server-side only |
| GitHub token (DevOps) | keytar (OS-secure) | Never synced by default |
| Coolify API key | keytar (OS-secure) | Never synced by default |
| Local files | Electron main process only | Renderer cannot access directly |
| Terminal commands | Electron main process only | Renderer cannot execute directly |

---

## Repository Structure

```
vibeflow/
├── apps/desktop/                    ← Electron app
│   ├── electron.vite.config.ts      ← Vite config (MUST be this name, not vite.config.ts)
│   ├── electron-builder.yml         ← Packaging config (GitHub Releases publish)
│   ├── package.json                 ← App dependencies (sql.js, keytar, electron-updater, etc.)
│   ├── tsconfig.json                ← TypeScript config with @vibeflow/* paths
│   └── src/
│       ├── main/index.ts            ← Main process entry (959 lines, IPC handler registry)
│       ├── preload/index.ts         ← Preload bridge (window.vibeflow API)
│       ├── renderer/                ← React app
│       │   ├── App.tsx              ← Root component, screen routing
│       │   ├── main.tsx             ← React entry point
│       │   ├── index.html           ← HTML shell with CSS reset
│       │   ├── screens/             ← Full-page screens
│       │   │   ├── SignInScreen.tsx
│       │   │   ├── ProjectListScreen.tsx
│       │   │   ├── ProjectScreen.tsx
│       │   │   ├── ConversationScreen.tsx
│       │   │   ├── ModesScreen.tsx
│       │   │   ├── DevOpsScreen.tsx
│       │   │   └── SshScreen.tsx
│       │   └── components/          ← Reusable components
│       │       ├── TopBar.tsx
│       │       ├── BottomBar.tsx
│       │       ├── UpdateBanner.tsx
│       │       ├── ApprovalCard.tsx
│       │       ├── ApprovalQueue.tsx
│       │       └── HandoffDialog.tsx
│       └── lib/                     ← Shared libraries (copied from packages/ due to exFAT)
│           ├── shared-types/        ← TypeScript interfaces
│           ├── storage/             ← LocalDb (sql.js), Supabase client
│           ├── sync/                ← SyncEngine (implemented but disabled)
│           ├── orchestrator/        ← Orchestrator logic
│           ├── modes/               ← Default mode definitions
│           ├── approval/            ← Approval engine + logger
│           ├── handoff/             ← Handoff generator + storage
│           ├── tooling/             ← File, terminal, git, SSH services
│           ├── devops/              ← DevOps templates, GitHub Actions, Coolify, health check
│           ├── updater/             ← Auto-updater
│           └── build-metadata/      ← Version/commit/date injection
├── packages/                        ← Shared packages (source of truth, but NOT used via workspace:*)
│   ├── shared-types/                ← Canonical type definitions
│   ├── storage/                     ← Canonical storage code
│   ├── build-metadata/              ← Canonical build metadata code
│   └── (others: README stubs only)
├── docs/                            ← All documentation
├── scripts/                         ← Build and dev scripts
└── .github/workflows/               ← CI/CD (ci.yml, release.yml)
```

**Important:** Due to the exFAT drive limitation, `packages/*` source files are copied into `apps/desktop/src/lib/` rather than linked via `workspace:*`. The `packages/` directory contains the canonical source, but the app builds from `apps/desktop/src/lib/`. See [`docs/idiosyncrasies.md`](idiosyncrasies.md) for details.
