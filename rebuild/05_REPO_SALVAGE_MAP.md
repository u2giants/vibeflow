# 05 — Repo Salvage Map

Version: 1.0
Status: Binding salvage classification for the VibeFlow brownfield rebuild
Date: 2026-04-14
Author: Architect (`anthropic/claude-opus-4.6`)
Governing spec: [`01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md`](01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md)

---

## 1. Purpose

This document classifies every meaningful module in the current VibeFlow repository according to the brownfield salvage categories defined in the rebuild specs. It is the **repo-wide reuse matrix** that prevents casual rewrites and ensures the AI builder knows what exists before inventing new structure.

Per-component salvage audits (required before each component implementation) will refine these classifications. This document provides the starting baseline.

---

## 2. Classification categories

| Category | Meaning |
|---|---|
| **Keep as-is** | Already matches the target design closely enough. No changes needed. |
| **Keep with adapter** | Keep the implementation but add a new interface boundary around it. |
| **Refactor in place** | Preserve the module identity while improving structure internally. |
| **Extract into boundary** | Lift a slice of the code into a clearer service, domain, or package. |
| **Replace** | Retire the implementation only because responsible evolution is not practical. Requires written justification. |

---

## 3. Electron shell and main process

| File | Lines | Current Responsibility | Classification | Notes |
|---|---|---|---|---|
| [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) | 959 | App lifecycle, window creation, all IPC handlers | **Extract into boundary** | Must be split into domain handler files (auth, projects, modes, etc.) during Phase 0. The lifecycle/window code stays; handlers move to `main/handlers/*.ts`. |
| [`apps/desktop/src/preload/index.ts`](../apps/desktop/src/preload/index.ts) | 166 | Typed `window.vibeflow` API bridge | **Keep with adapter** | Sound security boundary. Will grow as new IPC channels are added. May need domain grouping later. |
| [`apps/desktop/electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts) | ~50 | Vite config with `resolveId` plugin for exFAT workaround | **Keep as-is** | Intentional idiosyncrasy (#3). Required until repo moves to NTFS. |
| [`apps/desktop/electron-builder.yml`](../apps/desktop/electron-builder.yml) | ~30 | Packaging config for GitHub Releases | **Keep as-is** | Working config. May need `extraResources` additions for packaged docs. |
| [`apps/desktop/tsconfig.json`](../apps/desktop/tsconfig.json) | ~30 | TypeScript config with `@vibeflow/*` paths | **Keep as-is** | Required for exFAT workaround. |

### Strength assessment
The Electron shell is the **strongest salvage area**. The main/preload/renderer split is correct, the IPC pattern is sound, and the security boundary is properly enforced. The only issue is the monolithic main process file, which is a mechanical split.

---

## 4. Renderer — screens and components

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`App.tsx`](../apps/desktop/src/renderer/App.tsx) | 111 | Root component, screen routing, auth state | **Refactor in place** | C10: Shell |
| [`SignInScreen.tsx`](../apps/desktop/src/renderer/screens/SignInScreen.tsx) | ~80 | GitHub OAuth sign-in | **Keep as-is** | C10: Shell |
| [`ProjectListScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectListScreen.tsx) | ~120 | Project list with create/self-maintenance | **Keep with adapter** | C10: Shell |
| [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) | ~200 | Conversation list sidebar + 5-panel layout | **Refactor in place** | C10: Shell → mission workspace |
| [`ConversationScreen.tsx`](../apps/desktop/src/renderer/screens/ConversationScreen.tsx) | ~350 | Chat UI with streaming, execution stream, file viewer | **Refactor in place** | C10: Shell → mission panel |
| [`ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx) | ~250 | Mode editor with soul/model picker | **Keep with adapter** | C12: Agent Orchestration |
| [`DevOpsScreen.tsx`](../apps/desktop/src/renderer/screens/DevOpsScreen.tsx) | ~400 | 4-tab DevOps UI (Overview, GitHub Actions, Deploy, Health) | **Keep with adapter** | C17: Environments/Deploy |
| [`SshScreen.tsx`](../apps/desktop/src/renderer/screens/SshScreen.tsx) | ~150 | SSH host discovery and connection testing | **Keep with adapter** | C14: Capability Fabric |
| [`TopBar.tsx`](../apps/desktop/src/renderer/components/TopBar.tsx) | ~80 | Version, commit, sync status, email | **Refactor in place** | C10: Shell → project header |
| [`BottomBar.tsx`](../apps/desktop/src/renderer/components/BottomBar.tsx) | ~60 | Current mode, model, approval queue | **Keep with adapter** | C10: Shell |
| [`UpdateBanner.tsx`](../apps/desktop/src/renderer/components/UpdateBanner.tsx) | ~80 | Auto-update notification banner | **Keep as-is** | C10: Shell |
| [`ApprovalCard.tsx`](../apps/desktop/src/renderer/components/ApprovalCard.tsx) | ~100 | Human approval modal | **Keep with adapter** | C19: Approval/Risk |
| [`ApprovalQueue.tsx`](../apps/desktop/src/renderer/components/ApprovalQueue.tsx) | ~80 | Approval queue indicator | **Keep with adapter** | C19: Approval/Risk |
| [`HandoffDialog.tsx`](../apps/desktop/src/renderer/components/HandoffDialog.tsx) | ~120 | Handoff generation modal | **Keep with adapter** | C22: Sync/Handoff |
| [`index.html`](../apps/desktop/src/renderer/index.html) | ~30 | HTML shell with CSS reset | **Keep as-is** | C10: Shell |
| [`main.tsx`](../apps/desktop/src/renderer/main.tsx) | ~10 | React entry point | **Keep as-is** | C10: Shell |

### Strength assessment
The renderer is a **strong salvage area**. All screens work, the component structure is clean, and the IPC integration is correct. The main evolution needed is from conversation-centric to mission-centric navigation, which is a refactor of `ProjectScreen` and `ConversationScreen`, not a replacement.

---

## 5. Storage and database

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) | 489 | SQLite CRUD for projects, modes, conversations, messages, devops configs, deploy runs, settings | **Refactor in place** | C22: Sync → will need new tables for missions, plans, evidence, etc. |
| [`supabase-client.ts`](../apps/desktop/src/lib/storage/supabase-client.ts) | ~30 | Supabase client wrapper | **Keep as-is** | C22: Sync |
| [`sql-js.d.ts`](../apps/desktop/src/lib/storage/sql-js.d.ts) | ~20 | Custom type declarations for sql.js | **Keep as-is** | C22: Sync |
| [`index.ts`](../apps/desktop/src/lib/storage/index.ts) | ~5 | Re-export | **Keep as-is** | — |
| [`schema.sql`](../packages/storage/src/schema.sql) | ~30 | SQL schema (canonical) | **Refactor in place** | C22: Sync → will grow with new domain objects |

### Strength assessment
The storage layer is **solid but will grow significantly**. The sql.js approach works. The `LocalDb` class will need new tables for missions, plans, context packs, evidence records, capability configs, memory packs, and incidents. This is additive — the existing tables and CRUD methods are preserved.

---

## 6. Sync engine

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) | 501 | Full sync engine: device registration, initial sync, push to Supabase, lease/heartbeat, realtime subscriptions | **Refactor in place** | C22: Sync |

### Strength assessment
The sync engine is **implemented but disabled**. It was written against `better-sqlite3` API patterns and needs adaptation for sql.js. The lease/heartbeat model, device ownership, and Supabase Realtime integration are all designed and coded. This is a **high-value salvage asset** — it needs adaptation, not replacement.

### Migration notes
1. Adapt API calls from `better-sqlite3` patterns to sql.js patterns
2. Run Supabase migration SQL before testing
3. Extend to sync new domain objects (missions, plans, evidence) as they are added in later components

---

## 7. Orchestrator and mode system

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`orchestrator.ts`](../apps/desktop/src/lib/orchestrator/orchestrator.ts) | 87 | Single-model streaming chat via OpenRouter | **Replace** | C12: Agent Orchestration |
| [`default-modes.ts`](../apps/desktop/src/lib/modes/default-modes.ts) | ~100 | 6 default Mode definitions | **Refactor in place** | C12: Agent Orchestration → add Watcher/Incident role |

### Replacement justification for `orchestrator.ts`
The current orchestrator is a **single-function streaming chat wrapper**. It sends messages to OpenRouter and streams tokens back. The target orchestrator (Component 12) must:
- decompose missions into plan steps
- assign steps to roles
- manage multi-model routing
- enforce role-specific permissions
- produce structured outputs (PlanRecord, DesignDecision, CodePatchProposal, etc.)
- manage retries and escalation

The current 87-line function cannot be adapted to serve this purpose — it has no plan decomposition, no role routing, no structured output, and no state management. An adapter layer would be more complex than the replacement. The streaming SSE parsing logic can be extracted and reused in the new provider layer.

**Interface preservation:** The IPC channels (`conversations:sendMessage`, stream events) will be preserved. The orchestrator replacement happens behind the IPC boundary.

**Rollback:** The old `orchestrator.ts` is preserved in git history. If the new orchestrator fails, the old one can be restored by reverting the file.

---

## 8. Approval system

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) | 120 | 3-tier classification, second-model review via OpenRouter | **Refactor in place** | C19: Approval/Risk |
| [`approval-logger.ts`](../apps/desktop/src/lib/approval/approval-logger.ts) | ~60 | In-memory approval audit log | **Refactor in place** | C19: Approval/Risk → persist to SQLite |

### Strength assessment
The approval system is a **strong salvage asset**. The 3-tier model (auto / second-model / human) matches the target design. The `classifyAction()` function needs expansion to handle more risk dimensions (environment, blast radius, evidence completeness, service mutation scope) but the core pattern is correct. The second-model review via OpenRouter is working. The in-memory logger needs to be persisted to SQLite.

---

## 9. Tooling services

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`file-service.ts`](../apps/desktop/src/lib/tooling/file-service.ts) | ~100 | File read/write/list/exists with path traversal protection | **Keep with adapter** | C14: Capability Fabric |
| [`terminal-service.ts`](../apps/desktop/src/lib/tooling/terminal-service.ts) | ~80 | Command execution with streaming output | **Keep with adapter** | C14: Capability Fabric |
| [`git-service.ts`](../apps/desktop/src/lib/tooling/git-service.ts) | ~120 | Git status/diff/commit/push/log via local binary | **Keep with adapter** | C14: Capability Fabric |
| [`ssh-service.ts`](../apps/desktop/src/lib/tooling/ssh-service.ts) | ~80 | SSH host discovery, key discovery, connection testing | **Keep with adapter** | C14: Capability Fabric |

### Strength assessment
The tooling services are **strong salvage assets**. They are clean, focused, and correctly isolated in the main process. The adapter needed is a **capability registry wrapper** — each service becomes a registered capability with health status, permission classification, invocation logging, and audit trail. The underlying implementations are preserved.

---

## 10. DevOps subsystem

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`devops-templates.ts`](../apps/desktop/src/lib/devops/devops-templates.ts) | ~80 | Standard and Albert deployment templates | **Keep with adapter** | C17: Environments/Deploy |
| [`github-actions-client.ts`](../apps/desktop/src/lib/devops/github-actions-client.ts) | ~60 | Fetch workflow runs from GitHub API | **Keep with adapter** | C17: Environments/Deploy |
| [`coolify-client.ts`](../apps/desktop/src/lib/devops/coolify-client.ts) | ~80 | Deploy/restart/stop via Coolify REST API | **Keep with adapter** | C17: Environments/Deploy |
| [`health-check.ts`](../apps/desktop/src/lib/devops/health-check.ts) | ~40 | URL-based health monitoring | **Keep with adapter** | C21: Observability |

### Strength assessment
The DevOps subsystem is a **good salvage area**. The clients work and the template model is sound. The adapter needed is integration with the environment model (Component 17) and the capability fabric (Component 14). The existing clients become registered capabilities with health status and audit logging.

---

## 11. Handoff system

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`handoff-generator.ts`](../apps/desktop/src/lib/handoff/handoff-generator.ts) | ~120 | Pure functions: `generateHandoffDoc()` and `generateHandoffPrompt()` | **Keep with adapter** | C22: Sync/Handoff |
| [`handoff-storage.ts`](../apps/desktop/src/lib/handoff/handoff-storage.ts) | ~60 | Save to Supabase Storage bucket | **Keep as-is** | C22: Sync/Handoff |

### Strength assessment
The handoff system is **clean and reusable**. The generator functions are pure and well-structured. The storage client works with Supabase. The adapter needed is extending the handoff context to include mission state, plan state, evidence summary, and blocked items (per Component 22 spec).

---

## 12. Build metadata and auto-updater

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`build-metadata/index.ts`](../apps/desktop/src/lib/build-metadata/index.ts) | ~20 | Export BUILD_METADATA with try/catch fallback | **Keep as-is** | C10: Shell |
| [`updater/auto-updater.ts`](../apps/desktop/src/lib/updater/auto-updater.ts) | ~60 | electron-updater configured for GitHub Releases | **Keep as-is** | C10: Shell |
| [`scripts/inject-build-metadata.js`](../scripts/inject-build-metadata.js) | ~30 | Build-time metadata injection | **Keep as-is** | — |

### Strength assessment
Build metadata and auto-update are **complete and working**. No changes needed for the rebuild.

---

## 13. Shared types

| File | Lines | Current Responsibility | Classification | Target Component |
|---|---|---|---|---|
| [`shared-types/entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | 148 | All TypeScript interfaces | **Refactor in place** | All components |
| [`shared-types/ipc.ts`](../apps/desktop/src/lib/shared-types/ipc.ts) | ~200 | IPC channel type definitions | **Refactor in place** | All components |
| [`shared-types/index.ts`](../apps/desktop/src/lib/shared-types/index.ts) | ~5 | Re-export | **Keep as-is** | — |

### Strength assessment
The shared types are **sound but will grow significantly**. New domain objects from the master spec (Mission, Plan, ContextPack, Capability, ChangeSet, EvidenceItem, ApprovalRequest, DeployCandidate, Incident) must be added. The existing types (Account, Device, Project, ConversationThread, Message, ExecutionEvent, Mode, OpenRouterModel, ProjectDevOpsConfig, DeployRun) are preserved.

---

## 14. Package stubs (packages/ directory)

| Package | Has Source? | Classification | Notes |
|---|---|---|---|
| `packages/shared-types/` | Yes (compiled) | **Keep as-is** | Canonical source; copied to `apps/desktop/src/lib/` due to exFAT |
| `packages/storage/` | Yes (compiled) | **Keep as-is** | Canonical source; copied to `apps/desktop/src/lib/` due to exFAT |
| `packages/build-metadata/` | Yes (compiled) | **Keep as-is** | Canonical source |
| `packages/core-orchestrator/` | README only | **Placeholder** | Will be populated during C12 |
| `packages/mode-system/` | README only | **Placeholder** | Will be populated during C12 |
| `packages/providers/` | README only | **Placeholder** | Will be populated during C12/C14 |
| `packages/sync/` | README only | **Placeholder** | Will be populated during C22 |
| `packages/tooling/` | README only | **Placeholder** | Will be populated during C14 |
| `packages/git-manager/` | README only | **Placeholder** | Will be populated during C14 |
| `packages/ssh-manager/` | README only | **Placeholder** | Will be populated during C14 |
| `packages/mcp-manager/` | README only | **Placeholder** | Will be populated during C14 |
| `packages/devops/` | README only | **Placeholder** | Will be populated during C17 |
| `packages/handoff/` | README only | **Placeholder** | Will be populated during C22 |
| `packages/approval/` | README only | **Placeholder** | Will be populated during C19 |

### Note on exFAT constraint
Due to the exFAT drive limitation, `packages/*` source files are copied into `apps/desktop/src/lib/` rather than linked via `workspace:*`. The `packages/` directory contains the canonical source, but the app builds from `apps/desktop/src/lib/`. This constraint persists throughout the rebuild. See [`docs/idiosyncrasies.md`](../docs/idiosyncrasies.md) entry #3.

---

## 15. Documentation

| File | Classification | Notes |
|---|---|---|
| [`docs/architecture.md`](../docs/architecture.md) | **Refactor in place** | Must be updated as each component evolves the architecture |
| [`docs/decisions.md`](../docs/decisions.md) | **Keep as-is** | Append new decisions; do not rewrite history |
| [`docs/idiosyncrasies.md`](../docs/idiosyncrasies.md) | **Keep as-is** | Append new entries as rebuild introduces intentional weirdness |
| [`docs/risks.md`](../docs/risks.md) | **Refactor in place** | Update risk assessments as rebuild progresses |
| [`docs/what-is-left.md`](../docs/what-is-left.md) | **Replace** | Superseded by this rebuild plan; will be rewritten to reflect rebuild progress |
| All other docs | **Keep as-is** | Reference material; update as relevant |

---

## 16. CI/CD and scripts

| File | Classification | Notes |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | **Keep with adapter** | Add test step when test infrastructure exists |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | **Keep as-is** | Working release pipeline |
| [`scripts/inject-build-metadata.js`](../scripts/inject-build-metadata.js) | **Keep as-is** | Working build script |

---

## 17. Salvage summary

| Classification | Count | Percentage |
|---|---|---|
| Keep as-is | 18 | 35% |
| Keep with adapter | 14 | 27% |
| Refactor in place | 12 | 24% |
| Extract into boundary | 2 | 4% |
| Replace | 2 | 4% |
| Placeholder (no source yet) | 10 | — |

**Key finding:** 86% of existing modules with source code are classified as keep or adapt. Only 2 modules require replacement (`orchestrator.ts` and `docs/what-is-left.md`), both with written justification. This confirms the brownfield approach is viable and the existing codebase is a genuine strategic asset.

---

## 18. Highest-value salvage assets (ranked)

1. **Electron shell** (main/preload/renderer split) — correct architecture, sound security boundary
2. **Tooling services** (file, terminal, git, SSH) — clean, focused, correctly isolated
3. **Approval engine** — 3-tier model matches target design
4. **Sync engine** — fully implemented, needs adaptation not replacement
5. **Storage layer** (LocalDb + sql.js) — working persistence, needs additive growth
6. **DevOps clients** (GitHub Actions, Coolify, health check) — working connectors
7. **Renderer screens** — working UI, needs evolution from chat-centric to mission-centric
8. **Shared types** — sound type system, needs additive growth
9. **Handoff system** — clean pure functions, needs context extension
10. **Build metadata + auto-updater** — complete, no changes needed
