# Mission Lifecycle Wiring Plan

**Audience:** Builder  
**Status:** Design — do NOT implement until this document is accepted  
**Date:** 2026-04-18  
**Scope:** Wiring the 18-step mission lifecycle using the 13 existing runtime service modules. No new services are defined. This document describes plumbing only.

---

## 1. Entry Point — Chat vs. Mission

Today every user message hits `conversations:sendMessage`, which calls `runOrchestrator()` for a streaming chat reply. The lifecycle fork must happen **before** `runOrchestrator()` is called.

### Decision rule (to be checked inside `conversations:sendMessage`)

| Condition | Path |
|---|---|
| Message begins with `/mission` OR contains a structured-intent marker set by the UI | Mission lifecycle path → call `missions:start` |
| Otherwise | Existing chat path (no change) |

**Preferred approach:** Add a `missionMode: boolean` flag to `SendMessageArgs`. The renderer's "Send" button grows a mode toggle (chat vs. mission). When `missionMode: true`, the handler short-circuits the chat path and invokes the mission orchestrator instead. This avoids any intent-sniffing heuristics.

---

## 2. Mission Record Location

| Entity | Table | Notes |
|---|---|---|
| `Mission` | `missions` | Already exists in `LocalDb` with `getMission`, `updateMission` |
| `Plan` | `plans` + `plan_steps` | Already exists; `upsertPlan` writes both |
| `ContextPackEnriched` | `context_packs` + `context_items` + `context_warnings` | Already exists |
| `WorkspaceRun` | `workspace_runs` | Already exists |
| `ChangeSet` | `change_sets` | Already exists |
| `VerificationRun` | `verification_runs` | Already exists |
| **`MissionLifecycleState`** | **NEW: `mission_lifecycle_state`** | One row per mission; tracks current step index and lifecycle status. See §9. |

The `Mission.status` field (`MissionStatus`) already covers `draft | planning | ready | running | paused | completed | failed | cancelled`. The new `MissionLifecycleState` table adds the **current step number** (1–18) so the UI knows where to resume after a crash.

---

## 3. Step-by-Step Service Wiring

All calls originate in a new main-process coordinator: **`MissionOrchestrator`** (a plain class in `apps/desktop/src/main/handlers/mission-orchestrator.ts`, NOT a new lib service). It uses existing injected services from `state.ts`.

### Steps 1–3: Intent → Plan

| Step | Who calls | What | Return |
|---|---|---|---|
| 1 | Renderer sends `missionMode: true` message | `conversations:sendMessage` saves user `Message`, creates a new `Mission` record (`status: 'draft'`) | `Mission` |
| 2 | `conversations:sendMessage` | calls `localDb.createMission(mission)` with `operatorRequest = args.content` | `Mission` |
| 3 | `MissionOrchestrator.run(missionId)` | calls `OrchestrationEngine.decomposeMission(mission)` → `PlanRecord`; handler already calls `localDb.upsertPlan()` and sets `mission.status = 'planning'` | `PlanRecord` |

`OrchestrationEngine.decomposeMission(mission: Mission): Promise<PlanRecord>` — already implemented.

After step 3, emit IPC event `mission:planReady` with `{ missionId, plan }` so the renderer can display the plan panel.

### Steps 4–5: Context + Impact

| Step | Who calls | What | Return |
|---|---|---|---|
| 4 | `MissionOrchestrator` | `ContextPackAssembler.assemble(missionId, { includeMemory: true, missionTitle, operatorRequest })` | `ContextPackEnriched` |
| 5 | `MissionOrchestrator` | `ImpactAnalyzer.analyze(missionId, affectedSubsystems)` — already used inside `ContextPackAssembler`; surface separately for the UI | `ImpactAnalysis` |

`ContextPackAssembler.assemble(missionId, options: ContextPackOptions): ContextPackEnriched` — already implemented.  
Persist: `localDb.upsertContextPack(pack)` — already exists.  
Emit `mission:contextReady` with `{ missionId, pack, dashboard: ContextDashboard }`.

### Step 6: Risk Classification

| Step | Who calls | What | Return |
|---|---|---|---|
| 6 | `MissionOrchestrator` | `ApprovalEngine.assessRisk(action)` using the plan's `riskClasses` and `affectedSubsystems` from the `PlanRecord` | `RiskAssessment` |

`ApprovalEngine.assessRisk(action: ActionRequest): RiskAssessment` — already implemented (Component 19).  
Store result in `MissionLifecycleState.riskAssessment` (JSON column).

### Step 7: Approval Gate

| Step | Who calls | What | Return |
|---|---|---|---|
| 7 | `MissionOrchestrator` | `ApprovalEngine.classifyAction(action, modes, { isSelfMaintenance })` → tier; if tier = 3, emit `mission:awaitingApproval` and suspend | `ApprovalResult` |

If tier 3: set `Mission.status = 'paused'`, emit `mission:awaitingApproval` to renderer (existing `approval:pendingApproval` event works). When user approves via `approval:humanDecision`, `MissionOrchestrator` resumes from step 8.

### Steps 8–9: Changes in Isolated Workspace

| Step | Who calls | What | Return |
|---|---|---|---|
| 8 | `MissionOrchestrator` (per plan step that has `roleSlug = 'coder'`) | `ChangeEngine.createWorkspaceRun(missionId, planStepId, projectRoot)` → `WorkspaceRun`; then for each code patch: `ChangeEngine.applyPatch(workspaceRunId, patch)` | `WorkspaceRun`, `FileEdit[]` |
| 9 | Called automatically inside `ChangeEngine.applyPatch()` | `ValidityPipeline.runMinimalValidationSet(affectedFiles, worktreePath)` — runs on each patch application | `EvidenceItem[]` |

`ChangeEngine.createWorkspaceRun(missionId, planStepId, projectRoot): WorkspaceRun` — already implemented.  
`ChangeEngine.applyPatch(workspaceRunId, patch: PatchEdit): FileEdit` — already implemented; runs validity inline.  
Emit `mission:workspaceProgress` with `{ missionId, workspaceRunId, fileEdits }` for the editor/diff panel.

Patch proposals come from: `OrchestrationEngine.executeStep(assignment: RoleAssignment): Promise<StepExecutionResult>`. The `actualOutput` of the coder step is the patch payload, which `MissionOrchestrator` parses and passes to `ChangeEngine.applyPatch()`.

### Steps 10–11: Verification + Changeset

| Step | Who calls | What | Return |
|---|---|---|---|
| 10 | `MissionOrchestrator` | `VerificationEngine.runVerification({ missionId, workspaceRunId, changesetId, riskClass, affectedFiles, workspacePath, riskAssessment })` | `VerificationRun` |
| 11 | `MissionOrchestrator` | `ChangeEngine.getChangeSet(workspaceRunId)` | `ChangeSet` |

`VerificationEngine.runVerification(args): Promise<VerificationRun>` — already implemented.  
Returns `VerificationRun.verdict: 'promote' | 'block' | 'needs-review'`.  
If `verdict = 'block'`: set `Mission.status = 'failed'`, emit `mission:blocked`.  
If `verdict = 'needs-review'`: set `Mission.status = 'paused'`, emit `mission:awaitingApproval`.  
If `verdict = 'promote'`: proceed to step 12.

Emit `mission:verificationComplete` with `{ missionId, run: VerificationRun, changeSet: ChangeSet }`.

### Steps 12–15: Deploy

| Step | Who calls | What | Return |
|---|---|---|---|
| 12 | `MissionOrchestrator` | `DeployEngine.promoteToPreview(missionId, workspaceRunId, environmentId)` | `DeployCandidate` |
| 13 | `MissionOrchestrator` | `VerificationEngine.runVerification({ ..., bundleId: 'bundle-high', riskClass: 'high' })` | `VerificationRun` |
| 14 | `MissionOrchestrator` | Re-run `ApprovalEngine.classifyAction()` for `deploy:promote` action type — protected envs require tier 3 | `ApprovalResult` |
| 15 | `MissionOrchestrator` | `DeployEngine.runWorkflow(candidateId, environmentId)` | `DeployWorkflow` |

Emit `mission:deployProgress` with `{ missionId, workflow: DeployWorkflow }`.

### Steps 16–18: Watch + Reporting

| Step | Who calls | What | Return |
|---|---|---|---|
| 16 | `MissionOrchestrator` (after deploy completes) | `WatchEngine.startWatchSession(projectId, environmentId, deployWorkflowId)` | `WatchSession` |
| 17 | `MissionOrchestrator` (on watch session summary) | `SelfHealingEngine.buildReport(watchSession)` — formats plain-English summary | `string` (report text) |
| 18 | `WatchEngine` → anomaly detected → `SelfHealingEngine.proposeRemediation(anomaly)` | Emits `mission:anomalyDetected`; renderer shows rollback offer | `SelfHealingAction` |

Set `Mission.status = 'completed'` after successful watch window closes.

---

## 4. Mission State Machine

```
draft
  → planning       (decomposeMission called)
  → ready          (plan + context assembled, approval passed)
  → running        (workspace created, changes applying)
  → paused         (awaiting human approval OR needs-review verdict)
  → completed      (watch session closed cleanly)
  → failed         (verification blocked OR deploy failed)
  → cancelled      (user explicitly cancelled)

paused → running   (human approves)
paused → cancelled (human rejects)
failed → running   (user triggers retry from failed step)
running → paused   (approval gate mid-run)
```

Valid transitions only — no skipping from `draft` to `completed`. The `MissionLifecycleState.currentStep` integer (1–18) must move forward monotonically unless the user triggers a retry.

---

## 5. UI Surface Map

| Step(s) | Panel | What is shown |
|---|---|---|
| 1–2 | Chat panel (existing) | User message, streaming acknowledgement |
| 3 | Execution stream panel (top-left) | Plan steps listed as `[info] Step N: …` events |
| 4 | New: Context Dashboard panel (replaces blank state in right panel) | `ContextDashboard`: files, symbols, memory packs, warnings |
| 5–6 | Execution stream | Affected subsystems, risk class label |
| 7 | Approval card overlay (existing `ApprovalCard` component) | Tier 3 approval prompt |
| 8–9 | Editor/Diff panel (top-right) | File edits streamed as patches are applied |
| 9 | Terminal panel (bottom) | Validity check output |
| 10 | Execution stream + new Verification panel tab | `VerificationRun` check list, verdict badge |
| 11 | Editor/Diff panel | `ChangeSet` semantic groups view |
| 12–15 | New: Deploy panel tab (bottom right) | `DeployWorkflow` step progress |
| 16 | New: Watch badge in header | `WatchSession` probe statuses |
| 17 | Chat panel | Plain-English result summary message (assistant role) |
| 18 | Approval card overlay | Rollback offer card |

No new screens are required for the MVP slice. New panels are **tabs** within the existing 5-panel layout.

---

## 6. Minimum Viable Slice (Steps 1–11)

This subset produces a visible end-to-end demo without deploy/watch infrastructure.

**Included:** Steps 1–11 (intent → plan → context → risk → approval gate → workspace changes → validity → verification → changeset view)  
**Excluded:** Steps 12–18 (deploy, watch, self-healing)

### MVP acceptance criteria
- User types a message with "mission mode" toggled
- A `Mission` record is created and shown
- A `PlanRecord` is decomposed and displayed as step cards in the execution stream
- A `ContextPackEnriched` is assembled and the context dashboard shows file count, memory packs, warnings
- If risk is high, an approval card appears; user can approve/reject
- A `WorkspaceRun` is created; file edits appear in the diff panel
- A `VerificationRun` runs and its verdict (promote/block/needs-review) is shown
- A `ChangeSet` semantic summary is shown in the diff panel

---

## 7. New Types and Interfaces Required

Add to `apps/desktop/src/lib/shared-types/entities.ts`:

| Type | Shape (description only) |
|---|---|
| `MissionLifecycleState` | `{ missionId, currentStep: number (1–18), lifecycleStatus: MissionLifecycleStatus, riskAssessment: RiskAssessment or null, workspaceRunId: string or null, verificationRunId: string or null, deployWorkflowId: string or null, watchSessionId: string or null, updatedAt }` |
| `MissionLifecycleStatus` | `'idle' \| 'running' \| 'awaiting-approval' \| 'blocked' \| 'completed' \| 'failed'` |
| `MissionStartArgs` | `{ projectId, title, operatorRequest, conversationId }` — args for `missions:start` IPC channel |
| `MissionProgressEvent` | `{ missionId, step: number, event: string, payload: unknown }` — generic push event from main → renderer |

Add to `apps/desktop/src/lib/shared-types/ipc.ts` (or equivalent IPC type file):

| Channel | Direction | Payload |
|---|---|---|
| `missions:start` | renderer → main | `MissionStartArgs` → `Mission` |
| `missions:get` | renderer → main | `missionId: string` → `Mission or null` |
| `missions:getLifecycleState` | renderer → main | `missionId: string` → `MissionLifecycleState or null` |
| `missions:cancel` | renderer → main | `missionId: string` → `void` |
| `missions:retry` | renderer → main | `{ missionId, fromStep: number }` → `void` |
| `mission:planReady` | main → renderer (push) | `{ missionId, plan: PlanRecord }` |
| `mission:contextReady` | main → renderer (push) | `{ missionId, pack: ContextPackEnriched, dashboard: ContextDashboard }` |
| `mission:awaitingApproval` | main → renderer (push) | `{ missionId, action: ActionRequest, tier: ApprovalTier }` |
| `mission:workspaceProgress` | main → renderer (push) | `{ missionId, workspaceRunId, fileEdits: FileEdit[] }` |
| `mission:verificationComplete` | main → renderer (push) | `{ missionId, run: VerificationRun, changeSet: ChangeSet }` |
| `mission:deployProgress` | main → renderer (push) | `{ missionId, workflow: DeployWorkflow }` |
| `mission:anomalyDetected` | main → renderer (push) | `{ missionId, anomaly: AnomalyEvent, action: SelfHealingAction }` |
| `mission:completed` | main → renderer (push) | `{ missionId, summary: string }` |
| `mission:failed` | main → renderer (push) | `{ missionId, reason: string, step: number }` |

---

## 8. New IPC Handlers Required

Add a new file: `apps/desktop/src/main/handlers/missions.ts`

| Handler | What it does |
|---|---|
| `missions:start` | Creates `Mission` + `MissionLifecycleState`, spawns `MissionOrchestrator.run()` async |
| `missions:get` | Returns `localDb.getMission(id)` |
| `missions:getLifecycleState` | Returns `localDb.getMissionLifecycleState(missionId)` |
| `missions:cancel` | Sets `Mission.status = 'cancelled'`, signals orchestrator to stop |
| `missions:retry` | Resets `MissionLifecycleState.currentStep` to `fromStep`, resumes orchestrator |

Register in `apps/desktop/src/main/handlers/index.ts` alongside existing handlers.

**Modify** `apps/desktop/src/main/handlers/conversations.ts`:  
Add `missionMode` branch: if `args.missionMode === true`, call `missions:start` internally instead of `runOrchestrator()`.

---

## 9. New LocalDb Tables / Columns Required

| Table | Columns | Notes |
|---|---|---|
| `mission_lifecycle_state` | `mission_id TEXT PK`, `current_step INTEGER DEFAULT 1`, `lifecycle_status TEXT`, `risk_assessment_json TEXT`, `workspace_run_id TEXT`, `verification_run_id TEXT`, `deploy_workflow_id TEXT`, `watch_session_id TEXT`, `updated_at TEXT` | One row per mission; upserted at each step transition |

Add to `LocalDb`:
- `upsertMissionLifecycleState(state: MissionLifecycleState): void`
- `getMissionLifecycleState(missionId: string): MissionLifecycleState | null`

No other new tables are needed — all other entities already have their tables.

---

## 10. Existing Files to Modify

| File | Change needed |
|---|---|
| `apps/desktop/src/main/handlers/conversations.ts` | Add `missionMode?: boolean` branch: if true, delegate to `MissionOrchestrator` instead of `runOrchestrator()` |
| `apps/desktop/src/main/handlers/state.ts` | Export `missionOrchestrator` singleton (like `orchestrationEngine`) |
| `apps/desktop/src/main/handlers/index.ts` | Register `registerMissionsHandlers()` |
| `apps/desktop/src/lib/shared-types/entities.ts` | Add `MissionLifecycleState`, `MissionLifecycleStatus` |
| `apps/desktop/src/lib/shared-types/ipc.ts` (or wherever IPC types live) | Add all `missions:*` and `mission:*` channel types from §7 |
| `apps/desktop/src/lib/storage/local-db.ts` | Add `mission_lifecycle_state` table DDL, `upsertMissionLifecycleState`, `getMissionLifecycleState` |
| `apps/desktop/src/renderer/screens/ConversationScreen.tsx` | Add mission mode toggle to send button; subscribe to `mission:*` push events; render context dashboard, verification, and deploy tabs |
| `apps/desktop/src/renderer/App.tsx` | Pass `missionMode` state down to `ConversationScreen` if needed |

**New files to create (Builder):**
- `apps/desktop/src/main/handlers/missions.ts` — IPC handler registration
- `apps/desktop/src/main/mission-orchestrator.ts` — `MissionOrchestrator` class (the 18-step coordinator)

---

## Key Constraints for Builder

1. `MissionOrchestrator` is a coordinator, not a new service. It calls existing services in sequence. Do not rewrite any existing service.
2. The existing `conversations:sendMessage` chat path must be untouched when `missionMode` is false or absent.
3. Each step transition must persist `MissionLifecycleState.currentStep` before awaiting the next async call, so crashes are recoverable.
4. `OrchestrationEngine.executeStep()` returns `actualOutput: string` — the coder's output is expected to be a JSON patch payload. `MissionOrchestrator` is responsible for parsing that output into `PatchEdit[]` objects before calling `ChangeEngine.applyPatch()`.
5. The approval gate (step 7) uses `approval:humanDecision` IPC which already exists. `MissionOrchestrator` must await a promise that resolves when the human responds (use a `Map<actionId, resolve>` callback registry in the handler).
