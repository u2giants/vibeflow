# VibeFlow Desktop App

This is the Electron desktop application — the main user-facing product.

---

## Actual Structure

```
apps/desktop/
├── electron.vite.config.ts   ← Vite config (MUST be this name — see idiosyncrasies #1)
├── electron-builder.yml      ← Packaging config (GitHub Releases, NSIS installer)
├── package.json              ← App dependencies
├── tsconfig.json             ← TypeScript config with @vibeflow/* path mappings
└── src/
    ├── main/
    │   └── index.ts          ← Main process entry (~2,441 lines — intentional IPC registry)
    ├── preload/
    │   └── index.ts          ← Preload bridge: exposes window.vibeflow.* API to renderer
    ├── renderer/
    │   ├── App.tsx            ← Root component and screen routing
    │   ├── main.tsx           ← React entry point
    │   ├── index.html         ← HTML shell with global CSS reset
    │   ├── screens/           ← Full-page screens
    │   │   ├── ConversationScreen.tsx
    │   │   ├── DevOpsScreen.tsx
    │   │   ├── McpScreen.tsx
    │   │   ├── ModesScreen.tsx
    │   │   ├── ProjectListScreen.tsx
    │   │   ├── ProjectScreen.tsx
    │   │   ├── SignInScreen.tsx
    │   │   └── SshScreen.tsx
    │   ├── components/        ← Reusable components
    │   │   ├── ApprovalCard.tsx
    │   │   ├── ApprovalQueue.tsx
    │   │   ├── BottomBar.tsx
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── EvidenceRail.tsx
    │   │   ├── HandoffDialog.tsx
    │   │   ├── LeftRail.tsx
    │   │   ├── PanelWorkspace.tsx
    │   │   ├── ProjectHeader.tsx
    │   │   ├── TopBar.tsx
    │   │   ├── UpdateBanner.tsx
    │   │   └── panels/        ← 14 mission workspace panels
    │   │       ├── AcceptancePanel.tsx
    │   │       ├── AuditPanel.tsx
    │   │       ├── CapabilitiesPanel.tsx
    │   │       ├── ChangePanel.tsx
    │   │       ├── ContextPanel.tsx
    │   │       ├── EnvironmentPanel.tsx
    │   │       ├── EvidencePanel.tsx
    │   │       ├── MemoryPanel.tsx
    │   │       ├── MigrationPanel.tsx
    │   │       ├── MissionPanel.tsx
    │   │       ├── PlanPanel.tsx
    │   │       ├── SecretsPanel.tsx
    │   │       ├── VerificationPanel.tsx
    │   │       └── WatchPanel.tsx
    │   └── hooks/             ← React hooks (useUiState, etc.)
    └── lib/                   ← ALL authoritative application library code
        ├── approval/          ← Approval engine, audit store
        ├── build-metadata/    ← Version/commit/date injection
        ├── capability-fabric/ ← Capability registry and adapter
        ├── change-engine/     ← Change engine, checkpoint manager, patch applier
        ├── devops/            ← Coolify client, GitHub Actions client, health check
        ├── handoff/           ← Handoff generator + Supabase Storage save
        ├── mcp-manager/       ← MCP connection manager, tool registry, executor
        ├── memory/            ← Memory lifecycle, retriever, seed
        ├── modes/             ← Default mode definitions
        ├── observability/     ← Anomaly detector, self-healing engine, watch engine
        ├── orchestrator/      ← OrchestrationEngine + legacy orchestrator wrapper
        ├── project-intelligence/ ← Context pack assembler, framework detector, indexing
        ├── providers/         ← OpenRouter provider
        ├── runtime-execution/ ← Browser automation, evidence capture
        ├── secrets/           ← Secrets store, migration safety
        ├── shared-types/      ← TypeScript interfaces (entities, IPC, index)
        ├── storage/           ← LocalDb (sql.js), Supabase client, sql-js.d.ts
        ├── sync/              ← SyncEngine (re-enabled 2026-04-18)
        ├── tooling/           ← File, terminal, git, SSH services
        ├── updater/           ← Auto-updater wrapper
        ├── verification/      ← Verification engine, acceptance criteria
        ├── deploy-engine.ts
        ├── drift-detector.ts
        ├── environment-manager.ts
        └── service-control-plane.ts
```

---

## How to Run

```bash
# From the repo root:
pnpm install --ignore-scripts
node node_modules/electron/install.js
pnpm dev
```

The Electron window opens with the sign-in screen. Sign in with GitHub.

## How to Build

```bash
pnpm build
```

Output: `apps/desktop/dist/VibeFlow-Setup-x.y.z.exe`

---

## Key Concepts

- The **main process** (`src/main/index.ts`) has full Node.js access for files, terminal, git, SSH, secrets. It is intentionally large (~2,441 lines) because it is a flat IPC handler registry — business logic lives in `src/lib/`.
- The **preload script** (`src/preload/index.ts`) exposes a typed `window.vibeflow.*` API to the renderer via Electron's `contextBridge`. The renderer has no direct Node.js access.
- The **renderer** is a sandboxed React app that calls `window.vibeflow.*` for all privileged operations.
- All application library code lives in `src/lib/`. The `packages/` directory at the repo root contains canonical versions of only three packages (`shared-types`, `storage`, `build-metadata`) — everything else in `packages/` is a README stub.

---

## Notes

- See [`docs/architecture.md`](../../docs/architecture.md) for the full architecture
- See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) before changing anything
- See [`docs/release-process.md`](../../docs/release-process.md) for the build and release process
- See [`docs/build-metadata.md`](../../docs/build-metadata.md) for how version/commit info gets into the top bar
