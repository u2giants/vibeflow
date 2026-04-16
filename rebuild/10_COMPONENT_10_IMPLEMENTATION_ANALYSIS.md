# Component 10 Implementation Analysis: Product Shell and AI-Native Workspace

---

## 1. Scope Summary

Component 10 is the **visible product shell** — the container that hosts all mission-centric panels, navigation, and state surfaces. It transforms the current conversation-centric chat IDE into a mission-centric operating console.

**What this component covers:**
- **Left rail navigation** with 8 sections: Projects, Missions, Environments, Deploys, Incidents, Memory Packs, Capabilities, Audit/Rollback
- **Project header** showing active project, environment, mission status, deploy status, pending approvals, unhealthy capabilities
- **Multi-panel mission workspace** with collapsible panels for: Mission, Plan, Context, Change, Evidence, Environment, Capabilities, Watch, Audit/Rollback
- **Right evidence rail** for live checks, evidence items, tool calls, risk alerts, context omissions, post-deploy watch state
- **Persistent UI state** (panel layout, collapse state, last active project)
- **Error handling** for lost connectivity, failed tools, stale state
- **New domain types**: Mission, Workspace, Environment, DeployCandidate, Incident, Capability
- **Evolution of existing screens**: `App.tsx`, `ProjectScreen.tsx`, `ConversationScreen.tsx`, `TopBar.tsx`, `BottomBar.tsx`, `ProjectListScreen.tsx`
- **New shared types** for Mission, Plan, ContextPack, EvidenceItem, Capability, Incident, DeployCandidate

**What this component does NOT cover (explicitly deferred):**
- Mission planning logic (Component 12: Agent Orchestration)
- Context pack assembly (Component 11: Project Intelligence)
- MCP server connections (Component 14: Capability Fabric)
- Change engine / isolated workspaces (Component 13: Change Engine)
- Verification layers (Component 16: Verification)
- Environment model persistence (Component 17: Environments/Deploy)
- Memory pack retrieval (Component 20: Memory/Skills)
- Incident detection (Component 21: Observability)
- Sync engine evolution (Component 22: Sync)
- Approval engine expansion (Component 19: Approval/Risk)
- Main process split (Phase 0 — prerequisite)
- Test infrastructure (Phase 0 — prerequisite)

---

## 2. Non-Goals

- **No mission planning or decomposition** — panels will show placeholder/empty state until Component 12 provides real data
- **No MCP server management** — Capabilities panel will show placeholder until Component 14
- **No real environment model** — Environment panel will show placeholder until Component 17
- **No real verification** — Evidence panel will show placeholder until Component 16
- **No memory system** — Memory Packs nav item will show placeholder until Component 20
- **No incident detection** — Incidents nav item will show placeholder until Component 21
- **No change engine** — Change panel will show placeholder until Component 13
- **No main process refactoring** — IPC layer stays as-is for now
- **No new dependencies** — only React, existing Electron, existing sql.js
- **No removal of working screens** — existing conversation UI remains accessible during transition

---

## 3. Salvage Audit of Existing VibeFlow Code

### 3.1 Files Relevant to Component 10

| File | Lines | Current Purpose | Classification | Reason |
|---|---|---|---|---|
| `App.tsx` | 111 | Root component, screen routing, auth state | **Refactor in place** | Already the root shell; needs new navigation model and panel layout. Auth state and screen routing are sound. |
| `ProjectScreen.tsx` | 208 | Project wrapper with conversation sidebar + 5-panel layout | **Refactor in place** | Already has the multi-panel layout pattern; sidebar needs evolution from "conversations" to "missions"; main area needs panel workspace. |
| `ConversationScreen.tsx` | 928 | Chat UI with streaming, execution stream, file viewer, terminal, git | **Keep with adapter** | The 5-panel layout, streaming, execution events, and file viewer are valuable. Will be adapted as the "Mission panel" content area. Not replaced — the conversation becomes one view within the mission workspace. |
| `TopBar.tsx` | 90 | Version, commit, sync status, email | **Refactor in place** | Needs to become the "Project header" with mission/deploy/approval status. Current build metadata and sync status display is preserved and extended. |
| `BottomBar.tsx` | 97 | Current mode, model, approval queue | **Keep with adapter** | Already shows mode/model/approval. Will be extended with environment and capability health indicators. |
| `ProjectListScreen.tsx` | 258 | Project list with create/self-maintenance | **Keep with adapter** | Works correctly. Will be the "Projects" view in the left rail. No structural changes needed. |
| `SignInScreen.tsx` | ~80 | GitHub OAuth sign-in | **Keep as-is** | No changes needed. |
| `UpdateBanner.tsx` | ~80 | Auto-update notification | **Keep as-is** | No changes needed. |
| `entities.ts` | 148 | All TypeScript interfaces | **Refactor in place** | Needs new types: Mission, Plan, ContextPack, EvidenceItem, Capability, Incident, DeployCandidate. Existing types preserved. |
| `ipc.ts` | 414 | IPC channel type definitions | **Keep with adapter** | Will grow with new IPC channels for missions, environments, etc. Existing channels preserved. |
| `ModesScreen.tsx` | ~250 | Mode editor | **Keep with adapter** | Remains accessible; deferred to Component 12 for evolution. |
| `DevOpsScreen.tsx` | ~400 | 4-tab DevOps UI | **Keep with adapter** | Remains accessible; deferred to Component 17 for evolution. |
| `SshScreen.tsx` | ~150 | SSH host management | **Keep with adapter** | Remains accessible; deferred to Component 14 for evolution. |
| `ApprovalCard.tsx` | ~100 | Human approval modal | **Keep with adapter** | Remains accessible; deferred to Component 19. |
| `ApprovalQueue.tsx` | ~80 | Approval queue indicator | **Keep with adapter** | Already used in BottomBar; preserved. |
| `HandoffDialog.tsx` | ~120 | Handoff generation modal | **Keep with adapter** | Remains accessible; deferred to Component 22. |
| `local-db.ts` | 489 | SQLite CRUD | **Keep with adapter** | Will need new tables for missions, etc. but that is Component 22's concern. For C10, we use in-memory/mock state. |
| `build-metadata/index.ts` | ~20 | Build metadata export | **Keep as-is** | Already used in TopBar; preserved. |

### 3.2 Reuse Matrix

| Existing File or Module | Current Purpose | Decision | Reason | Migration Impact |
|---|---|---|---|---|
| `App.tsx` | Root shell, screen routing | **Refactor in place** | Already the correct root; needs left rail + panel layout | Low — add new state, preserve auth flow |
| `ProjectScreen.tsx` | Project container with conversation sidebar | **Refactor in place** | Already has sidebar + content pattern; needs mission-centric sidebar and multi-panel workspace | Medium — restructure sidebar, add panel workspace |
| `ConversationScreen.tsx` | 5-panel chat UI | **Keep with adapter** | Valuable streaming/execution/file viewer; becomes mission content view | Low — wrap as one panel view, preserve all existing behavior |
| `TopBar.tsx` | Build metadata + sync status | **Refactor in place** | Needs to become project header with mission/deploy/approval status | Low — add new props, preserve existing displays |
| `BottomBar.tsx` | Mode/model/approval status | **Keep with adapter** | Already correct; extend with environment/capability health | Low — add optional props |
| `ProjectListScreen.tsx` | Project list | **Keep with adapter** | Works; becomes "Projects" left rail view | Low — no structural changes |
| `entities.ts` | TypeScript interfaces | **Refactor in place** | Add new domain types | Low — additive only |
| `ipc.ts` | IPC channel types | **Keep with adapter** | Add new channels later | Low — additive only |
| `local-db.ts` | SQLite persistence | **Keep with adapter** | New tables in later components | None for C10 — uses in-memory state |
| `SignInScreen.tsx` | Auth screen | **Keep as-is** | No changes | None |
| `UpdateBanner.tsx` | Update notification | **Keep as-is** | No changes | None |
| `ModesScreen.tsx` | Mode editor | **Keep with adapter** | Deferred to C12 | None for C10 |
| `DevOpsScreen.tsx` | DevOps UI | **Keep with adapter** | Deferred to C17 | None for C10 |
| `SshScreen.tsx` | SSH management | **Keep with adapter** | Deferred to C14 | None for C10 |

---

## 4. Proposed Implementation Plan

### Phase 1: New Domain Types (shared-types)
1. Add `Mission`, `MissionStatus`, `Plan`, `PlanStep`, `ContextPack`, `EvidenceItem`, `Capability`, `CapabilityHealth`, `Incident`, `IncidentSeverity`, `DeployCandidate`, `Environment`, `EnvironmentType` to `entities.ts`
2. All new types are additive — no existing type is modified or removed

### Phase 2: Left Rail Navigation Component
1. Create `apps/desktop/src/renderer/components/LeftRail.tsx`
2. 8 navigation items: Projects, Missions, Environments, Deploys, Incidents, Memory Packs, Capabilities, Audit/Rollback
3. Active state tracking, icon + label, plain-English nouns
4. Click handlers route to different views within the main content frame

### Phase 3: Project Header Component
1. Create `apps/desktop/src/renderer/components/ProjectHeader.tsx`
2. Shows: active project name, environment badge, mission status badge, deploy status badge, pending approval count, unhealthy capability count
3. Replaces current `TopBar.tsx` usage within project context
4. `TopBar.tsx` is preserved for non-project screens (sign-in, project list)

### Phase 4: Panel Workspace Component
1. Create `apps/desktop/src/renderer/components/PanelWorkspace.tsx`
2. Renders 9 collapsible panels: Mission, Plan, Context, Change, Evidence, Environment, Capabilities, Watch, Audit
3. Each panel has collapsed summary state and expanded investigative state
4. Panel layout is persisted via localStorage
5. Panels show placeholder/empty state with "Coming in [Component X]" labels

### Phase 5: Right Evidence Rail Component
1. Create `apps/desktop/src/renderer/components/EvidenceRail.tsx`
2. Shows: live checks, active evidence items, recent tool calls, risk alerts, context omissions, post-deploy watch state
3. Collapsible, with summary and expanded states
4. Placeholder state for now — real data comes from later components

### Phase 6: Refactor App.tsx
1. Replace current screen routing with left rail + main content frame layout
2. When in a project, show: ProjectHeader + LeftRail + MainContent + EvidenceRail + BottomBar
3. When on project list, show: TopBar + ProjectListScreen + BottomBar (current behavior preserved)
4. When on modes screen, show: TopBar + ModesScreen + BottomBar (current behavior preserved)

### Phase 7: Refactor ProjectScreen.tsx
1. Replace conversation sidebar with mission-centric sidebar
2. Keep conversation list as a sub-item under "Missions" in the sidebar
3. Main content area becomes PanelWorkspace
4. SSH and DevOps buttons remain accessible

### Phase 8: ConversationScreen Integration
1. Wrap ConversationScreen as one view within the mission workspace
2. Add a "Conversation" tab/panel within the Mission panel
3. All existing streaming, execution, file viewer, terminal, git behavior preserved

### Phase 9: Persistent UI State
1. Create `apps/desktop/src/renderer/hooks/useUiState.ts`
2. Persist: panel layout, collapse state, last active project, last active environment, left rail active section
3. Use localStorage for now (migrates to SQLite in Component 22)

### Phase 10: Error Handling
1. Create `apps/desktop/src/renderer/components/ErrorBoundary.tsx`
2. Handle: lost model connectivity, failed tool invocation, stale state, provider auth loss, MCP health failures, deploy uncertainty, sync conflicts
3. Every error shows: what failed, what was affected, what to do next, whether work is safe

---

## 5. Data Model, IPC, API, UI, State, and DevOps Implications

### Data Model
- **New types added to `entities.ts`** — all additive, no breaking changes
- **No database changes in C10** — all state is in-memory/localStorage
- **Database tables for new types** will be added in Component 22 (Sync)

### IPC
- **No new IPC channels in C10** — all panels use placeholder/mock data
- **IPC channels for missions, environments, capabilities, etc.** will be added in their respective components
- **Existing IPC channels** (auth, projects, conversations, modes, tooling, sync, approval, handoff, build-metadata) are preserved

### API
- **No new API calls in C10**
- **OpenRouter, Supabase, GitHub Actions, Coolify** clients are untouched

### UI
- **New components**: LeftRail, ProjectHeader, PanelWorkspace, EvidenceRail, ErrorBoundary, useUiState hook
- **Refactored components**: App.tsx, ProjectScreen.tsx, TopBar.tsx
- **Preserved components**: ConversationScreen.tsx (wrapped), ProjectListScreen.tsx, SignInScreen.tsx, BottomBar.tsx, UpdateBanner.tsx, ModesScreen.tsx, DevOpsScreen.tsx, SshScreen.tsx, ApprovalCard.tsx, ApprovalQueue.tsx, HandoffDialog.tsx
- **Layout**: Left rail (200px) + Main content (flex) + Right evidence rail (280px) + Top header + Bottom bar

### State
- **React state** for all panel data (placeholder for now)
- **localStorage** for UI preferences (panel layout, collapse state, last active project)
- **No global state manager** — React context will be used for shared state (active project, active mission)

### DevOps
- **No DevOps changes in C10** — environment panel, deploy panel, watch panel are placeholders
- **DevOps screens** (DevOpsScreen.tsx) remain accessible via sidebar button
- **No CI/CD changes**

---

## 6. Test Plan

### Unit Tests (when test infrastructure exists in Phase 0)
- `LeftRail.tsx`: renders 8 navigation items, active state updates on click
- `ProjectHeader.tsx`: renders project name, status badges, approval count
- `PanelWorkspace.tsx`: renders 9 panels, collapse/expand works, layout persists
- `EvidenceRail.tsx`: renders placeholder state, collapsible
- `useUiState.ts`: persists and restores panel layout, collapse state, last active project

### Integration Tests
- App.tsx: navigation between project list and project screen works
- ProjectScreen.tsx: sidebar navigation, panel workspace renders
- ConversationScreen.tsx: existing behavior preserved (streaming, file viewer, terminal)

### UI Smoke Tests
- App launches without errors
- All 8 left rail items are visible
- All 9 panels render (even if placeholder)
- Right evidence rail renders
- Project header shows project name
- Bottom bar shows mode/model
- Top bar shows build metadata
- Existing screens (Modes, DevOps, SSH) remain accessible

### Regression Tests
- Sign-in flow works
- Project list loads and creates projects
- Conversation creation and messaging works
- Mode system works
- Approval flow works
- Handoff dialog works
- Auto-update banner works

---

## 7. Rollback Plan

### Per-Component Rollback
- All changes on a feature branch
- If shell evolution breaks existing screens, abandon branch and retry with revised approach
- No data migration in C10 — no rollback of data needed
- All existing screens are preserved, not deleted

### Catastrophic Rollback
- Pre-rebuild commit tagged as `pre-rebuild-baseline`
- If shell fundamentally breaks, restore to baseline tag
- All rebuild planning documents preserved

### Strangler Pattern Safety
- Old screens (ProjectListScreen, ConversationScreen, ModesScreen, DevOpsScreen, SshScreen) are never deleted — only wrapped or repositioned
- If new navigation breaks, old screen routing can be restored by reverting `App.tsx` changes only

---

## 8. Risks and Approvals Required

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shell evolution breaks existing screens | Medium | High | Strangler pattern: keep all old screens; test each navigation path |
| Panel workspace is too complex for first iteration | Medium | Medium | Start with collapsed placeholder panels; expand incrementally |
| Left rail navigation conflicts with existing sidebar | Low | Medium | Use distinct visual styling; test side-by-side |
| Persistent UI state conflicts with future sync | Low | Low | Use localStorage for now; migrate to SQLite in C22 with clear migration path |
| exFAT drive prevents workspace:* deps | Certain | Low | Continue using Vite resolveId plugin and TS paths (existing workaround) |

### Approvals Required
- **Orchestrator approval**: This analysis and implementation plan
- **Architect approval**: New domain types in `entities.ts` (additive only, low risk)
- **Reviewer-Pusher approval**: Before any git push

---

## 9. Explicit List of What Will NOT Be Built Yet

| Item | Belongs To | Reason |
|---|---|---|
| Mission planning/decomposition logic | Component 12 | Requires agent orchestration |
| Context pack assembly | Component 11 | Requires project intelligence |
| MCP server connections | Component 14 | Requires capability fabric |
| Change engine / semantic diffs | Component 13 | Requires isolated workspaces |
| Verification layers | Component 16 | Requires verification system |
| Environment model persistence | Component 17 | Requires environments/deploy |
| Memory pack retrieval | Component 20 | Requires memory system |
| Incident detection | Component 21 | Requires observability |
| Sync engine evolution | Component 22 | Requires sync/collaboration |
| Approval engine expansion | Component 19 | Requires approval/risk/audit |
| Main process split | Phase 0 | Prerequisite stabilization |
| Test infrastructure | Phase 0 | Prerequisite stabilization |
| Real data bindings for panels | Components 11-22 | Each panel gets real data from its owning component |

---

## 10. File Change Summary (Predicted)

### New Files
| File | Purpose |
|---|---|
| `apps/desktop/src/renderer/components/LeftRail.tsx` | Left navigation rail |
| `apps/desktop/src/renderer/components/ProjectHeader.tsx` | Project header with status badges |
| `apps/desktop/src/renderer/components/PanelWorkspace.tsx` | Multi-panel mission workspace |
| `apps/desktop/src/renderer/components/EvidenceRail.tsx` | Right evidence rail |
| `apps/desktop/src/renderer/components/ErrorBoundary.tsx` | Error handling wrapper |
| `apps/desktop/src/renderer/hooks/useUiState.ts` | Persistent UI state hook |
| `apps/desktop/src/renderer/components/panels/MissionPanel.tsx` | Mission panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/PlanPanel.tsx` | Plan panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/ContextPanel.tsx` | Context panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/ChangePanel.tsx` | Change panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/EvidencePanel.tsx` | Evidence panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx` | Environment panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx` | Capabilities panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/WatchPanel.tsx` | Watch panel (placeholder) |
| `apps/desktop/src/renderer/components/panels/AuditPanel.tsx` | Audit panel (placeholder) |

### Modified Files
| File | Change |
|---|---|
| `apps/desktop/src/lib/shared-types/entities.ts` | Add new domain types |
| `apps/desktop/src/renderer/App.tsx` | Add left rail + panel layout |
| `apps/desktop/src/renderer/screens/ProjectScreen.tsx` | Refactor to mission-centric |
| `apps/desktop/src/renderer/components/TopBar.tsx` | Extend for project header context |

### Unchanged Files (preserved)
All other existing files remain untouched.

---

**STATUS:** Analysis complete. Awaiting Orchestrator approval before proceeding to implementation.

**WHAT WAS DONE:** Read all 8 governing rebuild files in required order. Read all 8 existing source files relevant to Component 10. Produced complete implementation analysis with scope summary, non-goals, salvage audit, reuse matrix, implementation plan, data model/IPC/API/UI/state/DevOps implications, test plan, rollback plan, risks, and explicit list of deferred items.

**FILES CHANGED:** None yet — analysis only.

**HOW TO TEST:** Not applicable yet — no code written.

**LIMITATIONS / RISKS:** Shell evolution is the highest-risk change in this component. Strangler pattern mitigates by preserving all existing screens. No data migration in C10 eliminates persistence risk.

**NEXT STEP:** Awaiting Orchestrator approval of this analysis. Once approved, will proceed to Phase 1 (new domain types) through Phase 10 (error handling).
