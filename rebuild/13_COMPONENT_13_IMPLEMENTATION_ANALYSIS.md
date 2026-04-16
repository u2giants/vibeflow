# Component 13: Change Engine and Code Operations — Implementation Analysis

**Version:** 1.0  
**Date:** 2026-04-14  
**Author:** Builder  
**Governing spec:** [`13_CHANGE_ENGINE_AND_CODE_OPERATIONS.md`](13_CHANGE_ENGINE_AND_CODE_OPERATIONS.md)  
**Working order position:** 6th (after 10, 22, 12, 14, 11)

---

## 1. Scope Summary

Component 13 is the **change engine** — it turns approved plans into actual code and configuration changes. It is responsible for:

1. **Isolated execution workspaces** — git worktrees/branches where edits happen safely, not directly in the primary workspace.
2. **File read/write operations** — leveraging the existing `FileService` with path traversal protection.
3. **Patch generation and application** — creating unified diffs, applying edits deterministically, preserving formatting.
4. **Semantic change grouping** — grouping raw file diffs by meaning (UI change, API change, data model change, etc.) rather than file order.
5. **Immediate validity checks** — running syntax validity, typecheck, lint, and dependency integrity checks after each meaningful patch.
6. **Duplicate and drift detection** — detecting when generated code duplicates existing utilities or conflicts with established patterns.
7. **Checkpoint management** — creating rollback checkpoints before risky modifications.
8. **ChangeSet preparation** — producing structured change sets with summary, blast radius, affected contracts, verification state, and raw diff.

This component sits **between** Component 11 (Project Intelligence, which provides context packs and impact analysis) and Component 19 (Approval/Risk/Audit, which classifies risk and routes approvals). It consumes plans from Component 12 and produces change sets that Component 19 reviews.

---

## 2. Non-Goals

The following are **explicitly out of scope** for Component 13:

| Non-Goal | Belongs To |
|---|---|
| Mission decomposition and plan generation | Component 12 (Agent Orchestration) |
| Risk classification and approval routing | Component 19 (Approval/Risk/Audit) |
| Layered verification (test suites, browser checks) | Component 16 (Verification and Acceptance) |
| Runtime evidence capture (screenshots, traces, logs) | Component 15 (Runtime Execution/Debugging) |
| Environment model and deploy promotion | Component 17 (Environments/Deployments) |
| MCP server management and tool discovery | Component 14 (Capability Fabric) |
| Post-deploy watch and incident detection | Component 21 (Observability) |
| Memory packs and decision knowledge | Component 20 (Memory/Skills) |
| Sync and collaboration | Component 22 (Sync/Collaboration) |
| UI panel wiring beyond ChangePanel population | Component 10 (Product Shell) — already scaffolded |

Component 13 must **not** drift into Component 16 verification behavior (it runs *immediate validity checks* only — syntax, typecheck, lint — not full test suites or acceptance tests). It must **not** implement Component 17 deploy behavior (it prepares change sets for review, it does not deploy them).

---

## 3. Salvage Audit of Existing VibeFlow Code

### 3.1 File Inventory

| Existing File or Module | Current Purpose | Classification | Reason | Migration Impact |
|---|---|---|---|---|
| [`apps/desktop/src/lib/tooling/file-service.ts`](apps/desktop/src/lib/tooling/file-service.ts:1) | File read/write/list/exists with path traversal protection; basic diff generation | **Keep with adapter** | Core file operations are sound. The `generateDiff()` method is a simple line-by-line diff — adequate for basic use but will need enhancement for semantic grouping. The adapter wraps it with checkpoint, workspace-scoping, and audit logging. | Low — wrap existing methods, add workspace context parameter |
| [`apps/desktop/src/lib/tooling/git-service.ts`](apps/desktop/src/lib/tooling/git-service.ts:1) | Git status/diff/commit/push/log via local binary | **Keep with adapter** | Provides branch creation, commit, and diff operations needed for isolated workspaces. Needs worktree support added. | Low — add `createWorktree()`, `createBranch()`, `checkout()` methods |
| [`apps/desktop/src/lib/tooling/terminal-service.ts`](apps/desktop/src/lib/tooling/terminal-service.ts:1) | Command execution with streaming output | **Keep with adapter** | Needed for running immediate validity checks (typecheck, lint, syntax validation). Already supports streaming output and process management. | Low — use as-is for validation pipeline |
| [`apps/desktop/src/lib/shared-types/entities.ts`](apps/desktop/src/lib/shared-types/entities.ts:1) | TypeScript interfaces for all domain objects | **Refactor in place** | Missing change-engine-specific types: `WorkspaceRun`, `PatchProposal`, `FileEdit`, `SemanticChangeGroup`, `Checkpoint`, `ChangeSet`, `DuplicateWarning`, `PatternReuseSuggestion`. Must add these. | Low — additive type definitions only |
| [`apps/desktop/src/lib/shared-types/ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts:1) | IPC channel type definitions | **Refactor in place** | Missing change engine IPC channels. Must add `ChangeEngineChannel` with methods for workspace management, patch application, semantic grouping, and validity checks. | Low — additive IPC types only |
| [`apps/desktop/src/renderer/components/panels/ChangePanel.tsx`](apps/desktop/src/renderer/components/panels/ChangePanel.tsx:1) | Placeholder panel ("coming in Component 13") | **Refactor in place** | Already scaffolded with placeholder text. Must replace with real change set display: semantic groups, affected files, blast radius, verification state, raw diff drill-down. | Medium — full component rewrite but layout structure exists |
| [`apps/desktop/src/main/index.ts`](apps/desktop/src/main/index.ts:1) | Monolithic main process with all IPC handlers | **Keep with adapter** | Already has file/git/terminal IPC handlers. Needs new change engine IPC handlers. Per Phase 0 plan, this file should be split — but that is a separate task. For now, add handlers inline. | Low — additive IPC handlers |
| [`apps/desktop/src/lib/storage/local-db.ts`](apps/desktop/src/lib/storage/local-db.ts:1) | SQLite CRUD for all domain objects | **Refactor in place** | Missing tables for `change_sets`, `checkpoints`, `workspace_runs`, `semantic_change_groups`. Must add schema and CRUD methods. | Medium — new tables and methods |
| [`apps/desktop/src/lib/project-intelligence/impact-analyzer.ts`](apps/desktop/src/lib/project-intelligence/impact-analyzer.ts:1) | Blast radius analysis via reference graph traversal | **Keep as-is** | Already produces `ImpactAnalysis` with `affectedFiles`, `affectedSymbols`, `affectedRoutes`, `affectedServices`, and `blastRadius`. The change engine consumes this for semantic grouping and blast radius classification. | None — direct reuse |
| [`apps/desktop/src/lib/capability-fabric/capability-registry.ts`](apps/desktop/src/lib/capability-fabric/capability-registry.ts:1) | Capability registration, health tracking, invocation logging | **Keep as-is** | The change engine logs its file/git/terminal operations as capability invocations. The registry already supports this pattern. | None — direct reuse |
| [`apps/desktop/src/lib/capability-fabric/capability-adapter.ts`](apps/desktop/src/lib/capability-fabric/capability-adapter.ts:1) | Wraps tooling services as capabilities with permission classification | **Keep as-is** | File, git, and terminal capabilities are already registered. The change engine invokes these capabilities and the adapter handles permission-to-approval-tier mapping. | None — direct reuse |
| [`apps/desktop/src/lib/approval/approval-engine.ts`](apps/desktop/src/lib/approval/approval-engine.ts:1) | 3-tier action classification and second-model review | **Keep as-is** | The change engine routes risky edits through the approval engine. The existing `classifyAction()` and `runSecondModelReview()` functions are reused. | None — direct reuse |
| [`apps/desktop/src/renderer/screens/ConversationScreen.tsx`](apps/desktop/src/renderer/screens/ConversationScreen.tsx:1) | Chat UI with file viewer, terminal, git status | **Keep as-is** | The change engine does not modify this screen. The existing file diff viewer in the right panel may be reused for raw diff display within ChangePanel. | None — reference only |

### 3.2 New Files Required

| New File | Purpose |
|---|---|
| `apps/desktop/src/lib/change-engine/change-engine.ts` | Core change engine: workspace management, patch application, checkpoint creation, semantic grouping |
| `apps/desktop/src/lib/change-engine/workspace-manager.ts` | Git worktree/branch lifecycle: create, checkout, commit, cleanup |
| `apps/desktop/src/lib/change-engine/patch-applier.ts` | Patch generation and deterministic application with formatting preservation |
| `apps/desktop/src/lib/change-engine/validity-pipeline.ts` | Immediate validity checks: syntax, typecheck, lint, dependency integrity |
| `apps/desktop/src/lib/change-engine/semantic-grouper.ts` | Groups file-level changes into semantic categories using project intelligence |
| `apps/desktop/src/lib/change-engine/duplicate-detector.ts` | Detects duplicate logic, near-duplicate UI fragments, reimplementation of existing utilities |
| `apps/desktop/src/lib/change-engine/checkpoint-manager.ts` | Creates and manages rollback checkpoints before risky modifications |
| `apps/desktop/src/lib/change-engine/index.ts` | Barrel export |

---

## 4. Reuse Matrix

| Existing File or Module | Current Purpose | Keep As-Is / Wrap / Refactor / Extract / Replace | Reason | Migration Impact |
|---|---|---|---|---|
| `file-service.ts` | File read/write/list/exists + basic diff | **Wrap** | Sound implementation; needs workspace-scoping and audit wrapper | Low |
| `git-service.ts` | Git status/diff/commit/push/log | **Wrap** | Sound; needs worktree/branch creation methods added | Low |
| `terminal-service.ts` | Command execution with streaming | **Wrap** | Sound; used for validity pipeline execution | Low |
| `entities.ts` | Domain type definitions | **Refactor in place** | Add 8 new change-engine types | Low |
| `ipc.ts` | IPC channel types | **Refactor in place** | Add ChangeEngineChannel interface | Low |
| `local-db.ts` | SQLite persistence | **Refactor in place** | Add 4 new tables + CRUD methods | Medium |
| `ChangePanel.tsx` | Placeholder panel | **Refactor in place** | Replace placeholder with real change set UI | Medium |
| `impact-analyzer.ts` | Blast radius analysis | **Keep as-is** | Direct consumer for semantic grouping | None |
| `capability-registry.ts` | Capability health/invocation tracking | **Keep as-is** | Change engine logs invocations here | None |
| `capability-adapter.ts` | Tooling → capability wrapping | **Keep as-is** | File/git/terminal capabilities already registered | None |
| `approval-engine.ts` | 3-tier risk classification | **Keep as-is** | Change engine routes risky edits through this | None |
| `main/index.ts` | IPC handler registration | **Wrap** | Add change engine IPC handlers | Low |

---

## 5. Proposed Implementation Plan

### Phase 1: Data Model and Types (bounded)
1. Add 8 new type definitions to [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts):
   - `WorkspaceRun` — tracks an isolated workspace session
   - `PatchProposal` — a proposed edit to a file
   - `FileEdit` — a single file modification with before/after content
   - `SemanticChangeGroup` — grouped changes by meaning
   - `Checkpoint` — rollback point before risky modification
   - `ChangeSet` — logical unit of changes with metadata
   - `DuplicateWarning` — detected duplication alert
   - `PatternReuseSuggestion` — existing pattern that should be reused instead

2. Add `ChangeEngineChannel` to [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) with methods:
   - `createWorkspace(missionId, planStepId)` → `WorkspaceRun`
   - `applyPatch(workspaceId, patch)` → `FileEdit`
   - `getChangeSet(workspaceId)` → `ChangeSet`
   - `runValidityChecks(workspaceId)` → `EvidenceItem[]`
   - `createCheckpoint(workspaceId, label)` → `Checkpoint`
   - `rollbackToCheckpoint(checkpointId)` → `boolean`
   - `getSemanticGroups(workspaceId)` → `SemanticChangeGroup[]`
   - `getDuplicateWarnings(workspaceId)` → `DuplicateWarning[]`
   - `commitWorkspace(workspaceId, message)` → `GitCommitResult`
   - `cleanupWorkspace(workspaceId)` → `boolean`

### Phase 2: Persistence Layer (bounded)
3. Add 4 new tables to [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) schema:
   - `workspace_runs` — workspace session tracking
   - `change_sets` — logical change units with metadata
   - `checkpoints` — rollback checkpoints
   - `semantic_change_groups` — semantic groupings of changes

4. Add CRUD methods to `LocalDb` class for each new table.

### Phase 3: Core Change Engine (bounded)
5. Create [`change-engine.ts`](apps/desktop/src/lib/change-engine/change-engine.ts):
   - `createWorkspaceRun(missionId, planStepId, projectRoot)` → creates git worktree, returns `WorkspaceRun`
   - `applyPatch(workspaceId, patchProposal)` → applies edit, runs immediate validity check, returns `FileEdit`
   - `getChangeSet(workspaceId)` → aggregates all edits into `ChangeSet`
   - `commitWorkspace(workspaceId, message)` → commits changes in worktree
   - `cleanupWorkspace(workspaceId)` → removes worktree

6. Create [`workspace-manager.ts`](apps/desktop/src/lib/change-engine/workspace-manager.ts):
   - `createWorktree(projectRoot, branchName)` → `git worktree add`
   - `createBranch(projectRoot, branchName)` → `git checkout -b`
   - `checkout(worktreePath)` → `git checkout`
   - `getWorktreeList(projectRoot)` → `git worktree list`
   - `removeWorktree(worktreePath)` → `git worktree remove`

### Phase 4: Patch Application (bounded)
7. Create [`patch-applier.ts`](apps/desktop/src/lib/change-engine/patch-applier.ts):
   - `generateUnifiedDiff(originalPath, newContent, filePath)` → unified diff string
   - `applyEdit(worktreePath, filePath, newContent)` → writes file, returns `FileEdit`
   - `applyMultiFilePatch(worktreePath, patches)` → applies multiple edits atomically
   - `validatePatchIntegrity(patch)` → checks patch can be applied cleanly

### Phase 5: Immediate Validity Pipeline (bounded)
8. Create [`validity-pipeline.ts`](apps/desktop/src/lib/change-engine/validity-pipeline.ts):
   - `runSyntaxCheck(filePath)` → parses file for syntax errors
   - `runTypecheck(workspacePath)` → runs `tsc --noEmit` or equivalent
   - `runLint(workspacePath, affectedFiles)` → runs eslint on affected files only
   - `runDependencyCheck(workspacePath)` → checks package.json integrity
   - `runMinimalValidationSet(affectedFiles, workspacePath)` → runs smallest effective set

**Boundary note:** This is NOT Component 16 verification. It runs only syntax/typecheck/lint/dependency checks — not test suites, not browser checks, not acceptance tests. Component 16 will layer on top of this.

### Phase 6: Semantic Grouping (bounded)
9. Create [`semantic-grouper.ts`](apps/desktop/src/lib/change-engine/semantic-grouper.ts):
   - `groupChanges(fileEdits, projectIndex, impactAnalysis)` → `SemanticChangeGroup[]`
   - Uses project intelligence (Component 11) to classify changes by:
     - File path patterns (e.g., `components/` → UI, `api/` → API contract, `models/` → data model)
     - Impact analysis results (affected routes, services, symbols)
     - Change type (new file, modify, delete)
   - Produces human-readable group labels: "UI layout change", "API contract change", "auth behavior change", "data model change", "dependency addition", "deployment config change"

### Phase 7: Duplicate Detection (bounded)
10. Create [`duplicate-detector.ts`](apps/desktop/src/lib/change-engine/duplicate-detector.ts):
    - `detectDuplicates(newContent, projectIndex)` → `DuplicateWarning[]`
    - Searches project intelligence for similar functions, components, utilities
    - Uses simple string similarity (existing symbols, function names) to flag potential duplication
    - Produces `PatternReuseSuggestion` when existing pattern should be used

### Phase 8: Checkpoint Management (bounded)
11. Create [`checkpoint-manager.ts`](apps/desktop/src/lib/change-engine/checkpoint-manager.ts):
    - `createCheckpoint(workspaceId, label)` → snapshots current state, returns `Checkpoint`
    - `rollbackToCheckpoint(checkpointId)` → restores workspace to checkpoint state
    - `listCheckpoints(workspaceId)` → returns all checkpoints for workspace

### Phase 9: IPC Handlers (bounded)
12. Add change engine IPC handlers to [`main/index.ts`](apps/desktop/src/main/index.ts):
    - All `ChangeEngineChannel` methods mapped to IPC handlers
    - Each handler validates workspace ownership, logs capability invocations

### Phase 10: UI Population (bounded)
13. Replace [`ChangePanel.tsx`](apps/desktop/src/renderer/components/panels/ChangePanel.tsx) placeholder:
    - Display semantic change groups with expandable file lists
    - Show blast radius indicator (low/medium/high/critical)
    - Show verification run state (pass/fail/warning/skipped)
    - Show rollback checkpoint availability
    - Raw diff drill-down per file
    - Plain-English explanation of what changed and why

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### 6.1 Data Model

**New types added to `entities.ts`:**

```typescript
export interface WorkspaceRun {
  id: string;
  missionId: string;
  planStepId: string;
  projectRoot: string;
  worktreePath: string;
  branchName: string;
  status: 'active' | 'committed' | 'cleaned-up' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

export interface PatchProposal {
  id: string;
  workspaceRunId: string;
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  originalContent: string | null;
  newContent: string | null;
  rationale: string;
  createdAt: string;
}

export interface FileEdit {
  id: string;
  workspaceRunId: string;
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  diff: string;
  validityResults: EvidenceItem[];
  appliedAt: string;
}

export interface SemanticChangeGroup {
  id: string;
  workspaceRunId: string;
  label: string; // "UI layout change", "API contract change", etc.
  description: string;
  fileEdits: string[]; // fileEdit IDs
  affectedContracts: string[]; // public API contracts affected
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
}

export interface Checkpoint {
  id: string;
  workspaceRunId: string;
  label: string;
  gitRef: string; // commit SHA or stash ref
  createdAt: string;
}

export interface ChangeSet {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string;
  summary: string;
  rationale: string;
  fileEdits: FileEdit[];
  semanticGroups: SemanticChangeGroup[];
  affectedContracts: string[];
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
  verificationState: EvidenceItem[];
  rollbackCheckpointId: string | null;
  duplicateWarnings: DuplicateWarning[];
  createdAt: string;
}

export interface DuplicateWarning {
  id: string;
  workspaceRunId: string;
  filePath: string;
  warning: string;
  existingPattern: string | null; // path to existing similar code
  reuseSuggestion: PatternReuseSuggestion | null;
}

export interface PatternReuseSuggestion {
  existingPath: string;
  existingSymbol: string | null;
  reason: string;
  confidence: number; // 0-1
}
```

### 6.2 IPC

New IPC channel: `changeEngine` with methods as defined in Phase 1 above. All methods are invoked from renderer → main. Events flow main → renderer:
- `changeEngine:workspaceStatusChanged` — workspace status updates
- `changeEngine:validityCheckComplete` — validity pipeline results
- `changeEngine:changeSetReady` — change set assembled and ready for review

### 6.3 API

The change engine exposes a programmatic API for use by the orchestration engine (Component 12):
- `ChangeEngine.createWorkspaceRun(missionId, planStepId, projectRoot)`
- `ChangeEngine.applyPatch(workspaceId, patch)`
- `ChangeEngine.getChangeSet(workspaceId)`
- `ChangeEngine.commitWorkspace(workspaceId, message)`

### 6.4 UI

The ChangePanel (already scaffolded) is populated with:
- Semantic change groups (primary view)
- Expandable file edit list per group
- Blast radius badge
- Verification status indicators
- Raw diff viewer (drill-down)
- Rollback checkpoint indicator
- Duplicate warnings with reuse suggestions

### 6.5 State

- Workspace runs are persisted to SQLite (`workspace_runs` table)
- Change sets are persisted to SQLite (`change_sets` table)
- Checkpoints are persisted to SQLite (`checkpoints` table)
- Semantic groups are persisted to SQLite (`semantic_change_groups` table)
- In-memory state tracks active workspace runs and their current edit state

### 6.6 DevOps Implications

- The change engine creates git worktrees and branches — this is local workspace control, not deployment
- Commits are created in isolated worktrees, not pushed to remote
- The change engine does NOT deploy — it prepares change sets for Component 19 (Approval) and Component 17 (Deploy)
- The change engine DOES run local validity checks (typecheck, lint) which are part of the CI gate

---

## 7. Test Plan

### 7.1 Unit Tests

| Test | File | What It Proves |
|---|---|---|
| `WorkspaceManager.createWorktree()` | `workspace-manager.test.ts` | Creates a git worktree at the expected path |
| `WorkspaceManager.removeWorktree()` | `workspace-manager.test.ts` | Removes worktree and cleans up |
| `PatchApplier.generateUnifiedDiff()` | `patch-applier.test.ts` | Produces valid unified diff format |
| `PatchApplier.applyEdit()` | `patch-applier.test.ts` | Writes file content correctly, returns FileEdit |
| `ValidityPipeline.runSyntaxCheck()` | `validity-pipeline.test.ts` | Detects syntax errors in malformed TypeScript |
| `ValidityPipeline.runTypecheck()` | `validity-pipeline.test.ts` | Runs tsc --noEmit and returns results |
| `SemanticGrouper.groupChanges()` | `semantic-grouper.test.ts` | Groups file edits by semantic category |
| `DuplicateDetector.detectDuplicates()` | `duplicate-detector.test.ts` | Flags near-duplicate function implementations |
| `CheckpointManager.createCheckpoint()` | `checkpoint-manager.test.ts` | Creates checkpoint with valid git ref |
| `CheckpointManager.rollbackToCheckpoint()` | `checkpoint-manager.test.ts` | Restores workspace to checkpoint state |
| `ChangeEngine.createWorkspaceRun()` | `change-engine.test.ts` | Creates workspace with worktree, branch, and DB record |
| `ChangeEngine.applyPatch()` | `change-engine.test.ts` | Applies patch, runs validity check, returns FileEdit |
| `ChangeEngine.getChangeSet()` | `change-engine.test.ts` | Aggregates edits into ChangeSet with semantic groups |

### 7.2 Integration Tests

| Test | What It Proves |
|---|---|
| Full workspace lifecycle | Create workspace → apply patch → run validity → create checkpoint → apply second patch → get change set → commit → cleanup |
| IPC round-trip | Renderer calls changeEngine IPC → main executes → result returned to renderer |
| ChangePanel rendering | ChangePanel displays semantic groups, blast radius, verification state |

### 7.3 Regression Tests

| Test | What It Proves |
|---|---|
| FileService unchanged | Existing file read/write/list/exists behavior is preserved |
| GitService unchanged | Existing git status/diff/commit/push/log behavior is preserved |
| TerminalService unchanged | Existing terminal command execution is preserved |

---

## 8. Rollback Plan

### 8.1 Per-Feature Rollback

- Each new file is additive — no existing files are deleted or fundamentally changed
- Type additions to `entities.ts` and `ipc.ts` are backward-compatible (new interfaces, no modifications to existing ones)
- New SQLite tables are created with `CREATE TABLE IF NOT EXISTS` — no schema migration of existing tables
- If any component fails, the new files can be removed without affecting existing functionality

### 8.2 Data Rollback

- New SQLite tables can be dropped if needed: `DROP TABLE IF EXISTS workspace_runs`, etc.
- No existing data is modified or migrated
- Checkpoints provide runtime rollback within workspaces (git-level rollback)

### 8.3 Catastrophic Rollback

- The pre-rebuild commit is tagged as `pre-rebuild-baseline`
- All new files are in the `change-engine/` directory — removing the directory reverts to pre-Component-13 state
- Type additions to `entities.ts` and `ipc.ts` can be reverted by removing the added interfaces

---

## 9. Risks and Approvals Required

### 9.1 Active Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Git worktree creation fails on Windows | Medium | Medium | Test worktree creation on Windows; fallback to branch-based isolation if worktrees unavailable |
| Typecheck/lint commands not found in project | Medium | Low | Graceful degradation — validity checks are best-effort; missing tools produce "skipped" evidence items |
| Semantic grouping produces incorrect categories | Low | Medium | Use project intelligence (Component 11) as primary signal; fall back to path-based heuristics |
| Large file edits cause performance issues | Low | Low | Stream file writes; limit diff generation to affected regions |
| Duplicate detection produces false positives | Medium | Low | Flag as warnings, not errors; user can dismiss |
| Main process file grows further with new IPC handlers | Certain | Low | This is a known Phase 0 issue; handlers are additive and can be refactored later |

### 9.2 Approvals Required

| Approval | From | Why |
|---|---|---|
| Type additions to `entities.ts` | Orchestrator | Affects all components that import shared types |
| New SQLite tables | Orchestrator | Affects persistence layer and sync (Component 22) |
| IPC channel additions | Orchestrator | Affects preload bridge and renderer API |
| ChangePanel UI replacement | Orchestrator | Affects user-facing surface |

---

## 10. Explicit List of What Will NOT Be Built Yet

The following are **deferred to later components** and will NOT be implemented in Component 13:

| Deferred Item | Component | Reason |
|---|---|---|
| Full test suite execution | C16 | Component 13 runs immediate validity checks only (syntax, typecheck, lint). Test execution belongs to Component 16. |
| Browser automation and screenshot capture | C15 | Runtime evidence capture belongs to Component 15. |
| Acceptance test gating | C16 | Layered verification with acceptance flows belongs to Component 16. |
| Deploy promotion and environment mapping | C17 | The change engine prepares change sets; deployment belongs to Component 17. |
| Post-deploy watch windows | C21 | Observability and incident detection belongs to Component 21. |
| Risk classification expansion | C19 | The change engine uses existing 3-tier approval; expanded risk dimensions belong to Component 19. |
| Audit chain and rollback history UI | C19 | Audit panel population belongs to Component 19. |
| Memory pack retrieval for pattern reuse | C20 | The duplicate detector uses project intelligence (C11), not memory packs (C20). |
| Sync of workspace runs across devices | C22 | Workspace runs are local-only; sync belongs to Component 22. |
| Main process handler splitting | Phase 0 | The monolithic `index.ts` split is a Phase 0 task, not Component 13. |
| Automated test infrastructure | Phase 0 | Test runner setup is Phase 0; Component 13 writes tests but assumes the runner exists. |

---

## 11. Boundary Clar: How Component 13 Avoids Drifting

### 11.1 Isolated Workspaces vs. Component 16 Verification

Component 13 creates isolated workspaces and runs **immediate validity checks** (syntax, typecheck, lint, dependency integrity). These are fast, local checks that catch breakage early. Component 16 will run **layered verification** (test suites, browser checks, acceptance tests) which are slower and more comprehensive. The boundary is:
- C13: "Does this code compile and lint cleanly?"
- C16: "Does this code pass all tests and meet acceptance criteria?"

### 11.2 Semantic Grouping vs. Component 17 Deploy Behavior

Component 13 groups changes by meaning and produces a `ChangeSet` with blast radius. It does NOT:
- Map changes to environments
- Determine which environments need deployment
- Trigger deploy pipelines
- Manage service topology changes

Component 17 will consume the `ChangeSet` and determine deploy implications.

### 11.3 Checkpoint Management vs. Component 19 Rollback

Component 13 creates **git-level checkpoints** within isolated workspaces. These are technical rollback points (git reset/stash). Component 19 will manage **policy-level rollback** (approval reversal, deploy rollback, audit trail). The boundary is:
- C13: "Undo the last file edit in this workspace"
- C19: "Roll back the approved change and audit why it was approved"

### 11.4 Duplicate Detection vs. Component 20 Memory

Component 13's duplicate detector searches the **project intelligence layer** (Component 11) for existing symbols, functions, and patterns. It does NOT search memory packs, decision knowledge, or skill-like retrieval. Component 20 will provide retrievable knowledge packs that may enhance duplicate detection in the future.

---

## 12. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? Yes — FileService, GitService, TerminalService, ImpactAnalyzer, CapabilityRegistry, ApprovalEngine are all wrapped or reused directly.
- [x] Did I build for missions rather than files? Yes — WorkspaceRun is tied to missionId and planStepId, not raw file paths.
- [x] Did I preserve transparency without requiring programmer workflows? Yes — semantic grouping provides plain-English change explanations; raw diffs are available on demand.
- [x] Did I make MCP/capabilities first-class? Yes — change engine operations are logged as capability invocations in the existing registry.
- [x] Did I attach evidence rather than confidence theater? Yes — validity checks produce EvidenceItem records with pass/fail/warning status.
- [x] Did I classify risk and approvals? Yes — blast radius classification and checkpoint creation before risky modifications; approval routing via existing engine.
- [x] Did I keep Git beneath the product surface? Yes — worktrees and branches are managed internally; users see tasks and candidates, not git commands.
- [x] Did I avoid turning the shell back into VS Code? Yes — ChangePanel shows semantic groups, not file-tree diffs as the primary view.

---

## 13. Gap List

| Gap | Description | Resolution Plan |
|---|---|---|
| No test infrastructure yet | Phase 0 test runner setup is not complete | Component 13 tests will be written but cannot run until Phase 0 is complete. Tests are structured for Vitest. |
| Main process is monolithic | `index.ts` is 1365 lines and growing | New IPC handlers are added inline. Handler splitting is a Phase 0 task. |
| Git worktree support untested on Windows | Worktrees may behave differently on Windows | Fallback to branch-based isolation if worktrees fail. |
| Project intelligence index may be stale | Component 11 indexing may not have run | Semantic grouping falls back to path-based heuristics if index is unavailable. |
| Handoff path for packaged builds | Known bug in handoff storage | Not in scope for Component 13; tracked separately. |

---

**End of Implementation Analysis. Awaiting Orchestrator approval before writing code.**
