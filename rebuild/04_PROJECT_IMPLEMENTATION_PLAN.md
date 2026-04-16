# 04 — Project Implementation Plan

Version: 1.1
Status: Binding planning document for the VibeFlow brownfield rebuild
Date: 2026-04-14 (v1.1 updated after Component 10 post-implementation audit)
Author: Architect (`anthropic/claude-opus-4.6`)
Governing specs: [`00_MASTER_SPEC.md`](00_MASTER_SPEC.md), [`01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md`](01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md), [`02_DEVOPS_OWNERSHIP_CHARTER.md`](02_DEVOPS_OWNERSHIP_CHARTER.md), [`03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md`](03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md)

---

## 1. Problem statement

VibeFlow has a working MVP (10 milestones complete) that proves the Electron shell, conversation UI, mode system, approval engine, tooling services, DevOps subsystem, handoff system, and build metadata pipeline. However, the current system is a **conversation-centric chat IDE** — it does not yet implement the target product described in the master spec: a **supervised software-building operating system** with missions, plans, evidence, verification, environments, capabilities, memory, and full DevOps lifecycle coverage.

The gap between the current MVP and the target system is large. The rebuild specs define 13 runtime components (numbered 10–22) that must be implemented in a fixed order. The brownfield mandate requires that existing code be preserved, adapted, or refactored — not casually rewritten.

---

## 2. Solution overview

Evolve the existing VibeFlow codebase through a **brownfield component-by-component build** following the fixed implementation order. Each component gets a salvage audit, reuse matrix, contract-first design, implementation, tests, and gap analysis before the next component begins.

The approach is:
1. **Stabilize the existing shell** — fix packaging bugs, split the monolithic main process, establish test infrastructure.
2. **Evolve the shell into the target product** — component by component, in the fixed order, with each component building on the previous.
3. **Never break what works** — the app must remain launchable and functional throughout the rebuild.

---

## 3. Fixed component implementation order

The master spec and handoff protocol define this fixed order. The numbers reference the component spec files in [`rebuild/`](.).

| Phase | Component # | Component Name | Spec File |
|---|---|---|---|
| 1 | 10 | Product Shell and AI-Native Workspace | [`10_PRODUCT_SHELL_AND_AI_NATIVE_WORKSPACE.md`](10_PRODUCT_SHELL_AND_AI_NATIVE_WORKSPACE.md) |
| 2 | 22 | Sync, Collaboration, and Persistent State | [`22_SYNC_COLLABORATION_AND_PERSISTENT_STATE.md`](22_SYNC_COLLABORATION_AND_PERSISTENT_STATE.md) |
| 3 | 12 | Agent Orchestration and Mode System | [`12_AGENT_ORCHESTRATION_AND_MODE_SYSTEM.md`](12_AGENT_ORCHESTRATION_AND_MODE_SYSTEM.md) |
| 4 | 14 | Capability Fabric, MCP, and Tool Connectors | [`14_CAPABILITY_FABRIC_MCP_AND_TOOL_CONNECTORS.md`](14_CAPABILITY_FABRIC_MCP_AND_TOOL_CONNECTORS.md) |
| 5 | 11 | Project Intelligence and Context System | [`11_PROJECT_INTELLIGENCE_AND_CONTEXT_SYSTEM.md`](11_PROJECT_INTELLIGENCE_AND_CONTEXT_SYSTEM.md) |
| 6 | 13 | Change Engine and Code Operations | [`13_CHANGE_ENGINE_AND_CODE_OPERATIONS.md`](13_CHANGE_ENGINE_AND_CODE_OPERATIONS.md) |
| 7 | 19 | Approval, Risk, Audit, and Rollback | [`19_APPROVAL_RISK_AUDIT_AND_ROLLBACK.md`](19_APPROVAL_RISK_AUDIT_AND_ROLLBACK.md) |
| 8 | 15 | Runtime Execution, Debugging, and Evidence | [`15_RUNTIME_EXECUTION_DEBUGGING_AND_EVIDENCE.md`](15_RUNTIME_EXECUTION_DEBUGGING_AND_EVIDENCE.md) |
| 9 | 16 | Verification and Acceptance System | [`16_VERIFICATION_AND_ACCEPTANCE_SYSTEM.md`](16_VERIFICATION_AND_ACCEPTANCE_SYSTEM.md) |
| 10 | 18 | Secrets, Config, Database, and Migration Safety | [`18_SECRETS_CONFIG_DATABASE_AND_MIGRATION_SAFETY.md`](18_SECRETS_CONFIG_DATABASE_AND_MIGRATION_SAFETY.md) |
| 11 | 17 | Environments, Deployments, and Service Control Plane | [`17_ENVIRONMENTS_DEPLOYMENTS_AND_SERVICE_CONTROL_PLANE.md`](17_ENVIRONMENTS_DEPLOYMENTS_AND_SERVICE_CONTROL_PLANE.md) |
| 12 | 21 | Observability, Incident Response, and Self-Healing | [`21_OBSERVABILITY_INCIDENT_RESPONSE_AND_SELF_HEALING.md`](21_OBSERVABILITY_INCIDENT_RESPONSE_AND_SELF_HEALING.md) |
| 13 | 20 | Memory, Skills, and Decision Knowledge | [`20_MEMORY_SKILLS_AND_DECISION_KNOWLEDGE.md`](20_MEMORY_SKILLS_AND_DECISION_KNOWLEDGE.md) |

---

## 4. Pre-implementation stabilization (Phase 0)

Before starting Component 10, the following stabilization work is required. This is not a rewrite — it is fixing known bugs and establishing the foundation for safe brownfield evolution.

### 4.1 Split [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) into domain handler files

The 959-line monolithic main process must be split before the rebuild adds more IPC handlers. This is a mechanical refactor with no behavior change.

**Target structure:**
```
apps/desktop/src/main/
├── index.ts              ← App lifecycle, window creation, handler registration
├── handlers/
│   ├── auth.ts
│   ├── projects.ts
│   ├── modes.ts
│   ├── openrouter.ts
│   ├── conversations.ts
│   ├── sync.ts
│   ├── tooling.ts
│   ├── devops.ts
│   ├── approval.ts
│   ├── handoff.ts
│   └── updater.ts
```

### 4.2 Fix packaged-build path issues

- Fix handoff path for packaged builds (use `app.isPackaged` + `app.getAppPath()`)
- Fix `.env` loading for packaged builds (embed public Supabase values at build time)

### 4.3 Establish test infrastructure

- Add Vitest as the test runner
- Write initial tests for [`local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts), [`approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts), [`handoff-generator.ts`](../apps/desktop/src/lib/handoff/handoff-generator.ts), [`file-service.ts`](../apps/desktop/src/lib/tooling/file-service.ts)
- These tests become the regression safety net for brownfield evolution

### 4.4 Re-enable cloud sync

- Run Supabase migration SQL ([`docs/supabase-migration-m4.sql`](../docs/supabase-migration-m4.sql))
- Adapt [`sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) for sql.js API
- Re-implement [`initSyncEngine()`](../apps/desktop/src/main/index.ts) with real SyncEngine
- Test with two devices

This is required before Component 22 (Sync) can be properly evolved.

---

## 5. Per-component implementation protocol

For each component in the fixed order, the AI builder must follow this protocol (derived from [`03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md`](03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md)):

### Step 1: Salvage audit
- Inventory existing files relevant to this component
- Classify each as: keep as-is / keep with adapter / refactor in place / extract into boundary / replace
- Document why for each decision

### Step 2: Reuse matrix
- Produce the gating reuse matrix (see [`01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md`](01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md) §5)
- No coding until the matrix exists

### Step 3: Contract-first design
- Restate scope, non-goals, required data model, required UI surfaces, required tests, required event logs
- List assumptions and unknowns
- Produce interface contracts before implementation

### Step 4: Implementation
- Build incrementally, preserving existing behavior under tests
- Follow strangler-pattern transitions where wrapping old code
- Run immediate validity checks after each meaningful change

### Step 5: Verification
- Tests for preserved behavior (regression)
- Tests for new behavior
- UI smoke tests where relevant
- Gap analysis against the component spec and master spec

### Step 6: Anti-drift checklist
Answer all questions from [`03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md`](03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md) §5:
- Did I reuse or adapt existing VibeFlow code before inventing new structure?
- Did I build for missions rather than files?
- Did I preserve transparency without requiring programmer workflows?
- Did I make MCP/capabilities first-class?
- Did I attach evidence rather than confidence theater?
- Did I classify risk and approvals?
- Did I keep Git beneath the product surface?
- Did I avoid turning the shell back into VS Code?

---

## 6. Component 10 — Product Shell (IMPLEMENTED)

### Why Component 10 was first

Component 10 (Product Shell and AI-Native Workspace) was the correct starting point because:
1. It is the **visible container** for all other components — every subsequent component needs panels, navigation, and state surfaces that the shell provides.
2. The existing shell ([`App.tsx`](../apps/desktop/src/renderer/App.tsx), screens, components) was the **strongest salvage candidate** — it worked, it had the right Electron/React/IPC architecture, and it needed evolution not replacement.
3. The master spec's UI model (mission panel, plan panel, context panel, change panel, evidence panel, environment panel, capabilities panel, watch panel, audit panel) must exist as at least placeholder surfaces before the runtime components can render into them.

### What was delivered

Component 10 shell scaffolding is **implemented**. The following artifacts now exist:

| Deliverable | Status | File(s) |
|---|---|---|
| Left rail navigation (8 sections) | ✅ Delivered | [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) |
| Project header below top bar | ✅ Delivered | [`ProjectHeader.tsx`](../apps/desktop/src/renderer/components/ProjectHeader.tsx) |
| Multi-panel mission workspace (9 panels) | ✅ Delivered | [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) |
| Right evidence rail | ✅ Delivered | [`EvidenceRail.tsx`](../apps/desktop/src/renderer/components/EvidenceRail.tsx) |
| Additive shell domain types | ✅ Delivered | [`entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) |
| Placeholder panels (Mission, Plan, Context, Change, Evidence, Environment, Capabilities, Watch, Audit) | ✅ Delivered | [`panels/`](../apps/desktop/src/renderer/components/panels/) |
| Persistent UI state hook | ✅ Partial | [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) |
| Error boundary | ✅ Delivered | [`ErrorBoundary.tsx`](../apps/desktop/src/renderer/components/ErrorBoundary.tsx) |
| Shell layout in App.tsx | ✅ Delivered | [`App.tsx`](../apps/desktop/src/renderer/App.tsx) |

The work stayed mostly in scope and broadly respected reuse. DevOps A-to-Z surfaces (environment, capabilities, watch panels) now exist as placeholders, which is acceptable for Component 10.

### What Component 10 must NOT have done (verified)

- ✅ Did not replace the working Electron shell
- ✅ Did not rewrite the IPC layer
- ✅ Did not change the preload security boundary
- ✅ Did not introduce new dependencies without justification
- ✅ Did not remove working screens before replacements exist

---

## 6.1. Component 10 cleanup pass (REQUIRED before Component 22)

The post-implementation audit identified three residual issues that must be resolved in a short cleanup pass before Component 22 begins. These are not new features — they are incomplete aspects of Component 10's own requirements.

### Cleanup item 1: Duplicated chrome in legacy fallback path

**Problem:** [`App.tsx`](../apps/desktop/src/renderer/App.tsx:117) renders the legacy [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) inside the new shell for non-mission left-rail sections. But [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx:50) still renders its own [`TopBar.tsx`](../apps/desktop/src/renderer/components/TopBar.tsx) (line 50) and [`BottomBar.tsx`](../apps/desktop/src/renderer/components/BottomBar.tsx) (line 204). The outer shell already provides both, so the user sees duplicated top bars and bottom bars when navigating to non-mission sections.

**Fix:** Remove the `TopBar` and `BottomBar` renders from inside [`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) when it is used as a child of the new shell layout. Either strip them from `ProjectScreen` entirely (since the shell now owns chrome) or pass a prop to suppress them.

**Risk if skipped:** Visible UI bug — doubled chrome bars. Confusing for users and reviewers.

### Cleanup item 2: Persistent UI state only partially wired

**Problem:** [`useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) exists and correctly persists to localStorage. It exposes `setPanelCollapsed()` and `setLeftRailCollapsed()`. However:
- [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx:32) keeps collapse state in local `useState` and does not read from or write to `useUiState`.
- [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx:32) keeps its own `collapsed` state in local `useState` and does not read from or write to `useUiState`.

The Component 10 spec required persistent panel layout and collapse state. The hook exists but is not connected to the components that need it.

**Fix:** Wire [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) and [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) to use `useUiState` for their collapse state instead of local `useState`.

**Risk if skipped:** Panel and rail collapse state resets on every navigation or app restart. Minor UX annoyance now, but becomes a real problem when Component 22 adds sync — the state model will be inconsistent.

### Cleanup item 3: Mission workspace conversation integration incomplete

**Problem:** The mission workspace is scaffolded with a placeholder [`MissionPanel.tsx`](../apps/desktop/src/renderer/components/panels/MissionPanel.tsx), but the current conversation experience is still reached only through the legacy fallback path ([`ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx) → [`ConversationScreen.tsx`](../apps/desktop/src/renderer/screens/ConversationScreen.tsx)). The conversation is not yet integrated as a subview within the mission workspace panels.

**Fix:** The Mission panel should embed or link to the existing conversation UI so that when a user selects "Missions" in the left rail, they can access conversations within the panel workspace rather than needing to navigate to a different left-rail section that falls through to the legacy screen.

**Risk if skipped:** The new shell layout and the legacy conversation path remain disconnected. Users must mentally switch between two navigation models. This will compound when Component 22 adds mission-level sync.

### Cleanup pass scope

- **Estimated effort:** Small — 3 files modified, no new IPC, no new dependencies, no data model changes.
- **Builder assignment:** Single Builder task with clear acceptance criteria for each item.
- **Gating:** Component 22 should not begin until all three cleanup items are resolved and smoke-tested.

---

## 7. Component dependency map

```
Phase 0: Stabilization
  ↓
Component 10: Product Shell ← IMPLEMENTED (cleanup pass required)
  ↓
Component 10 Cleanup ← fix duplicated chrome, wire persistent state, integrate conversation into mission workspace
  ↓
Component 22: Sync ← provides persistent state for missions, plans, evidence
  ↓
Component 12: Agent Orchestration ← provides mission decomposition, role routing
  ↓
Component 14: Capability Fabric ← provides tool registry, MCP, health model
  ↓
Component 11: Project Intelligence ← provides context packs, symbol graphs, impact analysis
  ↓
Component 13: Change Engine ← provides isolated workspaces, semantic changes, checkpoints
  ↓
Component 19: Approval/Risk/Audit ← provides risk classification, rollback, audit chain
  ↓
Component 15: Runtime/Debug/Evidence ← provides runtime capture, browser automation, evidence
  ↓
Component 16: Verification ← provides layered verification, acceptance flows, deploy gating
  ↓
Component 18: Secrets/Config/DB ← provides config inventory, migration safety, secret management
  ↓
Component 17: Environments/Deploy ← provides environment model, deploy workflow, service topology
  ↓
Component 21: Observability ← provides post-deploy watch, incident detection, self-healing
  ↓
Component 20: Memory/Skills ← provides retrievable knowledge packs, decision memory
```

---

## 8. Validation approach

### Per-component validation
- Salvage audit reviewed before coding starts
- Reuse matrix approved before coding starts
- Contract interfaces reviewed before implementation
- Tests pass after implementation
- Gap analysis against component spec completed
- Anti-drift checklist answered

### Cross-component validation
- App remains launchable after every component
- Existing features do not regress (test suite)
- New panels render in the shell
- IPC contracts remain stable
- No silent data migration

### End-to-end validation (after all components)
- A non-programmer can create a mission and track it through the shell
- All primary panels show real state
- MCP connections are visible and manageable
- Evidence is captured and linked to missions
- Deployments are gated by verification and approval
- Rollback is available and auditable
- Memory packs can be retrieved selectively
- State survives restart and device change

---

## 9. Rollback plan

### Per-component rollback
- Every component implementation starts on a feature branch
- The main branch always has the last known-good state
- If a component implementation fails validation, the branch is abandoned and the component is re-attempted with a revised salvage audit
- Data migrations (if any) include forward and backward migration scripts

### Catastrophic rollback
- The pre-rebuild commit is tagged as `pre-rebuild-baseline`
- If the rebuild fundamentally fails, the codebase can be restored to this tag
- All rebuild planning documents in [`rebuild/`](.) are preserved regardless

---

## 10. Risks specific to this plan

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Component 10 shell evolution breaks existing screens | Medium | High | Strangler pattern: keep old screens until new panels proven |
| Sync re-enablement blocks Component 22 | Medium | High | Phase 0 sync work is prerequisite; if blocked, Component 22 works with local-only persistence |
| exFAT drive prevents workspace:* during rebuild | Certain | Medium | Continue using Vite resolveId plugin and TS paths; document in idiosyncrasies |
| AI builder drifts toward greenfield rewrite | Medium | High | Reuse matrix is a gating artifact; no coding without it |
| Main process split introduces regressions | Low | Medium | Split is mechanical; test each handler file individually |
| Context window limits during long component builds | Medium | Medium | Handoff protocol ensures continuity between sessions |

---

## 11. Success criteria

The rebuild is successful when:
1. All 13 runtime components are implemented and pass their acceptance criteria
2. The app remains a brownfield evolution — not a ground-up rewrite
3. A non-programmer can run serious software projects through it
4. A technical helper can inspect every important technical detail
5. AI mistakes are caught by system design rather than wishful prompting
6. Deployments are safer because evidence, approvals, and rollback are built in
7. The system remains legible to future AI builders because the architecture is explicit
8. The product feels like mission control for software creation rather than a text editor
