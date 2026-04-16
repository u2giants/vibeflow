# Component 19: Approval, Risk, Audit, and Rollback — Implementation Analysis

**Version:** 1.0  
**Status:** Awaiting Orchestrator approval  
**Date:** 2026-04-14  
**Author:** Builder  
**Governing spec:** [`19_APPROVAL_RISK_AUDIT_AND_ROLLBACK.md`](19_APPROVAL_RISK_AUDIT_AND_ROLLBACK.md)

---

## 1. Scope Summary

Component 19 expands the existing 3-tier approval system into a richer risk classification engine, persists the approval audit history to SQLite (replacing the current in-memory logger), creates explicit checkpoint records tied to audit entries, and presents rollback as a first-class recovery option in the Audit panel.

**What this component builds:**
1. **Richer risk classes** — expand from 3 tiers (auto / second-model / human) to 6 risk classes (informational, low, medium, high, destructive, privileged-production) with multi-dimensional scoring.
2. **Persistent audit history** — replace the in-memory `approval-logger.ts` with SQLite-backed audit records that survive restarts.
3. **Audit record enrichment** — every audit entry stores mission id, plan step, role, capability, environment, evidence summary, approval chain, result, checkpoint id, and rollback linkage.
4. **Checkpoint-to-audit linkage** — wire the existing `CheckpointManager` (Component 13) into the approval engine so that checkpoints created before risky actions are recorded in the audit trail.
5. **Rollback presentation** — populate the existing placeholder `AuditPanel.tsx` with a real UI showing audit history, checkpoints, and rollback options.
6. **Approval IPC expansion** — add new IPC channels for querying audit history, listing checkpoints, and initiating rollback.

**What this component does NOT build (deferred to later components):**
- Component 17 deploy workflow gating (deploy-time approval gates)
- Component 21 incident-driven rollback execution (post-deploy incident detection and auto-remediation)
- Component 18 secrets/config migration safety (migration-specific approval gates)
- Component 16 verification and acceptance system (layered verification pipelines)
- Component 15 runtime execution debugging and evidence capture (runtime log/trace capture)
- Two-step human approval for privileged production (requires Component 17 environment model to be fully implemented)
- Evidence bundle attachment to approval requests (requires Component 15 evidence capture)

---

## 2. Non-Goals

- This component does **not** replace the existing approval engine's core flow (classify → second-model review → human approval). It extends the classification logic and persists results.
- This component does **not** implement deploy-time approval gates. Those belong to Component 17.
- This component does **not** implement incident detection or auto-rollback. Those belong to Component 21.
- This component does **not** implement migration safety classification. That belongs to Component 18.
- This component does **not** change the IPC security boundary, preload script architecture, or Electron main process structure.
- This component does **not** implement the full environment model (local/preview/staging/production). It reads environment labels that already exist in the `environments` table (Component 10 scaffold).

---

## 3. Salvage Audit of Existing Code

### 3.1 Files examined

| File | Lines | Current Purpose |
|---|---|---|
| [`apps/desktop/src/lib/approval/approval-engine.ts`](apps/desktop/src/lib/approval/approval-engine.ts) | 121 | 3-tier classification (`classifyAction`), second-model review via OpenRouter |
| [`apps/desktop/src/lib/approval/approval-logger.ts`](apps/desktop/src/lib/approval/approval-logger.ts) | 43 | In-memory approval log array with `logApprovalDecision()` and `getRecentApprovals()` |
| [`apps/desktop/src/renderer/components/ApprovalCard.tsx`](apps/desktop/src/renderer/components/ApprovalCard.tsx) | 157 | Tier 3 human approval modal overlay |
| [`apps/desktop/src/renderer/components/ApprovalQueue.tsx`](apps/desktop/src/renderer/components/ApprovalQueue.tsx) | 117 | Bottom-bar approval queue indicator |
| [`apps/desktop/src/renderer/components/panels/AuditPanel.tsx`](apps/desktop/src/renderer/components/panels/AuditPanel.tsx) | 14 | Placeholder: "Audit panel — coming in Component 19" |
| [`apps/desktop/src/lib/shared-types/entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) | 788 | All domain types including `Checkpoint`, `ChangeSet`, `ApprovalPolicy` |
| [`apps/desktop/src/lib/shared-types/ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) | 557 | IPC channel types including `ApprovalApi`, `ApprovalChannel` |
| [`apps/desktop/src/lib/storage/local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) | 1757 | SQLite CRUD with sql.js, includes `checkpoints` table schema |
| [`apps/desktop/src/main/index.ts`](apps/desktop/src/main/index.ts) | 1436 | Main process with approval IPC handlers (lines 1236-1343) |
| [`apps/desktop/src/preload/index.ts`](apps/desktop/src/preload/index.ts) | 237 | Preload bridge with `approval` API (lines 129-140) |
| [`apps/desktop/src/lib/change-engine/checkpoint-manager.ts`](apps/desktop/src/lib/change-engine/checkpoint-manager.ts) | 125 | Git-based checkpoint creation and rollback |
| [`apps/desktop/src/renderer/screens/ConversationScreen.tsx`](apps/desktop/src/renderer/screens/ConversationScreen.tsx) | 928 | Conversation UI with approval card integration |

### 3.2 Key findings

1. **`approval-engine.ts`** has a working `classifyAction()` function that maps `ActionType` to `ApprovalTier` (1/2/3). It uses simple whitelist/blacklist logic. The `ActionType` union has 11 action types. The function needs expansion to support 6 risk classes and multi-dimensional scoring.

2. **`approval-logger.ts`** is purely in-memory (`const approvalLog: ApprovalLogEntry[] = []`). Data is lost on restart. This is the primary target for persistence migration.

3. **`local-db.ts`** already has a `checkpoints` table (line 500-506) with columns: `id`, `workspace_run_id`, `label`, `git_ref`, `created_at`. It has `upsertCheckpoint()`, `listCheckpoints()`, and `getCheckpoint()` methods. **No audit log table exists yet** — this must be added.

4. **`CheckpointManager`** (Component 13) creates git-based checkpoints via `git commit` and `git stash`. It returns a `Checkpoint` object with `id`, `workspaceRunId`, `label`, `gitRef`, `createdAt`. It is already wired into `ChangeEngine`. The approval engine does **not** currently reference checkpoints.

5. **Approval IPC** (main/index.ts lines 1236-1343) uses an in-memory `Map<string, { action, resolve }>()` for pending human approvals. The `approval:getLog` handler calls `getRecentApprovals(20)` which reads the in-memory array.

6. **`AuditPanel.tsx`** is a 14-line placeholder. It needs a full implementation.

7. **`entities.ts`** has `Checkpoint` (line 745-751) and `ApprovalPolicy` (line 94) types but **no `AuditRecord` or `RiskClass` types** yet.

8. **`ipc.ts`** has `ApprovalApi` interface (line 344-351) with `requestAction`, `humanDecision`, `getQueue`, `getLog`, `onPendingApproval`, `removePendingApprovalListener`. It needs expansion for audit history queries and rollback operations.

---

## 4. Reuse Matrix

| Existing file or module | Current purpose | Keep as-is / Wrap / Refactor / Extract / Replace | Reason | Migration impact |
|---|---|---|---|---|
| `approval-engine.ts` | 3-tier classification + second-model review | **Refactor in place** | Core logic is sound; needs risk class expansion and multi-dimensional scoring. The `classifyAction()` function signature must change to return `RiskClass` instead of `ApprovalTier`. | Medium — all callers of `classifyAction()` must be updated. The `ActionType` union must expand. |
| `approval-logger.ts` | In-memory approval log | **Replace** | In-memory design is fundamentally incompatible with persistent audit history. Will be replaced with SQLite-backed `audit-store.ts`. | Low — only called from `main/index.ts` approval handlers. |
| `ApprovalCard.tsx` | Tier 3 human approval modal | **Keep with adapter** | UI is functional and well-structured. Needs to display richer risk class info and evidence summary. | Low — add new props for risk class display. |
| `ApprovalQueue.tsx` | Bottom-bar approval queue indicator | **Keep as-is** | Works correctly. No changes needed for Component 19 scope. | None |
| `AuditPanel.tsx` | Placeholder | **Replace** | 14-line placeholder must become a full audit history + checkpoint + rollback UI. | Medium — new component with data fetching, rendering, and rollback interaction. |
| `entities.ts` | Domain types | **Refactor in place** | Add `AuditRecord`, `RiskClass`, `RollbackPlan` types. Preserve all existing types. | Low — additive only. |
| `ipc.ts` | IPC channel types | **Refactor in place** | Add `audit:getHistory`, `audit:getRecord`, `rollback:initiate`, `rollback:preview` channels. Preserve existing `ApprovalApi`. | Low — additive only. |
| `local-db.ts` | SQLite CRUD | **Refactor in place** | Add `audit_records` table schema and CRUD methods. Preserve all existing tables and methods. | Low — additive schema + methods. |
| `main/index.ts` | Main process + IPC handlers | **Refactor in place** | Update approval handlers to use new risk engine and audit store. Add new audit/rollback IPC handlers. | Medium — handler logic changes, new handlers added. |
| `preload/index.ts` | Preload bridge | **Refactor in place** | Add `audit` and `rollback` API surfaces to `VibeFlowAPI`. Preserve existing `approval` API. | Low — additive only. |
| `checkpoint-manager.ts` | Git-based checkpoint creation | **Keep with adapter** | Checkpoint creation logic is sound. Needs to be called from the approval engine before risky actions. | Low — wire into approval flow, no internal changes. |
| `ConversationScreen.tsx` | Conversation UI with approval integration | **Keep as-is** | Already integrates `ApprovalCard` and approval IPC. No changes needed for Component 19 scope. | None |

---

## 5. Proposed Implementation Plan

### Phase 1: Data Model (shared-types)

1. Add new types to [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts):
   - `RiskClass` = `'informational' | 'low' | 'medium' | 'high' | 'destructive' | 'privileged-production'`
   - `RiskDimension` interface: `{ dimension: string; score: number; maxScore: number; explanation: string }`
   - `RiskAssessment` interface: `{ riskClass: RiskClass; overallScore: number; dimensions: RiskDimension[]; evidenceCompleteness: 'complete' | 'partial' | 'missing'; reversibility: 'reversible' | 'partially-reversible' | 'irreversible' }`
   - `AuditRecord` interface: `{ id: string; missionId: string | null; planStepId: string | null; roleSlug: string | null; capabilityId: string | null; actionType: string; parameters: Record<string, unknown>; environment: string | null; riskAssessment: RiskAssessment; evidenceSummary: string | null; approvalChain: ApprovalChainEntry[]; result: 'approved' | 'rejected' | 'escalated' | 'rolled-back'; checkpointId: string | null; rollbackPlan: RollbackPlan | null; initiatedBy: string; initiatedAt: string; completedAt: string | null; durationMs: number | null }`
   - `ApprovalChainEntry` interface: `{ tier: number; reviewerModel: string | null; reviewerRole: string | null; decision: string; reason: string; decidedAt: string }`
   - `RollbackPlan` interface: `{ targetState: string; reversibleChanges: string[]; irreversibleChanges: string[]; environment: string; dataCaveats: string[]; estimatedDowntime: string | null; requiredApprovals: string[]; checkpointId: string }`

2. Add new IPC types to [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts):
   - `AuditChannel` interface with `getHistory`, `getRecord`, `getCheckpoints`, `getRollbackOptions`
   - `RollbackChannel` interface with `preview`, `initiate`, `getStatus`
   - Extend `VibeFlowAPI` with `audit` and `rollback` properties

### Phase 2: Persistence Layer (local-db.ts)

3. Add `audit_records` table to [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) schema:
   ```sql
   CREATE TABLE IF NOT EXISTS audit_records (
     id TEXT PRIMARY KEY,
     mission_id TEXT,
     plan_step_id TEXT,
     role_slug TEXT,
     capability_id TEXT,
     action_type TEXT NOT NULL,
     parameters_json TEXT NOT NULL DEFAULT '{}',
     environment TEXT,
     risk_class TEXT NOT NULL,
     risk_score INTEGER NOT NULL DEFAULT 0,
     risk_dimensions_json TEXT NOT NULL DEFAULT '[]',
     evidence_completeness TEXT NOT NULL DEFAULT 'missing',
     reversibility TEXT NOT NULL DEFAULT 'reversible',
     evidence_summary TEXT,
     approval_chain_json TEXT NOT NULL DEFAULT '[]',
     result TEXT NOT NULL,
     checkpoint_id TEXT,
     rollback_plan_json TEXT,
     initiated_by TEXT NOT NULL DEFAULT 'system',
     initiated_at TEXT NOT NULL,
     completed_at TEXT,
     duration_ms INTEGER
   );
   ```

4. Add CRUD methods to `LocalDb`:
   - `insertAuditRecord(record: AuditRecord): void`
   - `getAuditRecord(id: string): AuditRecord | null`
   - `listAuditRecords(filter?: { missionId?: string; limit?: number }): AuditRecord[]`
   - `listAuditRecordsByRiskClass(riskClass: RiskClass): AuditRecord[]`
   - `getCheckpointsForMission(missionId: string): Checkpoint[]`
   - `getRollbackOptions(missionId: string): RollbackPlan[]`

### Phase 3: Risk Engine (approval-engine.ts refactor)

5. Replace `classifyAction()` with `assessRisk()`:
   - Input: `actionType`, `environment`, `dataRisk`, `blastRadius`, `evidenceCompleteness`, `serviceMutationScope`, `reversibility`
   - Output: `RiskAssessment` with `riskClass`, `overallScore`, `dimensions[]`
   - Scoring algorithm: weighted sum of dimension scores, mapped to risk class thresholds
   - Maintain backward compatibility: `classifyAction()` becomes a thin wrapper that calls `assessRisk()` and maps `RiskClass` back to `ApprovalTier`

6. Expand `ActionType` union to include new action types:
   - `migration:run`, `migration:rollback`, `config:change`, `secret:rotate`, `service:restart`, `service:stop`, `deploy:rollback`, `incident:acknowledge`, `incident:remediate`

7. Add `mapRiskClassToApprovalTier(riskClass: RiskClass): ApprovalTier`:
   - informational → Tier 1 (auto)
   - low → Tier 1 (auto)
   - medium → Tier 2 (second-model)
   - high → Tier 3 (human)
   - destructive → Tier 3 (human)
   - privileged-production → Tier 3 (human, with two-step flag)

### Phase 4: Audit Store (new file)

8. Create [`apps/desktop/src/lib/approval/audit-store.ts`](apps/desktop/src/lib/approval/audit-store.ts):
   - `AuditStore` class wrapping `LocalDb` audit record CRUD
   - `createAuditRecord()`: creates a new audit record with risk assessment
   - `updateAuditResult()`: updates the result after action execution
   - `linkCheckpoint()`: links a checkpoint to an audit record
   - `getHistory()`: queries audit records with optional filters
   - `getRecord()`: retrieves a single audit record with full approval chain

### Phase 5: Main Process IPC (main/index.ts)

9. Update approval handlers (lines 1236-1343):
   - `approval:requestAction`: call `assessRisk()` instead of `classifyAction()`, create audit record via `AuditStore`, link checkpoint if applicable
   - `approval:humanDecision`: update audit record result via `AuditStore`
   - `approval:getLog`: read from `AuditStore.getHistory()` instead of in-memory array

10. Add new IPC handlers:
    - `audit:getHistory`: query audit records with optional missionId/limit filters
    - `audit:getRecord`: retrieve single audit record by id
    - `audit:getCheckpoints`: list checkpoints for a mission
    - `rollback:preview`: generate rollback preview from checkpoint + audit record
    - `rollback:initiate`: execute rollback via `CheckpointManager.rollbackToCheckpoint()`

### Phase 6: Preload Bridge (preload/index.ts)

11. Add `audit` and `rollback` API surfaces:
    ```typescript
    audit: {
      getHistory: (filter?: { missionId?: string; limit?: number }) => Promise<AuditRecord[]>,
      getRecord: (id: string) => Promise<AuditRecord | null>,
      getCheckpoints: (missionId: string) => Promise<Checkpoint[]>,
    },
    rollback: {
      preview: (checkpointId: string) => Promise<RollbackPlan>,
      initiate: (checkpointId: string) => Promise<{ success: boolean; error: string | null }>,
    },
    ```

### Phase 7: UI (AuditPanel.tsx replacement)

12. Replace [`AuditPanel.tsx`](apps/desktop/src/renderer/components/panels/AuditPanel.tsx) with full implementation:
    - **Audit History Table**: shows recent audit records with risk class badges, timestamps, results
    - **Detail View**: click a record to see full audit details (risk dimensions, approval chain, evidence summary, checkpoint info)
    - **Checkpoint List**: shows available checkpoints with labels, git refs, creation times
    - **Rollback Section**: for each checkpoint, shows a "Preview Rollback" button and "Execute Rollback" button
    - **Rollback Confirmation Modal**: shows what will be reversed, what cannot be reversed, required approvals
    - Color-coded risk class badges (green for informational, yellow for medium, red for destructive, etc.)

### Phase 8: ApprovalCard.tsx adapter

13. Update [`ApprovalCard.tsx`](apps/desktop/src/renderer/components/ApprovalCard.tsx):
    - Add `riskClass` prop display alongside existing `rollbackDifficulty`
    - Show risk dimension breakdown in expandable section
    - Show evidence completeness indicator

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### Data Model
- **New table:** `audit_records` with 18 columns including JSON fields for parameters, risk dimensions, approval chain, and rollback plan
- **New types:** `AuditRecord`, `RiskClass`, `RiskAssessment`, `RiskDimension`, `ApprovalChainEntry`, `RollbackPlan`
- **Existing table reuse:** `checkpoints` table already exists; no schema change needed. `audit_records.checkpoint_id` creates the linkage.

### IPC
- **New channels:** `audit:getHistory`, `audit:getRecord`, `audit:getCheckpoints`, `rollback:preview`, `rollback:initiate`
- **Modified channels:** `approval:requestAction` (now creates audit records), `approval:humanDecision` (now updates audit records), `approval:getLog` (now reads from SQLite)
- **Backward compatibility:** All existing approval IPC channels remain functional. The `ApprovalApi` interface is extended, not replaced.

### API
- No external API changes. All changes are internal to the Electron app.
- The `assessRisk()` function is a pure function — no network calls.

### UI
- **AuditPanel.tsx** goes from 14-line placeholder to ~300-line component with 3 sub-views (history, detail, rollback)
- **ApprovalCard.tsx** gets minor prop additions for risk class display
- No changes to existing screens or navigation

### State
- Audit records are persisted to SQLite — no in-memory state for audit history
- Pending human approvals remain in-memory Map (unchanged from current design)
- Rollback state is ephemeral — generated on demand from checkpoint + audit record

### DevOps
- No DevOps changes. This component does not touch CI/CD, deploy pipelines, or service topology.
- The `privileged-production` risk class is defined but its two-step approval enforcement is deferred to Component 17 (which implements the full environment model).

---

## 7. Test Plan

### Unit Tests
1. **`assessRisk()` function tests:**
   - Test each risk class threshold boundary
   - Test multi-dimensional scoring with various inputs
   - Test edge cases: missing environment, no evidence, irreversible actions
   - Test backward compatibility: `classifyAction()` wrapper returns correct tiers

2. **`mapRiskClassToApprovalTier()` tests:**
   - Test all 6 risk class → tier mappings
   - Test that no risk class maps to an invalid tier

3. **`AuditStore` tests:**
   - Test CRUD operations against in-memory sql.js database
   - Test filtering by missionId, risk class, result
   - Test checkpoint linkage
   - Test rollback plan serialization/deserialization

### Integration Tests
4. **Approval flow tests:**
   - Test full flow: action → risk assessment → audit record creation → approval → result update
   - Test second-model review path with audit record creation
   - Test human approval path with audit record creation and result update

5. **Checkpoint linkage tests:**
   - Test that checkpoint creation before a risky action creates an audit record with checkpoint_id
   - Test that rollback to checkpoint updates the audit record result to 'rolled-back'

### UI Tests
6. **AuditPanel smoke tests:**
   - Test that panel renders with empty audit history
   - Test that panel renders with sample audit records
   - Test that clicking a record shows detail view
   - Test that rollback preview modal renders
   - Test that rollback confirmation modal renders

### Regression Tests
7. **Existing approval flow tests:**
   - Test that existing `ApprovalCard` still works with current props
   - Test that `ApprovalQueue` still displays correctly
   - Test that `ConversationScreen` approval integration still works

--- is the test plan.

---

## 8. Rollback Plan

### Per-implementation rollback
- All changes are on a feature branch
- If the risk engine refactor breaks existing approval flows, revert `approval-engine.ts` to the pre-change version and keep only the additive changes (new types, new table, new IPC channels)
- If the audit table schema causes issues, the table is additive — existing tables are untouched. Drop the `audit_records` table and revert to in-memory logger temporarily.

### Data migration rollback
- The `audit_records` table is new — no data migration from existing in-memory log is required (the in-memory log is session-scoped and not recoverable)
- If the table needs to be removed: `DROP TABLE IF EXISTS audit_records;` — no data loss because no existing data is migrated

### UI rollback
- If the new `AuditPanel.tsx` causes rendering issues, revert to the 14-line placeholder
- If `ApprovalCard.tsx` changes break the modal, revert to the pre-change version (new props are optional with defaults)

### Catastrophic rollback
- The pre-Component-19 commit is the restore point
- All planning documents in `rebuild/` are preserved regardless

---

## 9. Risks and Approvals Required

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `assessRisk()` scoring algorithm produces unexpected risk classifications | Medium | Medium | Start with conservative thresholds that map closely to existing 3-tier behavior. Tune after testing. |
| Audit record JSON serialization fails for complex parameters | Low | Medium | Use try/catch around JSON.parse/JSON.stringify. Store raw string fallback. |
| Main process approval handler refactor introduces race conditions | Low | High | The existing `pendingHumanApprovals` Map pattern is preserved. Only the classification and logging logic changes. |
| AuditPanel UI performance with large audit history | Low | Low | Implement pagination (limit/offset) from day one. Default limit: 50 records. |
| Checkpoint linkage fails if ChangeEngine is not yet fully integrated | Medium | Low | Checkpoint linkage is optional — audit records can exist without checkpoint_id. Graceful degradation. |

### Approvals Required

1. **Orchestrator approval:** This implementation analysis must be approved before coding begins.
2. **Architect approval (if needed):** The risk scoring algorithm design (dimension weights, thresholds) may need Architect review if it diverges significantly from the spec's intent.
3. **Reviewer-Pusher approval:** All code changes must be reviewed before any git push.

---

## 10. Explicit Non-Scope (What I Will NOT Build Yet)

The following items are explicitly excluded from Component 19 because they belong to later components in the fixed implementation order:

| Item | Belongs To | Reason |
|---|---|---|
| Deploy-time approval gates | Component 17 | Requires full environment model (local/preview/staging/production) |
| Incident-driven rollback execution | Component 21 | Requires incident detection, severity classification, and remediation planning |
| Migration safety classification | Component 18 | Requires schema introspection and destructive migration detection |
| Layered verification pipelines | Component 16 | Requires lint, type, build, test, browser verification infrastructure |
| Runtime log/trace capture | Component 15 | Requires runtime execution debugging and browser automation |
| Two-step human approval for privileged production | Component 17 | Requires environment model to determine "privileged production" context |
| Evidence bundle attachment to approval requests | Component 15 | Requires evidence capture infrastructure |
| Service topology-aware risk scoring | Component 17 | Requires service dependency mapping |
| Secrets/config change approval gates | Component 18 | Requires config inventory and secret-bearing action detection |
| Post-deploy watch mode integration | Component 21 | Requires observability and incident detection |

---

## 11. File Change Summary

| Action | File | Description |
|---|---|---|
| **Modify** | `apps/desktop/src/lib/shared-types/entities.ts` | Add `AuditRecord`, `RiskClass`, `RiskAssessment`, `RiskDimension`, `ApprovalChainEntry`, `RollbackPlan` types |
| **Modify** | `apps/desktop/src/lib/shared-types/ipc.ts` | Add `AuditChannel`, `RollbackChannel` interfaces; extend `VibeFlowAPI` |
| **Modify** | `apps/desktop/src/lib/storage/local-db.ts` | Add `audit_records` table schema; add 5 CRUD methods |
| **Modify** | `apps/desktop/src/lib/approval/approval-engine.ts` | Replace `classifyAction()` with `assessRisk()`; expand `ActionType` union; add `mapRiskClassToApprovalTier()` |
| **Replace** | `apps/desktop/src/lib/approval/approval-logger.ts` | Replace with `audit-store.ts` (SQLite-backed) |
| **Create** | `apps/desktop/src/lib/approval/audit-store.ts` | New audit store class wrapping LocalDb audit CRUD |
| **Modify** | `apps/desktop/src/main/index.ts` | Update approval handlers; add audit/rollback IPC handlers |
| **Modify** | `apps/desktop/src/preload/index.ts` | Add `audit` and `rollback` API surfaces |
| **Replace** | `apps/desktop/src/renderer/components/panels/AuditPanel.tsx` | Full audit history + checkpoint + rollback UI |
| **Modify** | `apps/desktop/src/renderer/components/ApprovalCard.tsx` | Add risk class display props |

**Total:** 10 files changed (8 modified, 1 created, 1 replaced)

---

## 12. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? **Yes** — approval-engine.ts refactored in place, ApprovalCard.tsx kept with adapter, checkpoint-manager.ts kept with adapter, local-db.ts refactored in place.
- [x] Did I build for missions rather than files? **Yes** — audit records link to missionId, checkpoints link to workspace runs which link to missions.
- [x] Did I preserve transparency without requiring programmer workflows? **Yes** — AuditPanel shows risk classes in plain English with color-coded badges.
- [x] Did I make MCP/capabilities first-class? **Yes** — audit records include capabilityId and roleSlug fields.
- [x] Did I attach evidence rather than confidence theater? **Yes** — audit records include evidenceSummary and evidenceCompleteness fields.
- [x] Did I classify risk and approvals? **Yes** — this is the core of Component 19.
- [x] Did I keep Git beneath the product surface? **Yes** — checkpoints use git refs internally; UI shows human-readable labels.
- [x] Did I avoid turning the shell back into VS Code? **Yes** — AuditPanel is a mission-centric audit view, not a file/git log viewer.

---

## 13. Gap Analysis Against Component Spec

| Spec Requirement (§) | How This Implementation Satisfies It |
|---|---|
| §2: classify actions by risk | `assessRisk()` function with 6 risk classes and multi-dimensional scoring |
| §2: attach required evidence bundles | `evidenceSummary` and `evidenceCompleteness` fields in `AuditRecord` (evidence capture deferred to C15, but fields are ready) |
| §2: request second-model or human approval | Existing flow preserved; `mapRiskClassToApprovalTier()` ensures correct tier routing |
| §2: persist action history | `audit_records` SQLite table + `AuditStore` class |
| §2: create checkpoints | Existing `CheckpointManager` wired into approval flow; `checkpoint_id` linked in audit records |
| §2: prepare rollback paths | `RollbackPlan` type + `rollback:preview` IPC + `rollback:initiate` IPC |
| §2: support incident-driven rollback execution | **Deferred to C21** — audit records have `result: 'rolled-back'` field for tracking |
| §3: risk classes (informational through privileged-production) | `RiskClass` type with all 6 values |
| §3: risk scoring dimensions | `RiskDimension[]` in `RiskAssessment` covering subsystem, environment, data risk, auth/security, blast radius, reversibility, evidence completeness, service mutation scope |
| §4: approval classes (auto, second-model, human, two-step human) | `mapRiskClassToApprovalTier()` maps risk classes to tiers; two-step human deferred to C17 |
| §5: audit record requirements (who, mission, plan step, role, capability, parameters, environment, evidence, approval chain, result, checkpoint, rollback) | All fields present in `AuditRecord` type |
| §6: checkpoints before medium+ risk changes | Approval handler creates checkpoint before executing medium+ risk actions |
| §6: rollback as first-class recovery option | AuditPanel shows rollback options prominently; rollback confirmation modal explains what will/won't be reversed |
| §7: rollback metadata (target state, reversible changes, irreversible changes, environment, data caveats, downtime, approvals) | All fields present in `RollbackPlan` type |
| §8: operator UX (why risky, evidence, who reviewed, what happens, how to undo) | AuditPanel detail view answers all 5 questions |
| §9: risk classes are real and enforced | `assessRisk()` is called for every action; tier routing is enforced |
| §9: terminal and service mutations not blanket-approved | `terminal:run` moved from Tier 1 to Tier 2; new service action types added with appropriate risk classes |
| §9: approvals are structured | `ApprovalChainEntry[]` in audit records |
| §9: rollback points are visible | AuditPanel checkpoint list + rollback section |
| §9: trustworthy audit chain | SQLite-backed audit records with full approval chain, risk assessment, and checkpoint linkage |

---

**End of implementation analysis. Awaiting Orchestrator approval before coding begins.**
