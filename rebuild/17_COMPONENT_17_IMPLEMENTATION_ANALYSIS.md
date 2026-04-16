# Component 17: Environments, Deployments, and Service Control Plane — Implementation Analysis

**Mode:** Builder (`qwen/qwen3.6-plus`)
**Date:** 2026-04-15
**Status:** Analysis-only — no code written
**Source spec:** [`rebuild/17_ENVIRONMENTS_DEPLOYMENTS_AND_SERVICE_CONTROL_PLANE.md`](rebuild/17_ENVIRONMENTS_DEPLOYMENTS_AND_SERVICE_CONTROL_PLANE.md)

---

## 1. Scope Summary

Component 17 is the **environment and deployment control plane**. It turns the existing flat `Environment` records into rich, actionable objects with host/platform metadata, deploy mechanisms, required secrets, linked services, health endpoints, protections, rollback methods, and mutability rules. It adds a deployment workflow (candidate selection → compatibility check → secrets/config completeness → approval → deploy → rollout observation → health checks → canary/smoke → verdict → rollback offer). It models a service control plane (app runtime, workers, database, storage, auth, queue, cron, CDN/DNS, email, analytics, third-party APIs) with knowledge of what each service is, where it lives, which environments use it, who can mutate it, and whether mutation is reversible. It adds preview environment lifecycle (create/destroy), production protection (stronger approvals, stronger evidence, explicit rollback readiness, service dependency indication, incident watch activation), and environment drift detection (missing secrets, mismatched service versions, config drift, untracked manual changes, schema mismatch, provider auth drift).

**Acceptance criteria from spec:**
- Environments are explicit objects
- Deploys are linked to candidates and evidence
- Runtime/service topology is visible
- Production deploys are guarded
- Drift and rollback state are visible before action

---

## 2. Explicit Non-Goals (Out of Scope)

The following are **explicitly excluded** from Component 17 to prevent scope drift:

| Excluded Area | Reason |
|---|---|
| **Packaging / electron-builder / auto-update** | DevOps owns this; Component 17 is about deploy workflows, not app distribution |
| **Cloud sync reactivation / Supabase realtime** | Component 22 already owns sync; Component 17 reads/writes local-first |
| **Component 21 observability / incident automation** | Watch panels, incident auto-creation, and post-deploy monitoring belong to Component 21 |
| **Component 18 secrets value storage** | Component 18 already owns secrets inventory; Component 17 only reads completeness status |
| **Component 19 approval engine redesign** | Component 17 consumes the existing approval system; it does not redesign it |
| **Component 16 verification orchestration** | Component 16 already runs verification; Component 17 triggers it as a pre-deploy gate |
| **Real migration execution** | Component 18 owns migration planning; Component 17 does not execute migrations |
| **Coolify API client rewrite** | Existing [`CoolifyClient`](apps/desktop/src/lib/devops/coolify-client.ts:16) is sufficient for v1 |
| **GitHub Actions client rewrite** | Existing [`GitHubActionsClient`](apps/desktop/src/lib/devops/github-actions-client.ts:15) is sufficient for v1 |

---

## 3. Salvage / Reuse Map

### 3.1 Types Already Present (reuse, extend)

| Type | Location | Reuse Status |
|---|---|---|
| [`Environment`](apps/desktop/src/lib/shared-types/entities.ts:455) | `entities.ts:455-464` | **EXTEND** — currently has only 7 fields; needs 12+ more per spec |
| [`EnvironmentType`](apps/desktop/src/lib/shared-types/entities.ts:453) | `entities.ts:453` | **REUSE** — already has `local | preview | staging | canary | production` |
| [`DeployCandidate`](apps/desktop/src/lib/shared-types/entities.ts:442) | `entities.ts:442-451` | **EXTEND** — needs evidence linkage, deploy verdict, rollback linkage |
| [`DeployRun`](apps/desktop/src/lib/shared-types/entities.ts:137) | `entities.ts:137-147` | **EXTEND** — needs environment linkage, evidence linkage, health verdict |
| [`ServiceNode`](apps/desktop/src/lib/shared-types/entities.ts:665) | `entities.ts:665-674` | **EXTEND** — needs environment linkage, mutability info, reversibility |
| [`ServiceEdge`](apps/desktop/src/lib/shared-types/entities.ts:677) | `entities.ts:677-683` | **REUSE** — already models service relationships |
| [`CapabilityHealth`](apps/desktop/src/lib/shared-types/entities.ts:316) | `entities.ts:316-322` | **REUSE** — already used for `Environment.serviceHealth` |
| [`SecretRecord`](apps/desktop/src/lib/shared-types/entities.ts:994) | `entities.ts:994-1010` | **REUSE** — Component 18 already provides secrets inventory |
| [`VerificationRun`](apps/desktop/src/lib/shared-types/entities.ts:950) | `entities.ts:950-966` | **REUSE** — pre-deploy verification gate |
| [`AuditRecord`](apps/desktop/src/lib/shared-types/entities.ts:912) | `entities.ts:912-931` | **REUSE** — deploy actions will be audited |
| [`RollbackPlan`](apps/desktop/src/lib/shared-types/entities.ts:900) | `entities.ts:900-909` | **REUSE** — deploy rollback plans |
| [`Checkpoint`](apps/desktop/src/lib/shared-types/entities.ts:817) | `entities.ts:817-823` | **REUSE** — pre-deploy checkpoints |
| [`ActionType`](apps/desktop/src/lib/shared-types/ipc.ts:306) | `ipc.ts:306-327` | **EXTEND** — add `deploy:promote`, `deploy:canary`, `env:create`, `env:destroy`, `env:drift-detect` |
| [`RiskClass`](apps/desktop/src/lib/shared-types/entities.ts:864) | `entities.ts:864-870` | **REUSE** — `privileged-production` already covers production deploys |

### 3.2 Runtime / Service Code Already Present (reuse)

| Module | Location | Reuse Status |
|---|---|---|
| [`CoolifyClient`](apps/desktop/src/lib/devops/coolify-client.ts:16) | `devops/coolify-client.ts` | **REUSE** — deploy, restart, stop, getApp |
| [`GitHubActionsClient`](apps/desktop/src/lib/devops/github-actions-client.ts:15) | `devops/github-actions-client.ts` | **REUSE** — list workflow runs |
| [`runHealthCheck`](apps/desktop/src/lib/devops/health-check.ts:12) | `devops/health-check.ts` | **REUSE** — URL-based health checks |
| [`DevOpsTemplate`](apps/desktop/src/lib/devops/devops-templates.ts:3) | `devops/devops-templates.ts` | **REUSE** — Standard and Albert templates |
| [`VerificationEngine`](apps/desktop/src/lib/verification/verification-engine.ts:30) | `verification/verification-engine.ts` | **REUSE** — pre-deploy verification gate |
| [`DeployCheckRunner`](apps/desktop/src/lib/verification/deploy-check-runner.ts:15) | `verification/deploy-check-runner.ts` | **REUSE** — Layer E deploy checks |
| [`SecretsStore`](apps/desktop/src/lib/secrets/secrets-store.ts:6) | `secrets/secrets-store.ts` | **REUSE** — secrets completeness checks |
| [`TopologyBuilder`](apps/desktop/src/lib/project-intelligence/topology-builder.ts) | `project-intelligence/topology-builder.ts` | **REUSE** — service topology aggregation |
| [`LocalDb`](apps/desktop/src/lib/storage/local-db.ts:96) | `storage/local-db.ts` | **EXTEND** — new tables, new CRUD methods |
| [`main/index.ts`](apps/desktop/src/main/index.ts:1) | `main/index.ts` | **EXTEND** — new IPC handlers |
| [`preload/index.ts`](apps/desktop/src/preload/index.ts:1) | `preload/index.ts` | **EXTEND** — new API surfaces |

### 3.3 UI Already Present (extend)

| Component | Location | Reuse Status |
|---|---|---|
| [`EnvironmentPanel.tsx`](apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx:1) | `panels/EnvironmentPanel.tsx` | **REPLACE** — currently shows 4 hardcoded default envs with a "Component 17 coming" note; needs full management UI |
| [`PanelWorkspace.tsx`](apps/desktop/src/renderer/components/PanelWorkspace.tsx) | `PanelWorkspace.tsx` | **REUSE** — already registers EnvironmentPanel |

### 3.4 What Must Be Created New

| New Module | Purpose |
|---|---|
| `deploy-engine.ts` | Orchestrates the 10-step deploy workflow (candidate selection → verdict) |
| `environment-manager.ts` | CRUD + lifecycle for environments (create preview, destroy preview, promote) |
| `service-control-plane.ts` | Service topology model with environment linkage, mutability, reversibility |
| `drift-detector.ts` | Detects and surfaces environment drift (secrets, versions, config, schema, auth) |
| `deploy-history.ts` | Persisted deploy history with evidence linkage and verdicts |
| `EnvironmentScreen.tsx` | Full environment management screen (or expand EnvironmentPanel significantly) |
| `DeployPanel.tsx` | Deploy workflow UI (candidate selection, progress, health, verdict, rollback) |
| `DriftPanel.tsx` | Drift detection results UI |

---

## 4. Required Type Changes

### 4.1 Extend `Environment` (entities.ts)

Current fields: `id, projectId, name, type, currentVersion, secretsComplete, serviceHealth, branchMapping`

**Add:**
```typescript
host: string | null;              // hostname or platform URL
deployMechanism: string | null;   // 'coolify', 'github-actions', 'manual', etc.
requiredSecrets: string[];        // secret key names required for this env
linkedServiceIds: string[];       // ServiceNode IDs linked to this env
healthEndpoint: string | null;    // URL for health checks
protections: EnvironmentProtection[]; // protection rules
rollbackMethod: string | null;    // 'coolify-rollback', 'git-revert', 'manual'
mutabilityRules: MutabilityRule[]; // who can mutate, under what conditions
```

### 4.2 New Types (entities.ts)

```typescript
export type EnvironmentProtection = 'require-approval' | 'require-evidence' | 'require-rollback-plan' | 'require-service-dependency-check' | 'require-incident-watch';

export interface MutabilityRule {
  role: string;           // who can mutate
  conditions: string[];   // under what conditions
  requiresApproval: boolean;
}

export interface ServiceControlPlane {
  projectId: string;
  services: ServiceNode[];
  edges: ServiceEdge[];
  environmentMappings: Record<string, string[]>; // envId -> serviceIds
  updatedAt: string;
}

export interface DeployWorkflow {
  id: string;
  candidateId: string;
  environmentId: string;
  steps: DeployStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled-back';
  verdict: 'promote' | 'block' | 'needs-review' | null;
  verdictReason: string | null;
  evidenceIds: string[];
  startedAt: string;
  completedAt: string | null;
  rollbackOffered: boolean;
}

export interface DeployStep {
  order: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DriftReport {
  id: string;
  projectId: string;
  environmentId: string;
  driftType: 'missing-secret' | 'version-mismatch' | 'config-drift' | 'manual-change' | 'schema-mismatch' | 'auth-drift';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  detectedAt: string;
  resolved: boolean;
}
```

### 4.3 Extend `DeployCandidate` (entities.ts)

**Add:**
```typescript
evidenceIds: string[];        // linked evidence from verification
verificationRunId: string | null;
rollbackCheckpointId: string | null;
```

### 4.4 Extend `DeployRun` (entities.ts)

**Add:**
```typescript
environmentId: string | null;
evidenceIds: string[];
healthVerdict: 'healthy' | 'unhealthy' | 'unknown' | null;
```

### 4.5 Extend `ActionType` (ipc.ts)

**Add:**
```typescript
| 'deploy:promote'
| 'deploy:canary'
| 'env:create'
| 'env:destroy'
| 'env:drift-detect'
| 'env:promote'
```

### 4.6 New IPC Channels (ipc.ts)

```typescript
export interface DeployChannel {
  initiate: (args: DeployInitiateArgs) => Promise<DeployWorkflow>;
  getStatus: (workflowId: string) => Promise<DeployWorkflow | null>;
  getHistory: (projectId: string) => Promise<DeployWorkflow[]>;
  rollback: (workflowId: string) => Promise<{ success: boolean; error: string | null }>;
}

export interface EnvironmentChannel {
  list: (projectId: string) => Promise<Environment[]>;
  get: (id: string) => Promise<Environment | null>;
  create: (env: Omit<Environment, 'id'>) => Promise<Environment>;
  update: (id: string, updates: Partial<Environment>) => Promise<Environment>;
  delete: (id: string) => Promise<{ success: boolean }>;
  createPreview: (projectId: string, branch: string) => Promise<Environment>;
  destroyPreview: (id: string) => Promise<{ success: boolean }>;
  promote: (fromEnvId: string, toEnvId: string, candidateId: string) => Promise<DeployWorkflow>;
}

export interface DriftChannel {
  detect: (projectId: string) => Promise<DriftReport[]>;
  getReports: (projectId: string) => Promise<DriftReport[]>;
  resolve: (reportId: string) => Promise<{ success: boolean }>;
}
```

---

## 5. Storage Changes (local-db.ts)

### 5.1 Extend `environments` table

Add columns via ALTER TABLE (brownfield-safe):
- `host TEXT`
- `deploy_mechanism TEXT`
- `required_secrets_json TEXT DEFAULT '[]'`
- `linked_service_ids_json TEXT DEFAULT '[]'`
- `health_endpoint TEXT`
- `protections_json TEXT DEFAULT '[]'`
- `rollback_method TEXT`
- `mutability_rules_json TEXT DEFAULT '[]'`

### 5.2 New tables

```sql
CREATE TABLE IF NOT EXISTS deploy_workflows (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  verdict TEXT,
  verdict_reason TEXT,
  evidence_ids_json TEXT DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  rollback_offered INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drift_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  drift_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved INTEGER DEFAULT 0
);
```

### 5.3 New CRUD methods

- `upsertDeployWorkflow()`, `getDeployWorkflow()`, `listDeployWorkflows()`, `updateDeployWorkflowStatus()`
- `insertDriftReport()`, `listDriftReports()`, `resolveDriftReport()`
- Extended `upsertEnvironment()` to handle new columns
- `createPreviewEnvironment()`, `destroyPreviewEnvironment()`

---

## 6. Runtime / Service Changes

### 6.1 `deploy-engine.ts` (new)

Orchestrates the 10-step deploy workflow:
1. Candidate selected
2. Environment compatibility checked
3. Secrets/config completeness checked (reuses `SecretsStore`)
4. Approval confirmed (reuses existing approval engine)
5. Deploy initiated (reuses `CoolifyClient`)
6. Rollout progress observed
7. Health checks run (reuses `runHealthCheck`)
8. Canary comparison or smoke flow run
9. Deploy verdict recorded
10. Rollback offered if regression appears

**Key design:** Each step produces a `DeployStep` record. The engine persists state after each step. If any step fails, the workflow status becomes `failed` and rollback is offered.

### 6.2 `environment-manager.ts` (new)

- CRUD for environments with validation
- Preview environment lifecycle: create from branch, destroy
- Promotion: from one environment to another (e.g., staging → production)
- Validates mutability rules before any mutation

### 6.3 `service-control-plane.ts` (new)

- Aggregates `ServiceNode` and `ServiceEdge` data from Component 11's `TopologyBuilder`
- Adds environment-to-service mappings
- Tracks mutability and reversibility per service
- Provides a queryable model: "which services does this environment depend on?"

### 6.4 `drift-detector.ts` (new)

- Compares environment records against actual state
- Checks: missing secrets (reuses `SecretsStore.getMissingForEnvironment()`), version mismatches, config drift, schema mismatch (reuses Component 18 migration history), auth drift
- Produces `DriftReport` records with severity levels

---

## 7. IPC Wiring Changes

### 7.1 `main/index.ts` — Add handlers

- `deploy:initiate`, `deploy:getStatus`, `deploy:getHistory`, `deploy:rollback`
- `environment:list`, `environment:get`, `environment:create`, `environment:update`, `environment:delete`, `environment:createPreview`, `environment:destroyPreview`, `environment:promote`
- `drift:detect`, `drift:getReports`, `drift:resolve`

### 7.2 `preload/index.ts` — Expose APIs

- `window.vibeflow.deploy.*`
- `window.vibeflow.environment.*`
- `window.vibeflow.drift.*`

---

## 8. UI Changes

### 8.1 Replace `EnvironmentPanel.tsx`

Current state: Shows 4 hardcoded default environments with a "Component 17 coming" note.

**New design:**
- **Environment list view** — shows all environments with health status, version, secrets completeness, protections
- **Environment detail view** — shows host, deploy mechanism, linked services, health endpoint, rollback method, mutability rules
- **Create environment** button — form to add new environments (local, preview, staging, canary, production)
- **Preview lifecycle** — create preview from branch, destroy preview
- **Promotion button** — promote from one environment to another (triggers deploy workflow)
- **Drift indicator** — shows drift count per environment

### 8.2 New `DeployPanel.tsx`

- Shows active deploy workflows with step-by-step progress
- Shows deploy history with verdicts and evidence links
- Rollback button for failed deploys
- Links to verification results

### 8.3 New `DriftPanel.tsx` (or tab in EnvironmentPanel)

- Lists all drift reports with severity badges
- Filter by environment, type, severity
- Resolve button per report
- "Run drift detection" button

---

## 9. Approval and Risk Boundaries

| Action | Risk Class | Approval Tier | Notes |
|---|---|---|---|
| Create preview environment | `low` | Tier 1 (auto) | Reversible, no production impact |
| Destroy preview environment | `low` | Tier 1 (auto) | Reversible |
| Deploy to staging | `medium` | Tier 2 (second-model review) | Non-production but customer-visible |
| Deploy to canary | `high` | Tier 2 (second-model review) | Partial production exposure |
| Deploy to production | `privileged-production` | Tier 3 (human approval) | Full production impact |
| Promote staging → production | `privileged-production` | Tier 3 (human approval) | Must pass verification gate first |
| Rollback production | `high` | Tier 2 (second-model review) | Reversible but customer-impacting |
| Modify environment protections | `medium` | Tier 2 (second-model review) | Changes safety guardrails |

---

## 10. Deploy / Rollback Boundaries

### 10.1 Deploy Boundaries

- **Pre-deploy gate:** VerificationEngine must return `promote` verdict before deploy proceeds
- **Secrets gate:** `Environment.secretsComplete` must be true (computed from `SecretRecord` inventory)
- **Approval gate:** Per the risk table above
- **Checkpoint gate:** Pre-deploy checkpoint created via Component 13's checkpoint system
- **Evidence linkage:** Deploy workflow records evidence IDs from verification run

### 10.2 Rollback Boundaries

- **Rollback trigger:** Deploy verdict is `block` OR health check fails post-deploy
- **Rollback method:** Uses `Environment.rollbackMethod` field
- **Rollback target:** Pre-deploy checkpoint (Component 13) or previous `DeployCandidate` version
- **Rollback audit:** All rollback actions logged as `AuditRecord` with `result: 'rolled-back'`
- **Rollback UI:** DeployPanel shows rollback button with preview of what will be reverted

---

## 11. Test Plan

### 11.1 Unit Tests

| Test | Module | Coverage |
|---|---|---|
| Deploy workflow step sequencing | `deploy-engine.ts` | All 10 steps execute in order, failure at any step halts workflow |
| Environment CRUD validation | `environment-manager.ts` | Required fields validated, mutability rules enforced |
| Preview lifecycle | `environment-manager.ts` | Create from branch, destroy, idempotent destroy |
| Drift detection | `drift-detector.ts` | Each drift type detected correctly, severity assigned |
| Service control plane queries | `service-control-plane.ts` | Environment-to-service mapping correct |
| Promotion flow | `environment-manager.ts` | Source/target validation, candidate linkage |

### 11.2 Integration Tests

| Test | Scope |
|---|---|
| Deploy workflow with mock CoolifyClient | Full 10-step workflow with mocked external calls |
| Deploy workflow with failing health check | Steps 1-7 pass, step 7 fails, rollback offered |
| Pre-deploy verification gate | VerificationEngine returns `block`, deploy does not proceed |
| Secrets completeness gate | Missing secrets block deploy |
| Approval gate | Production deploy requires human approval |

### 11.3 Smoke Tests

- `tsc --noEmit` passes with zero errors
- App launches, EnvironmentPanel renders with real data from SQLite
- Create environment, verify it persists
- Deploy workflow UI shows step progress
- Drift detection runs and displays results

---

## 12. Rollback Plan

If Component 17 implementation introduces issues:

1. **Type-level rollback:** All new types are additive. Removing them from `entities.ts` and `ipc.ts` will cause compile errors in new code only — old code remains unaffected.
2. **Storage-level rollback:** New tables use `CREATE TABLE IF NOT EXISTS`. New columns use `ALTER TABLE ADD COLUMN`. Old code ignores new columns. No data loss possible.
3. **UI-level rollback:** Replace `EnvironmentPanel.tsx` with the previous version (the one with the "Component 17 coming" note). Remove `DeployPanel.tsx` and `DriftPanel.tsx` from `PanelWorkspace.tsx` registration.
4. **IPC-level rollback:** Remove new IPC handlers from `main/index.ts` and new API surfaces from `preload/index.ts`. Old handlers remain untouched.
5. **Runtime-level rollback:** New modules (`deploy-engine.ts`, `environment-manager.ts`, `service-control-plane.ts`, `drift-detector.ts`) are not imported by any existing code. Removing them has zero impact on existing functionality.

---

## 13. Risks and Dependencies

### 13.1 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `main/index.ts` has massive duplicated IPC handler blocks (secrets/migration handlers repeated 6+ times) | **High** | This is a pre-existing issue. Component 17 must add handlers cleanly without adding to the duplication. A cleanup task should be filed separately. |
| `EnvironmentPanel.tsx` currently uses hardcoded default environments instead of SQLite data | **Medium** | Component 17 must switch to real SQLite-backed environments. This is a breaking change for the panel but additive for the data layer. |
| Coolify client only supports deploy/restart/stop — no rollback API | **Medium** | Rollback will be implemented as "deploy previous version" via Coolify deploy API. Document this limitation. |
| Health check uses hardcoded URL pattern (`http://${env.name}.example.com/health`) | **Medium** | Component 17 must use `Environment.healthEndpoint` field instead. |
| Deploy workflow is synchronous — long-running deploys may block | **Low** | Deploy steps should be async with status polling. The UI should show progress, not block. |
| Drift detection may produce false positives for manual changes | **Low** | Drift reports should be informational by default, not blocking. |

### 13.2 Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Component 11 (Project Intelligence) | ✅ Complete | Provides `ServiceNode`, `ServiceEdge`, `TopologyBuilder` |
| Component 13 (Change Engine) | ✅ Complete | Provides checkpoints for pre-deploy rollback |
| Component 16 (Verification) | ✅ Complete | Provides pre-deploy verification gate |
| Component 18 (Secrets) | ✅ Complete | Provides `SecretRecord`, `SecretsStore`, completeness tracking |
| Component 19 (Approval/Audit) | ✅ Complete | Provides approval engine, audit records, rollback plans |
| DevOps (Coolify/GitHub) | ✅ Complete | Provides deploy clients and health check |
| Component 21 (Observability) | ❌ Not started | Incident watch activation is a Component 21 concern — Component 17 only flags the requirement |

---

## 14. Recommended Phased Implementation Plan

### Phase 1: Type and Storage Foundation (lowest risk)
- Extend `Environment` type in `entities.ts` with new fields
- Add `DeployWorkflow`, `DeployStep`, `DriftReport`, `ServiceControlPlane`, `EnvironmentProtection`, `MutabilityRule` types
- Extend `DeployCandidate` and `DeployRun` types
- Extend `ActionType` union in `ipc.ts`
- Add `DeployChannel`, `EnvironmentChannel`, `DriftChannel` IPC interfaces
- Extend `environments` table with ALTER TABLE ADD COLUMN
- Create `deploy_workflows` and `drift_reports` tables
- Add all new CRUD methods to `LocalDb`

### Phase 2: Runtime Services (core logic, no UI)
- Create `environment-manager.ts` — CRUD + preview lifecycle + promotion
- Create `service-control-plane.ts` — service topology with environment linkage
- Create `drift-detector.ts` — drift detection for all 6 drift types
- Create `deploy-engine.ts` — 10-step deploy workflow orchestration

### Phase 3: IPC Wiring
- Add deploy, environment, and drift IPC handlers to `main/index.ts`
- Add deploy, environment, and drift API surfaces to `preload/index.ts`
- Wire `DeployEngine` and `EnvironmentManager` instances in main process

### Phase 4: UI Surfaces
- Replace `EnvironmentPanel.tsx` with full environment management UI
- Create `DeployPanel.tsx` — deploy workflow progress and history
- Create `DriftPanel.tsx` — drift detection results
- Register new panels in `PanelWorkspace.tsx`

### Phase 5: Integration and Polish
- Wire pre-deploy verification gate (VerificationEngine → DeployEngine)
- Wire secrets completeness gate (SecretsStore → DeployEngine)
- Wire approval gate (existing approval engine → DeployEngine)
- Wire checkpoint creation before deploy (ChangeEngine → DeployEngine)
- Wire evidence linkage (EvidenceCaptureEngine → DeployWorkflow)

### Phase 6: Tests and Verification
- Unit tests for deploy-engine, environment-manager, drift-detector
- Integration tests for deploy workflow with mocked external calls
- Smoke test: `tsc --noEmit` passes
- Manual test: create environment, run deploy workflow, verify rollback

---

## 15. Deferred Items (Future Components)

| Item | Deferred To | Reason |
|---|---|---|
| Incident watch activation after deploy | Component 21 | Observability subsystem not yet built |
| Real-time deploy progress streaming | Later | Current IPC is request/response; streaming would need event channel |
| Coolify rollback API integration | Later | Coolify API may not support explicit rollback; current approach is "deploy previous version" |
| Multi-environment promotion chains | Later | Complex workflow; v1 is single-step promotion |
| Deploy canary analysis automation | Later | Requires metrics collection (Component 21) |
| Environment template system | Later | Nice-to-have; not in acceptance criteria |

---

## 16. Boundary Analysis with Adjacent Components

| Component | Boundary | How Component 17 Stays Out |
|---|---|---|
| **Component 16 (Verification)** | Component 17 triggers verification but does not implement checks | Calls `VerificationEngine.runVerification()` and reads verdict |
| **Component 18 (Secrets)** | Component 17 reads completeness but does not manage secret values | Calls `SecretsStore.getInventorySummary()` and `getMissingForEnvironment()` |
| **Component 19 (Approval/Audit)** | Component 17 creates audit records but does not redesign approval | Uses existing `classifyAction()` and `AuditRecord` types |
| **Component 21 (Observability)** | Component 17 flags incident watch requirement but does not create incidents | Sets a flag in `DeployWorkflow`; Component 21 reads it later |
| **Component 13 (Change Engine)** | Component 17 creates checkpoints but does not manage workspaces | Calls existing checkpoint API; does not touch worktree logic |

---

## 17. Summary

Component 17 is **broadly implementable** with the existing brownfield codebase. The type system already has `Environment`, `DeployCandidate`, `DeployRun`, `ServiceNode`, `ServiceEdge`, and all the supporting types from Components 11, 13, 16, 18, and 19. The runtime already has `CoolifyClient`, `GitHubActionsClient`, `runHealthCheck`, `VerificationEngine`, `SecretsStore`, and `TopologyBuilder`. The storage layer already has `environments`, `deploy_candidates`, `deploy_runs`, `service_nodes`, and `service_edges` tables.

The primary work is:
1. **Extending** existing types and tables (not creating from scratch)
2. **Creating** 4 new runtime modules (deploy-engine, environment-manager, service-control-plane, drift-detector)
3. **Replacing** the placeholder `EnvironmentPanel.tsx` with a real management UI
4. **Adding** 3 new IPC channels (deploy, environment, drift) with ~20 handlers
5. **Wiring** pre-deploy gates (verification, secrets, approval, checkpoint)

The implementation is additive and brownfield-safe. No existing functionality will be broken by the changes. Rollback is straightforward: remove new modules, revert UI, remove IPC handlers.

**Recommendation:** Proceed with phased implementation as outlined in Section 14. Estimated effort: 6 phases, with Phase 1-2 being the heaviest (type/storage + runtime logic), Phase 3-4 being moderate (IPC + UI), and Phase 5-6 being integration and testing.
