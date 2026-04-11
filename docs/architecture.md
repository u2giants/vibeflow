# VibeFlow — Architecture

Last updated: 2026-04-11
Status: Approved by Albert

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

## Electron Main Process Responsibilities

The main process runs in Node.js and has full access to the local machine. It is responsible for:

- **File system access** — reading and writing files on the local machine
- **Terminal execution** — running shell commands, streaming output back to the renderer
- **Git operations** — via the `git-manager` package (uses local git binary)
- **SSH operations** — via the `ssh-manager` package (uses local ssh binary and ~/.ssh/config)
- **OS-secure secret storage** — via `keytar` (Windows Credential Manager)
- **IPC handlers** — receiving requests from the renderer process and returning results
- **Auto-update** — checking GitHub Releases and applying updates via `electron-updater`
- **Build metadata** — reading injected version/commit/date at startup

The main process never directly calls OpenRouter or Supabase for AI work — that is the renderer's job via the sync client and provider packages.

---

## Electron Renderer Process Responsibilities

The renderer process runs in a sandboxed Chromium context and is responsible for:

- **React UI** — all five panels, all user interaction
- **Conversation management** — sending messages, receiving responses, displaying history
- **Mode routing** — deciding which Mode handles a given task
- **OpenRouter calls** — streaming AI responses via the providers package
- **Supabase sync** — reading and writing synced state via the storage/sync packages
- **Approval system** — presenting approval cards, calling second-model review
- **Handoff generation** — triggering handoff artifact creation

The renderer communicates with the main process via IPC (inter-process communication) for anything that requires local machine access.

---

## IPC Communication Pattern

```
Renderer (React)  →  preload/ipc-bridge.ts  →  Main Process
                  ←  preload/ipc-bridge.ts  ←
```

- The preload script exposes a safe, typed API to the renderer
- The renderer calls `window.vibeflow.files.read(path)` etc.
- The main process handles these via registered IPC handlers
- All IPC calls are typed in `packages/shared-types`

---

## Package Boundaries

| Package | What It Does | Used By |
|---|---|---|
| `shared-types` | All TypeScript interfaces and types for the whole system | Everything |
| `core-orchestrator` | Orchestrator logic: receives user messages, routes to Modes, collects results | Renderer |
| `mode-system` | Mode definitions, souls, config, per-mode model assignment | Orchestrator, Renderer |
| `providers` | OpenRouter API client, model picker, streaming, pricing metadata | Orchestrator, Renderer |
| `storage` | Local SQLite cache + Supabase sync client | Renderer, Main |
| `sync` | Sync engine, conflict resolution, lease/heartbeat, device ownership | Renderer |
| `tooling` | File, terminal, diff, build, test action wrappers | Main Process |
| `git-manager` | Git operations (status, commit, push, diff) | Main Process |
| `ssh-manager` | SSH config discovery, key discovery, connection testing | Main Process |
| `mcp-manager` | MCP server connections, tool availability | Renderer |
| `devops` | DevOps templates, deploy runs, health checks, Coolify/GitHub Actions clients | Renderer |
| `handoff` | Handoff artifact generation, handoff prompt creation | Renderer |
| `approval` | Approval tier logic, second-model review, approval queue | Renderer |
| `build-metadata` | Version/commit/date injection at build time | Main, Renderer |

---

## Data Flow: User Message → Response

```
1. User types a message in the Center Panel
2. Renderer sends message to core-orchestrator
3. Orchestrator determines which Mode should handle it
4. If the task requires a specialist Mode:
   a. Orchestrator sends a sub-task to the specialist Mode
   b. Specialist Mode calls OpenRouter via providers package
   c. Specialist Mode may call tools (file read, terminal, git, etc.) via IPC
   d. Each tool call goes through the approval system
   e. Approved actions execute; results stream back
   f. Specialist Mode returns result to Orchestrator
5. Orchestrator synthesizes the result
6. Orchestrator calls OpenRouter for its own response
7. Response streams back to the Center Panel
8. Execution stream (Left Panel) updates with what happened
9. All messages, actions, and results are written to local SQLite cache
10. Sync client pushes changes to Supabase Postgres
11. Supabase Realtime pushes updates to all other signed-in devices
```

---

## Cloud Sync Architecture

See `/docs/cloud-sync.md` for the full sync architecture.

Summary:
- **Supabase Postgres** is the canonical cloud source of truth for all synced state
- **Supabase Realtime** pushes live updates to all connected clients
- **Local SQLite** is the local cache for speed and offline resilience
- **Lease/heartbeat model** ensures only one device actively drives a conversation at a time

---

## Key Approved Decisions

1. **Roo-inspired reimplementation** — We implement Mode/orchestration behavior in our own TypeScript, inspired by Roo Code's concepts but not dependent on its VS Code extension architecture. See `/docs/decisions.md` entry 1.

2. **Supabase as cloud backend** — Minimal moving parts, Auth + Postgres + Realtime + Storage in one hosted service. See `/docs/decisions.md` entry 2.

3. **Three-tier approval system** — Auto / second-model review / human. Designed to minimize human interruption. See `/docs/approval-policy.md`.

4. **keytar for local secrets** — OS-secure storage on Windows. API keys and SSH passphrases never leave the device unless the user explicitly opts into encrypted sync. See `/docs/cloud-sync.md` secrets section.

5. **OpenRouter as primary provider** — Abstracted behind a provider interface so other providers can be added later. See `/docs/decisions.md` entry 5.

---

## Security Boundaries

| What | Where It Lives | Notes |
|---|---|---|
| OpenRouter API key | keytar (OS-secure) | Never synced by default |
| SSH private keys | Local ~/.ssh/ | Never synced |
| SSH target metadata | Supabase Postgres | Synced (no key material) |
| Supabase anon key | App bundle | Public, safe to include |
| Supabase service key | Never in desktop app | Server-side only |
| GitHub Secrets | GitHub Actions | CI/CD only |
| Coolify API key | keytar (OS-secure) | Never synced by default |
