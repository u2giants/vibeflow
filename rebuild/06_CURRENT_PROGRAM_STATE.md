# 06 — Current Program State

Version: 1.1
Status: Binding state assessment for the VibeFlow brownfield rebuild (updated after Component 10 implementation)
Date: 2026-04-14 (v1.1 updated after Component 10 post-implementation audit)
Author: Architect (`anthropic/claude-opus-4.6`)
Evidence sources: Current repo files, [`docs/architecture.md`](../docs/architecture.md), [`docs/idiosyncrasies.md`](../docs/idiosyncrasies.md), [`docs/risks.md`](../docs/risks.md), [`docs/what-is-left.md`](../docs/what-is-left.md), [`CURRENT_TASK.md`](../CURRENT_TASK.md), runtime source files, Component 10 post-implementation audit

---

## 1. Executive summary

VibeFlow is a working Electron desktop application with 10 completed MVP milestones plus the Component 10 shell scaffolding from the brownfield rebuild. It can authenticate users, manage projects, host conversations with AI via OpenRouter streaming, manage modes with per-mode model assignment, execute file/terminal/git/SSH operations, run DevOps workflows (GitHub Actions, Coolify), enforce a 3-tier approval system with second-model review, generate handoff packages, and display build metadata with auto-update capability.

**Component 10 (Product Shell) is implemented.** The app now has a left rail with 8 navigation sections, a project header below the top bar, a 9-panel collapsible mission workspace, a right evidence rail, additive shell domain types, and placeholder panels for all master-spec surfaces. The shell scaffolding is in place for subsequent components to render into.

The application is **transitioning from conversation-centric to mission-centric**. The shell structure exists, but the conversation experience is still reached through the legacy fallback path rather than being integrated into the mission workspace. Three residual cleanup items from Component 10 must be resolved before Component 22 begins (see §3.1).

Cloud sync is **disabled**. The app runs in local-only mode using sql.js. The sync engine is fully implemented (501 lines) but needs adaptation for the sql.js API and the Supabase migration SQL has not been run.

There are **zero automated tests**. The test plan exists but no tests have been written.

The main process is a **959-line monolith** that needs splitting before the rebuild adds more IPC handlers.

---

## 2. What works today

### 2.1 Authentication
- GitHub OAuth sign-in via temporary localhost HTTP server on port 54321
- Dual-flow support: PKCE (`?code=`) and implicit (`#access_token=`) OAuth responses
- Session persistence via Supabase Auth
- Sign-out functionality
- **Status:** ✅ Working

### 2.2 Project management
- Create projects with name and description
- List all projects for the signed-in user
- Self-maintenance project (work on VibeFlow itself) with safety overrides
- Projects stored in local SQLite
- **Status:** ✅ Working

### 2.3 Conversation and AI streaming
- Create conversations within a project
- Send messages to the Orchestrator
- OpenRouter streaming with real-time token display
- Conversation history persists in local SQLite
- Multiple conversations per project
- Execution stream shows mode starts, tool calls, thinking events
- **Status:** ✅ Working (single-model, no multi-mode routing)

### 2.4 Mode system
- 6 default modes: Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer
- Edit mode soul (instructions) via GUI
- Assign different OpenRouter models to different modes
- Model picker with pricing metadata from `/api/v1/models/user`
- Modes stored in local SQLite
- **Status:** ✅ Working (modes exist but Orchestrator does not route to them)

### 2.5 Tooling services
- **File service:** read, write, list, exists with path traversal protection
- **Terminal service:** run commands with streaming output, kill processes
- **Git service:** status, diff, commit, push, log via local `git` binary
- **SSH service:** discover hosts from `~/.ssh/config`, discover keys, test connections
- Right panel shows file contents and diffs
- Bottom panel shows terminal output and git status
- **Status:** ✅ Working

### 2.6 DevOps subsystem
- Two deployment templates: Standard (feature branch → PR → merge) and Albert (push-to-main)
- GitHub Actions client: fetch workflow runs with status
- Coolify client: deploy, restart, stop via REST API
- Health check: URL-based monitoring with response time
- DevOps screen with 4 tabs (Overview, GitHub Actions, Deploy, Health)
- Per-project DevOps configuration stored in local SQLite
- Deploy run history stored in local SQLite
- GitHub token and Coolify API key stored in keytar
- **Status:** ✅ Working

### 2.7 Approval system
- 3-tier classification: Tier 1 (auto), Tier 2 (second-model), Tier 3 (human)
- Second-model review via `google/gemini-flash-1.5` on OpenRouter
- Human approval card with approve/reject/ask-for-more-info
- Approval queue indicator in bottom bar
- Self-maintenance override: forces Tier 3 for file writes/deletes on VibeFlow's own code
- In-memory approval audit log
- **Status:** ✅ Working

### 2.8 Handoff system
- Generate handoff document and ready-to-paste prompt
- Save to Supabase Storage bucket (`handoffs`)
- Copy-to-clipboard with visual feedback
- Self-maintenance handoff labeling
- Reads `docs/idiosyncrasies.md` for context
- **Status:** ✅ Working (path breaks in packaged builds — known bug)

### 2.9 Build metadata and auto-update
- Build-time injection of version, commit SHA, commit date, release channel
- Top bar displays version info
- Auto-updater configured for GitHub Releases
- `autoDownload = false` — user decides when to download
- Update banner with download progress and restart prompt
- **Status:** ✅ Working (auto-update not tested end-to-end with real release)

### 2.10 UI layout (updated by Component 10)
- **New shell layout:** TopBar → ProjectHeader → (LeftRail + PanelWorkspace + EvidenceRail) → BottomBar
- Left rail with 8 navigation sections: Projects, Missions, Environments, Deploys, Incidents, Memory Packs, Capabilities, Audit/Rollback
- Project header below top bar showing active project, environment badge, mission status, deploy status, pending approvals, unhealthy capabilities
- 9-panel collapsible mission workspace: Mission, Plan, Context, Change, Evidence, Environment, Capabilities, Watch, Audit
- Right evidence rail with placeholder for live checks, evidence items, tool calls, risk alerts
- Error boundary component for graceful failure handling
- Persistent UI state hook ([`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts)) using localStorage
- Global CSS reset preventing overflow issues
- Flex layout with proper `minHeight: 0` constraints
- Legacy screens (ProjectListScreen, ModesScreen, DevOpsScreen, SshScreen, ConversationScreen) preserved and accessible
- **Status:** ✅ Shell scaffolding delivered — see §3.1 for residual cleanup items

### 2.11 Component 10 new files
The following files were added by Component 10:

| File | Purpose |
|---|---|
| [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) | Left navigation rail (8 sections) |
| [`ProjectHeader.tsx`](../apps/desktop/src/renderer/components/ProjectHeader.tsx) | Project header with status badges |
| [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) | 9-panel collapsible mission workspace |
| [`EvidenceRail.tsx`](../apps/desktop/src/renderer/components/EvidenceRail.tsx) | Right evidence rail |
| [`ErrorBoundary.tsx`](../apps/desktop/src/renderer/components/ErrorBoundary.tsx) | Error handling wrapper |
| [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) | Persistent UI state hook |
| [`MissionPanel.tsx`](../apps/desktop/src/renderer/components/panels/MissionPanel.tsx) | Mission panel (placeholder) |
| [`PlanPanel.tsx`](../apps/desktop/src/renderer/components/panels/PlanPanel.tsx) | Plan panel (placeholder) |
| [`ContextPanel.tsx`](../apps/desktop/src/renderer/components/panels/ContextPanel.tsx) | Context panel (placeholder) |
| [`ChangePanel.tsx`](../apps/desktop/src/renderer/components/panels/ChangePanel.tsx) | Change panel (placeholder) |
| [`EvidencePanel.tsx`](../apps/desktop/src/renderer/components/panels/EvidencePanel.tsx) | Evidence panel (placeholder) |
| [`EnvironmentPanel.tsx`](../apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx) | Environment panel (placeholder) |
| [`CapabilitiesPanel.tsx`](../apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx) | Capabilities panel (placeholder) |
| [`WatchPanel.tsx`](../apps/desktop/src/renderer/components/panels/WatchPanel.tsx) | Watch panel (placeholder) |
| [`AuditPanel.tsx`](../apps/desktop/src/renderer/components/panels/AuditPanel.tsx) | Audit panel (placeholder) |

---

## 3. What does not work, is disabled, or needs cleanup

### 3.1 Component 10 residual cleanup — REQUIRED BEFORE COMPONENT 22

Component 10 shell scaffolding is delivered but has three residual issues that must be resolved in a short cleanup pass.

**Cleanup item 1: Duplicated chrome in legacy fallback path**
- [`App.tsx`](../apps/desktop/src/renderer/App.tsx:117) renders [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) inside the new shell for non-mission left-rail sections.
- [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx:50) still renders its own [`TopBar.tsx`](../apps/desktop/src/renderer/components/TopBar.tsx) (line 50) and [`BottomBar.tsx`](../apps/desktop/src/renderer/components/BottomBar.tsx) (line 204).
- The outer shell already provides both bars, so the user sees doubled chrome.
- **Severity:** Visible UI bug. Must fix.

**Cleanup item 2: Persistent UI state only partially wired**
- [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) exists and persists to localStorage correctly.
- [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx:32) keeps collapse state in local `useState` — does not use `useUiState`.
- [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx:32) keeps collapsed state in local `useState` — does not use `useUiState`.
- Panel and rail collapse state resets on navigation or app restart.
- **Severity:** UX annoyance now; state model inconsistency for Component 22 sync.

**Cleanup item 3: Mission workspace conversation integration incomplete**
- The mission workspace is scaffolded with a placeholder [`MissionPanel.tsx`](../apps/desktop/src/renderer/components/panels/MissionPanel.tsx).
- The current conversation experience is still reached only through the legacy fallback path ([`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) → [`ConversationScreen.tsx`](../apps/desktop/src/renderer/screens/ConversationScreen.tsx)).
- The conversation is not integrated as a subview within the mission workspace panels.
- **Severity:** Two disconnected navigation models. Compounds when Component 22 adds mission-level sync.

**Estimated cleanup effort:** Small — 3 files modified, no new IPC, no new dependencies, no data model changes.

### 3.2 Cloud sync — DISABLED
- [`initSyncEngine()`](../apps/desktop/src/main/index.ts) is a no-op
- All sync IPC handlers return stub values
- Sync indicator permanently shows 🔴 Offline
- Supabase migration SQL not run
- Sync engine needs adaptation from `better-sqlite3` to sql.js API
- **Impact:** No multi-device sync, no cloud backup, data loss risk if local file corrupted
- **Blocking:** Component 22 (Sync) cannot be properly evolved until this is fixed

### 3.3 Multi-mode orchestration — NOT IMPLEMENTED
- The Orchestrator calls OpenRouter directly as a single streaming chat
- No task analysis, no mode delegation, no result collection
- No plan decomposition, no structured outputs
- All 6 modes exist in the database but only the Orchestrator is used
- **Impact:** The product behaves as a single-model chat, not a multi-agent system
- **Blocking:** Component 12 (Agent Orchestration) is the replacement

### 3.4 MCP integration — NOT IMPLEMENTED
- `packages/mcp-manager/` has a README stub only
- No MCP server connections, no tool discovery, no tool execution
- No MCP UI screen
- **Impact:** Cannot connect to external tools or services via MCP
- **Blocking:** Component 14 (Capability Fabric) will implement this

### 3.5 Project intelligence — NOT IMPLEMENTED
- No codebase indexing, no symbol graph, no impact analysis
- No context pack assembly, no context dashboard
- No framework/stack detection
- **Impact:** AI operates without project-aware context
- **Blocking:** Component 11 (Project Intelligence) will implement this

### 3.6 Automated tests — NONE
- Test plan exists ([`docs/test-plan.md`](../docs/test-plan.md)) but no tests written
- No test runner configured
- **Impact:** No regression safety net for brownfield evolution
- **Blocking:** Phase 0 stabilization must establish test infrastructure

### 3.7 Packaged build — NOT VERIFIED
- Only tested via `pnpm dev`
- Handoff path and `.env` loading will break in packaged builds
- sql.js WASM bundling not verified
- keytar native module not verified in packaged context
- **Impact:** Cannot distribute the app to users
- **Blocking:** Phase 0 stabilization should fix known path issues

---

## 4. Gap analysis: current state vs. master spec

This table maps each master spec requirement to the current state.

| Master Spec Requirement | Current State | Gap Severity |
|---|---|---|
| Mission-centric interface | Shell scaffolded with mission workspace; conversation still via legacy path | 🟡 Major (was 🔴 Critical) |
| Left rail navigation | 8-section left rail delivered | ✅ Complete (scaffolding) |
| Project header with status badges | Delivered with placeholder data | ✅ Complete (scaffolding) |
| Multi-panel workspace | 9 collapsible panels delivered as placeholders | ✅ Complete (scaffolding) |
| Evidence rail | Right rail delivered with placeholder | ✅ Complete (scaffolding) |
| Persistent UI state | Hook exists but not wired to PanelWorkspace/LeftRail | 🟡 Major (cleanup item) |
| Structured plans with steps, assumptions, risk | Plan panel placeholder exists; no plan logic | 🔴 Critical |
| Context packs with quality dashboard | Context panel placeholder exists; no context system | 🔴 Critical |
| Capability fabric with MCP first-class | Capabilities panel placeholder exists; no MCP, no registry | 🔴 Critical |
| Evidence-based trust (not confidence theater) | Evidence panel placeholder exists; no evidence capture | 🔴 Critical |
| Semantic change grouping | Change panel placeholder exists; raw file diffs only | 🔴 Critical |
| Isolated execution workspaces | Direct file operations | 🔴 Critical |
| Layered verification system | No verification layers | 🔴 Critical |
| Environment model (local/preview/staging/prod) | Environment panel placeholder exists; flat DevOps config | 🟡 Major |
| Service topology map | No topology model | 🟡 Major |
| Secrets/config inventory | keytar for 3 keys, no inventory | 🟡 Major |
| Migration safety classification | No migration awareness | 🟡 Major |
| Post-deploy watch mode | Watch panel placeholder exists; health check exists but no watch mode | 🟡 Major |
| Incident detection and response | Incidents nav item exists; no incident model | 🟡 Major |
| Memory packs / decision knowledge | Memory Packs nav item exists; no memory system | 🟡 Major |
| Multi-model orchestration with role routing | Single-model streaming | 🟡 Major |
| Risk classification beyond 3 tiers | Audit panel placeholder exists; 3-tier approval works | 🟢 Partial |
| Second-model review | Working via Gemini Flash | 🟢 Partial |
| Human approval with plain-English explanation | Working approval cards | 🟢 Partial |
| Cloud sync from day one | Disabled but implemented | 🟢 Partial |
| Handoff to fresh AI session | Working handoff system | 🟢 Partial |
| Build metadata always visible | Working in top bar | ✅ Complete |
| Auto-update mechanism | Configured, not end-to-end tested | ✅ Complete |
| Electron shell with IPC security | Working correctly | ✅ Complete |
| Local tooling (files, terminal, git, SSH) | Working correctly | ✅ Complete |
| DevOps templates and clients | Working correctly | ✅ Complete |
| Mode system with soul/model config | Working correctly | ✅ Complete |
| OpenRouter as primary AI provider | Working correctly | ✅ Complete |
| GitHub OAuth authentication | Working correctly | ✅ Complete |

---

## 5. Strengths

### 5.1 Correct architectural foundation
The Electron main/preload/renderer split is sound. The IPC security boundary is properly enforced. The preload bridge exposes a typed API. This is the right foundation for the target product.

### 5.2 Working tooling services
File, terminal, git, and SSH services are clean, focused, and correctly isolated in the main process. They are ready to be wrapped as registered capabilities.

### 5.3 Working approval system
The 3-tier approval model with second-model review matches the target design. It needs expansion (more risk dimensions, persistent audit log) but the core pattern is correct.

### 5.4 Working DevOps clients
GitHub Actions, Coolify, and health check clients work. They need integration with the environment model and capability fabric but the underlying implementations are sound.

### 5.5 Comprehensive documentation
The repo has thorough documentation: architecture reference, decisions log, idiosyncrasies tracking, risks assessment, handoff process, approval policy, DevOps templates, and more. This is unusual for an MVP and is a genuine asset for the rebuild.

### 5.6 Sync engine fully implemented
The 501-line sync engine with device registration, lease/heartbeat, Supabase Realtime, and conflict resolution is a high-value asset that needs adaptation, not replacement.

### 5.7 Clean type system
The shared types are well-structured with proper TypeScript interfaces. They have been extended with additive shell domain types (Mission, Plan, ContextPack, EvidenceItem, Capability, Incident, DeployCandidate, Environment, etc.) by Component 10. The existing types are sound.

### 5.8 Shell scaffolding in place
Component 10 delivered the full shell scaffolding: left rail, project header, panel workspace, evidence rail, error boundary, and persistent UI state hook. All 9 master-spec panel surfaces exist as placeholders ready for subsequent components to populate with real data. This is a significant structural asset — every future component has a rendering target.

---

## 6. Risks

### 6.1 Active risks (from [`docs/risks.md`](../docs/risks.md))

| ID | Risk | Status |
|---|---|---|
| R1 | Cloud sync disabled — no backup, no multi-device | 🔴 Active |
| R2 | Local database fragility (sql.js in-memory + flush) | ⚠️ Active |
| R3 | Packaged build not verified | ⚠️ Active |
| R4 | Auto-update only partially verified | ⚠️ Active |
| R5 | Multi-device sync not proven in practice | ⚠️ Active |
| R6 | UI layout regressions (fragile flex/overflow fixes) | ⚠️ Active |
| R7 | Supabase Realtime reliability for lease/heartbeat | ⚠️ Theoretical |
| R8 | OpenRouter API changes | ⚠️ Theoretical |
| R9 | Self-maintenance mode risk | ⚠️ Mitigated |
| R10 | Main process file size (959 lines) | ⚠️ Technical debt |
| R11 | Orchestrator intelligence is basic | 🔴 Active |

### 6.2 Rebuild-specific risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brownfield evolution accidentally breaks working features | Medium | High | Test infrastructure in Phase 0; strangler pattern |
| AI builder drifts toward greenfield rewrite | Medium | High | Reuse matrix gating; salvage audit required |
| Component 10 residual cleanup delays Component 22 | Low | Medium | Cleanup is small (3 files, no new IPC); assign as single Builder task |
| exFAT constraint complicates package management | Certain | Medium | Continue Vite resolveId workaround |
| Context window limits during long component builds | Medium | Medium | Handoff protocol; session continuity |
| Sync re-enablement reveals hidden bugs | Medium | Medium | Test with two devices before proceeding |

---

## 7. Known constraints

### 7.1 exFAT drive — no symlinks
The D: drive is formatted exFAT, which does not support symlinks. pnpm `workspace:*` deps cannot be used. Source files from `packages/` are copied into `apps/desktop/src/lib/`. This constraint persists throughout the rebuild.

### 7.2 sql.js instead of better-sqlite3
The app uses sql.js (pure JavaScript SQLite) instead of better-sqlite3 (native). This is potentially permanent. The API is less ergonomic (array-based results instead of `prepare().get()`) but it works reliably on all platforms without native compilation.

### 7.3 Supabase migration not run
The Supabase migration SQL ([`docs/supabase-migration-m4.sql`](../docs/supabase-migration-m4.sql)) has not been run. Cloud tables for conversations, messages, and conversation_leases do not exist yet. This must be resolved before sync can be re-enabled.

### 7.4 No test infrastructure
No test runner is configured. No tests exist. This must be resolved in Phase 0 before brownfield evolution begins.

### 7.5 Single monolithic main process
[`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) is 959 lines containing all IPC handlers. This must be split in Phase 0 before the rebuild adds more handlers.

---

## 8. File inventory summary

### Source files with implementation

| Directory | Files | Total Lines (approx) | Purpose |
|---|---|---|---|
| `apps/desktop/src/main/` | 1 | 959 | Main process + all IPC handlers |
| `apps/desktop/src/preload/` | 1 | 166 | Preload bridge |
| `apps/desktop/src/renderer/screens/` | 7 | ~1,550 | Full-page screens |
| `apps/desktop/src/renderer/components/` | 12 | ~1,100 | Reusable components (6 original + 6 from C10) |
| `apps/desktop/src/renderer/components/panels/` | 9 | ~450 | Panel placeholder components (all from C10) |
| `apps/desktop/src/renderer/hooks/` | 1 | ~106 | useUiState hook (from C10) |
| `apps/desktop/src/renderer/` (root) | 4 | ~170 | App root (refactored by C10), entry, HTML, types |
| `apps/desktop/src/lib/storage/` | 4 | ~540 | LocalDb, Supabase client, types |
| `apps/desktop/src/lib/sync/` | 1 | 501 | Sync engine (disabled) |
| `apps/desktop/src/lib/orchestrator/` | 1 | 87 | Single-model streaming |
| `apps/desktop/src/lib/modes/` | 1 | ~100 | Default mode definitions |
| `apps/desktop/src/lib/approval/` | 2 | ~180 | Approval engine + logger |
| `apps/desktop/src/lib/tooling/` | 4 | ~380 | File, terminal, git, SSH services |
| `apps/desktop/src/lib/devops/` | 4 | ~260 | Templates, GitHub Actions, Coolify, health |
| `apps/desktop/src/lib/handoff/` | 2 | ~180 | Generator + storage |
| `apps/desktop/src/lib/updater/` | 1 | ~60 | Auto-updater |
| `apps/desktop/src/lib/build-metadata/` | 1 | ~20 | Build metadata export |
| `apps/desktop/src/lib/shared-types/` | 3 | ~450 | TypeScript interfaces (extended by C10 with shell domain types) |
| **Total** | **~59 source files** | **~7,250 lines** | |

### Package stubs (README only, no implementation)

| Package | Status |
|---|---|
| `packages/core-orchestrator/` | README stub |
| `packages/mode-system/` | README stub |
| `packages/providers/` | README stub |
| `packages/sync/` | README stub |
| `packages/tooling/` | README stub |
| `packages/git-manager/` | README stub |
| `packages/ssh-manager/` | README stub |
| `packages/mcp-manager/` | README stub |
| `packages/devops/` | README stub |
| `packages/handoff/` | README stub |
| `packages/approval/` | README stub |

### Packages with compiled source

| Package | Status |
|---|---|
| `packages/shared-types/` | Compiled TypeScript (canonical source) |
| `packages/storage/` | Compiled TypeScript (canonical source) |
| `packages/build-metadata/` | Compiled TypeScript (canonical source) |

---

## 9. Domain object coverage

This table shows which domain objects from the master spec (§10) exist in the current codebase.

| Domain Object | Exists? | Where | Completeness |
|---|---|---|---|
| Workspace | ❌ No | — | Not started |
| Project | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Basic (id, name, description, isSelfMaintenance) |
| Mission | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Plan | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Context Pack | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Capability | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Change Set | ❌ No | — | Not started |
| Evidence Item | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Approval Request | ✅ Partial | [`approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) | ActionRequest exists with description, reason, affected resources, rollback difficulty |
| Deploy Candidate | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Incident | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| Environment | ✅ Type only | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Type defined by C10; no persistence, no IPC, no logic |
| ConversationThread | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (id, projectId, title, runState, ownership, lease) |
| Message | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (id, conversationId, role, content, modeId, modelId) |
| ExecutionEvent | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Basic (mode-start, mode-end, tool-call, tool-result, thinking, info) |
| Mode | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (slug, name, soul, modelId, temperature, approvalPolicy) |
| OpenRouterModel | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (id, name, contextLength, pricing, supportsTools) |
| Device | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (id, userId, name, lastSeenAt) |
| ProjectDevOpsConfig | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (templateId, github, coolify, health) |
| DeployRun | ✅ Yes | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | Full (status, commitSha, triggeredBy) |

**Summary:** Component 10 added TypeScript type definitions for 7 previously missing domain objects (Mission, Plan, ContextPack, Capability, EvidenceItem, DeployCandidate, Incident, Environment). These are type-only — no persistence, IPC, or business logic yet. The existing fully-implemented objects (Project, ConversationThread, Message, Mode, etc.) are preserved and unchanged.

---

## 10. Recommended next action

**Component 10 cleanup pass**, then **Component 22 (Sync, Collaboration, and Persistent State)**.

Component 10 is implemented. The shell scaffolding is in place. Three residual cleanup items must be resolved before Component 22 begins:

1. **Fix duplicated chrome** — remove TopBar/BottomBar from [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) when rendered inside the new shell
2. **Wire persistent UI state** — connect [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) and [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) to [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts)
3. **Integrate conversation into mission workspace** — embed or link the existing conversation UI within the Mission panel so users don't need to switch navigation models

**Recommendation: Do NOT begin Component 22 until the cleanup pass is complete.** The cleanup is small (estimated: 3 files, no new IPC, no new dependencies) but the duplicated chrome is a visible bug and the disconnected navigation models will compound when sync is added.

Phase 0 stabilization tasks (main process split, test infrastructure, packaged build fixes, sync re-enablement) remain outstanding and should be addressed in parallel or immediately after the cleanup pass, before Component 22 implementation begins.
