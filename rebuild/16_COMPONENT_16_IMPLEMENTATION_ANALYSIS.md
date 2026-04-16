# Component 16: Verification and Acceptance System — Implementation Analysis

**Version:** 1.0
**Date:** 2026-04-14
**Author:** Builder (`qwen/qwen3.6-plus`)
**Governing spec:** [`16_VERIFICATION_AND_ACCEPTANCE_SYSTEM.md`](16_VERIFICATION_AND_ACCEPTANCE_SYSTEM.md)
**Predecessor components:** 10 (Shell), 22 (Sync), 12 (Orchestration), 14 (Capability Fabric), 11 (Project Intelligence), 13 (Change Engine), 19 (Approval/Risk/Audit), 15 (Runtime/Evidence)

---

## 1. Scope Summary

Component 16 builds the **layered verification and acceptance system** that decides whether a change is actually good enough. It sits between Component 13 (Change Engine, which produces code changes with immediate validity checks) and Component 17 (Environments/Deployments, which promotes changes to environments).

### What this component WILL build:

1. **Verification Engine** — a new service that coordinates the five verification layers (A–E) defined in the spec:
   - Layer A: Instant validity (parse, syntax, typecheck, lint, config integrity) — **wraps existing [`ValidityPipeline`](apps/desktop/src/lib/change-engine/validity-pipeline.ts)**
   - Layer B: Impacted technical checks (unit tests, integration tests, schema checks) — **new**
   - Layer C: Acceptance flows (browser-driven journeys, API smoke flows, auth flows) — **wraps existing [`BrowserAutomationService`](apps/desktop/src/lib/runtime-execution/browser-automation-service.ts)**
   - Layer D: Policy and safety checks (risk policy, secrets leakage, dependency vulnerability, migration safety, protected path policy) — **new, integrates with Component 19**
   - Layer E: Deploy-specific checks (health checks, rollout readiness, canary comparison, rollback readiness, secret completeness) — **new, integrates with Component 17 types but does NOT implement deploy control plane**

2. **Verification Bundle Selector** — logic that selects which verification layers to run based on risk class (low/medium/high) from Component 19's [`RiskAssessment`](apps/desktop/src/lib/shared-types/entities.ts:881).

3. **Acceptance Criteria Generator** — a service that derives explicit acceptance criteria for each mission: intended behavior, non-goals, paths that must still work, comparison targets, regression thresholds, rollback conditions.

4. **Verification Result Model** — a new entity type [`VerificationRun`](#3-data-model) that records the full verification execution: checks executed, artifacts produced, pass/fail status, flake suspicion, missing required checks, environment, linked candidate, risk impact.

5. **Verification UI Surfaces** — updates to the existing [`VerificationPanel`](apps/desktop/src/renderer/components/panels/) placeholder (currently does not exist; the spec mentions a verification panel but the shell has an Evidence panel and Audit panel). The verification results will be displayed in a new `VerificationPanel.tsx` and also surfaced in the [`EvidenceRail`](apps/desktop/src/renderer/components/EvidenceRail.tsx).

6. **Fail-fast and stop rules** — logic that blocks promotion when required checks fail, evidence is missing, policy violations exist, secrets are incomplete, or rollback path cannot be prepared.

7. **IPC channels** — new IPC channels for verification orchestration, acceptance criteria generation, and verification result retrieval.

8. **Entity types** — new TypeScript interfaces in [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) for `VerificationRun`, `VerificationCheck`, `AcceptanceCriteria`, and `VerificationBundle`.

### What this component will NOT build (deferred to later components):

- **Component 17 (Environments/Deployments):** Actual deploy execution, environment mutation, Coolify/GitHub Actions deploy orchestration, canary rollout mechanics, service topology mutation. Component 16 only reads environment state and produces deploy-readiness verdicts.
- **Component 18 (Secrets/Config/DB):** Actual secrets management, database migration execution, config file mutation. Component 16 only checks config completeness and migration safety records.
- **Component 21 (Observability):** Post-deploy telemetry collection, incident detection, metric aggregation. Component 16 only defines pre-deploy health check requirements.
- **Component 20 (Memory/Skills):** Decision knowledge retrieval for verification heuristics. Component 16 uses static rules initially.

---

## 2. Non-Goals

- This component does **not** replace the existing [`ValidityPipeline`](apps/desktop/src/lib/change-engine/validity-pipeline.ts). It wraps and extends it.
- This component does **not** implement the deploy control plane (Component 17's responsibility).
- This component does **not** implement secrets rotation or database migration execution (Component 18's responsibility).
- This component does **not** implement post-deploy monitoring or incident detection (Component 21's responsibility).
- This component does **not** implement test selection algorithms based on code graph analysis (that is a future optimization; initial implementation uses blast-radius-based file selection from Component 13's [`ImpactAnalysis`](apps/desktop/src/lib/shared-types/entities.ts:745)).
- This component does **not** implement visual diff/screenshot comparison UI beyond the existing before/after comparison in [`EvidencePanel`](apps/desktop/src/renderer/components/panels/EvidencePanel.tsx).

---

## 3. Data Model

### New entity types (added to [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts))

```typescript
/** A single verification check within a verification run. */
export interface VerificationCheck {
  id: string;
  verificationRunId: string;
  layer: 'instant-validity' | 'impacted-tests' | 'acceptance-flow' | 'policy-safety' | 'deploy-specific';
  checkName: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped' | 'running';
  detail: string | null;
  evidenceItemIds: string[]; // links to EvidenceRecord IDs
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

/** A full verification run — the primary output of the verification engine. */
export interface VerificationRun {
  id: string;
  missionId: string;
  workspaceRunId: string | null;
  changesetId: string | null;
  candidateId: string | null;
  bundleId: string; // which verification bundle was used
  overallStatus: 'pass' | 'fail' | 'blocked' | 'running';
  checks: VerificationCheck[];
  missingRequiredChecks: string[];
  flakeSuspicions: string[]; // check IDs that may be flaky
  riskImpact: 'low' | 'medium' | 'high' | 'critical';
  startedAt: string;
  completedAt: string | null;
  verdict: 'promote' | 'block' | 'needs-review' | null;
  verdictReason: string | null;
}

/** A verification bundle — a named set of required checks for a risk class. */
export interface VerificationBundle {
  id: string;
  name: string;
  riskClass: 'low' | 'medium' | 'high' | 'destructive';
  requiredLayers: Array<'instant-validity' | 'impacted-tests' | 'acceptance-flow' | 'policy-safety' | 'deploy-specific'>;
  description: string;
}

/** Acceptance criteria for a mission — derived before work begins. */
export interface AcceptanceCriteria {
  id: string;
  missionId: string;
  intendedBehavior: string[];
  nonGoals: string[];
  pathsThatMustStillWork: string[];
  comparisonTargets: string[]; // screenshot paths, state identifiers
  regressionThresholds: string[];
  rollbackConditions: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Persistence model

All new types are persisted to the existing SQLite database via [`LocalDb`](apps/desktop/src/lib/storage/local-db.ts). New tables:
- `verification_runs`
- `verification_checks`
- `verification_bundles`
- `acceptance_criteria`

No Supabase cloud sync changes are required for this component — the sync engine (Component 22) will handle these tables when it is extended.

---

## 4. Reuse Matrix

| Existing file or module | Current purpose | Keep as-is / Wrap / Refactor / Extract / Replace | Reason | Migration impact |
|---|---|---|---|---|
| [`validity-pipeline.ts`](apps/desktop/src/lib/change-engine/validity-pipeline.ts) | Runs syntax, typecheck, lint, dependency checks | **Wrap** | Already implements Layer A perfectly. The new VerificationEngine will call it as the first layer. | None — pure wrapper, no interface change |
| [`evidence-capture-engine.ts`](apps/desktop/src/lib/runtime-execution/evidence-capture-engine.ts) | Records and correlates evidence items | **Keep as-is** | Verification results produce evidence items. The existing engine already stores them. | None — consumer relationship only |
| [`browser-automation-service.ts`](apps/desktop/src/lib/runtime-execution/browser-automation-service.ts) | Playwright-based browser sessions, screenshots, logs | **Wrap** | Provides Layer C (acceptance flows). The VerificationEngine will orchestrate browser flows as acceptance checks. | None — existing API is sufficient |
| [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) | All TypeScript interfaces | **Refactor in place** | Add new types: VerificationRun, VerificationCheck, VerificationBundle, AcceptanceCriteria. Existing types are preserved. | Additive only — no breaking changes |
| [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) | IPC channel type definitions | **Refactor in place** | Add new IPC channels: `verification`, `acceptance`. Existing channels preserved. | Additive only |
| [`change-engine.ts`](apps/desktop/src/lib/change-engine/change-engine.ts) | Orchestrates workspace runs, patches, validity checks | **Keep with adapter** | Currently calls ValidityPipeline directly. Will be updated to also call the new VerificationEngine for full verification runs. | Minor — add verification engine dependency |
| [`approval-engine.ts`](apps/desktop/src/lib/approval/approval-engine.ts) | Risk classification, second-model review | **Keep as-is** | VerificationEngine reads RiskAssessment from Component 19 to select verification bundles. No changes needed. | None — read-only dependency |
| [`EvidencePanel.tsx`](apps/desktop/src/renderer/components/panels/EvidencePanel.tsx) | Displays evidence records with before/after comparison | **Keep as-is** | Already displays evidence items. Verification results will appear as additional evidence types. | None |
| [`EvidenceRail.tsx`](apps/desktop/src/renderer/components/EvidenceRail.tsx) | Right-side evidence summary rail | **Keep as-is** | Already shows live evidence. Verification status badges will be added. | Minor — add verification status badge |
| [`main/index.ts`](apps/desktop/src/main/index.ts) | Electron main process, all IPC handlers | **Refactor in place** | Add new IPC handlers for verification and acceptance channels. | Additive — new handlers only |
| [`preload/index.ts`](apps/desktop/src/preload/index.ts) | Preload script, exposes safe IPC API | **Refactor in place** | Add new verification and acceptance API surface to `window.vibeflow`. | Additive only |
| [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) | SQLite CRUD operations | **Refactor in place** | Add CRUD methods for new tables: verification_runs, verification_checks, verification_bundles, acceptance_criteria. | Additive — new tables and methods |
| [`health-check.ts`](apps/desktop/src/lib/devops/health-check.ts) | URL-based health monitoring | **Keep with adapter** | Used by Layer E (deploy-specific checks). VerificationEngine calls it for health checks. | None — read-only consumer |
| [`audit-store.ts`](apps/desktop/src/lib/approval/audit-store.ts) | Audit record persistence | **Keep as-is** | Verification runs produce audit events. The audit store already handles this pattern. | None |

---

## 5. Proposed Implementation Plan

### Phase 1: Domain model and types
1. Add new entity types to [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts): `VerificationRun`, `VerificationCheck`, `VerificationBundle`, `AcceptanceCriteria`
2. Add new IPC channel types to [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts): `VerificationChannel`, `AcceptanceChannel`
3. Add new tables to [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts): `verification_runs`, `verification_checks`, `verification_bundles`, `acceptance_criteria`
4. Add CRUD methods to [`LocalDb`](apps/desktop/src/lib/storage/local-db.ts)

### Phase 2: Verification Engine core
1. Create [`apps/desktop/src/lib/verification/verification-engine.ts`](apps/desktop/src/lib/verification/verification-engine.ts)
   - Constructor takes `LocalDb`, `ValidityPipeline`, `EvidenceCaptureEngine`, `BrowserAutomationService`
   - `runVerification(missionId, workspaceRunId?, changesetId?, bundleId)` — orchestrates all layers
   - `selectBundle(riskClass)` — returns the appropriate VerificationBundle
   - `generateVerdict(verificationRun)` — produces promote/block/needs-review
2. Create [`apps/desktop/src/lib/verification/acceptance-criteria-generator.ts`](apps/desktop/src/lib/verification/acceptance-criteria-generator.ts)
   - `generateCriteria(missionId)` — derives acceptance criteria from mission, plan, and impact analysis
   - Uses Component 11's `ImpactAnalysis` and Component 12's `PlanRecord` as inputs
3. Create [`apps/desktop/src/lib/verification/verification-bundles.ts`](apps/desktop/src/lib/verification/verification-bundles.ts)
   - Defines the default bundles: `low-risk`, `medium-risk`, `high-risk`, `destructive-risk`
   - Each bundle specifies required layers and required checks

### Phase 3: Layer implementations
1. **Layer A (Instant Validity):** Wrap existing [`ValidityPipeline`](apps/desktop/src/lib/change-engine/validity-pipeline.ts). No new code — just call existing methods.
2. **Layer B (Impacted Tests):** Create [`apps/desktop/src/lib/verification/impacted-test-runner.ts`](apps/desktop/src/lib/verification/impacted-test-runner.ts)
   - Reads `ImpactAnalysis.affectedFiles` from Component 11
   - Maps affected files to test files (heuristic: same directory, `*.test.*` pattern)
   - Runs `pnpm test <test-file>` via terminal service
   - Returns `VerificationCheck[]` results
3. **Layer C (Acceptance Flows):** Create [`apps/desktop/src/lib/verification/acceptance-flow-runner.ts`](apps/desktop/src/lib/verification/acceptance-flow-runner.ts)
   - Uses existing [`BrowserAutomationService`](apps/desktop/src/lib/runtime-execution/browser-automation-service.ts)
   - Runs predefined flows: navigate to URL, check element exists, screenshot, compare
   - Flows are defined by `AcceptanceCriteria.pathsThatMustStillWork`
4. **Layer D (Policy/Safety):** Create [`apps/desktop/src/lib/verification/policy-check-runner.ts`](apps/desktop/src/lib/verification/policy-check-runner.ts)
   - Checks risk policy against Component 19's `RiskAssessment`
   - Checks secrets completeness (reads `Environment.secretsComplete`)
   - Checks migration safety record (checks for migration records in LocalDb)
   - Checks protected path policy (reads `ProjectIndex.protectedPaths`)
5. **Layer E (Deploy-Specific):** Create [`apps/desktop/src/lib/verification/deploy-check-runner.ts`](apps/desktop/src/lib/verification/deploy-check-runner.ts)
   - Runs health checks via existing [`runHealthCheck()`](apps/desktop/src/lib/devops/health-check.ts)
   - Checks rollback readiness (verifies checkpoint exists via Component 13)
   - Checks environment secret completeness
   - **Does NOT** deploy or mutate environments — that is Component 17's responsibility

### Phase 4: IPC integration
1. Add IPC handlers in [`main/index.ts`](apps/desktop/src/main/index.ts):
   - `verification:run` — start a verification run
   - `verification:getRun` — get a verification run by ID
   - `verification:getRunsForMission` — list verification runs for a mission
   - `verification:getBundles` — list available verification bundles
   - `acceptance:generate` — generate acceptance criteria for a mission
   - `acceptance:get` — get acceptance criteria for a mission
2. Add preload bridge in [`preload/index.ts`](apps/desktop/src/preload/index.ts)
3. Update [`VibeFlowAPI`](apps/desktop/src/lib/shared-types/ipc.ts:628) interface

### Phase 5: UI surfaces
1. Create [`apps/desktop/src/renderer/components/panels/VerificationPanel.tsx`](apps/desktop/src/renderer/components/panels/panels/VerificationPanel.tsx)
   - Shows verification runs for the current mission
   - Displays bundle used, overall status, individual check results
   - Shows verdict (promote/block/needs-review) with reason
   - Shows missing required checks
2. Create [`apps/desktop/src/renderer/components/panels/AcceptancePanel.tsx`](apps/desktop/src/renderer/components/panels/AcceptancePanel.tsx)
   - Shows acceptance criteria for the current mission
   - Allows operator to review and confirm criteria before work begins
3. Update [`EvidenceRail.tsx`](apps/desktop/src/renderer/components/EvidenceRail.tsx) to show verification status badges
4. Update [`PanelWorkspace.tsx`](apps/desktop/src/renderer/components/PanelWorkspace.tsx) to include the new panels in the panel list (if not already present)

### Phase 6: Fail-fast and stop rules
1. Implement `checkPromotionReadiness(verificationRun)` in VerificationEngine
2. Returns `blocked` with reasons when:
   - Required checks fail
   - Required evidence is missing
   - Policy violation exists
   - Environment secrets are incomplete
   - Rollback path cannot be prepared
3. This result is consumed by Component 17 (Environments/Deployments) when promoting a candidate

### Phase 7: Tests
1. Unit tests for `VerificationEngine` (bundle selection, verdict generation)
2. Unit tests for `AcceptanceCriteriaGenerator`
3. Unit tests for each layer runner (mocked dependencies)
4. Integration test: full verification run with mocked services

---

## 6. IPC, API, UI, State, and DevOps Implications

### IPC
- New channels: `verification:*` and `acceptance:*`
- All handlers are invoke-based (request/response), no streaming required
- Verification runs are synchronous from the renderer's perspective but may take time; the engine returns a `VerificationRun` with `overallStatus: 'running'` initially, and the renderer polls for completion

### API
- No external API changes. All verification is local.
- Layer E health checks call external URLs but use the existing [`runHealthCheck()`](apps/desktop/src/lib/devops/health-check.ts) function

### UI
- Two new panels: VerificationPanel and AcceptancePanel
- EvidenceRail gets verification status badges
- PanelWorkspace gets the new panels registered
- All panels follow the existing dark theme and styling patterns

### State
- Verification runs are persisted to SQLite immediately
- No in-memory state beyond the active verification run
- Acceptance criteria are persisted and versioned (updatedAt timestamp)

### DevOps
- Component 16 produces deploy-readiness verdicts but does NOT execute deploys
- The verdict is consumed by Component 17's deploy promotion logic
- Layer E checks verify environment readiness but do not mutate environments
- This boundary is critical: Component 16 answers "is this safe to deploy?" while Component 17 answers "how do we deploy it?"

---

## 7. Test Plan

| Test | Type | What it verifies |
|---|---|---|
| `VerificationEngine.selectBundle()` | Unit | Correct bundle returned for each risk class |
| `VerificationEngine.generateVerdict()` | Unit | Verdict logic: pass→promote, fail→block, partial→needs-review |
| `VerificationEngine.runVerification()` | Integration | All layers execute in order, results aggregated correctly |
| `AcceptanceCriteriaGenerator.generateCriteria()` | Unit | Criteria derived from mission, plan, and impact analysis |
| `ImpactedTestRunner.runTests()` | Unit (mocked) | Test files identified and executed, results parsed |
| `AcceptanceFlowRunner.runFlows()` | Unit (mocked) | Browser flows executed via BrowserAutomationService |
| `PolicyCheckRunner.runChecks()` | Unit (mocked) | Risk policy, secrets, migration safety, protected paths checked |
| `DeployCheckRunner.runChecks()` | Unit (mocked) | Health checks, rollback readiness, secret completeness verified |
| `VerificationPanel` renders | UI smoke | Panel shows verification runs, status, verdict |
| `AcceptancePanel` renders | UI smoke | Panel shows acceptance criteria for mission |
| IPC handlers respond | Integration | All verification and acceptance IPC channels work end-to-end |

---

## 8. Rollback Plan

- **If new entity types break existing code:** The new types are additive only. No existing type is modified. If a problem occurs, the new types can be removed without affecting existing functionality.
- **If new SQLite tables cause issues:** The tables are created with `CREATE TABLE IF NOT EXISTS`. If a migration fails, the tables simply won't exist and the verification engine will gracefully degrade to in-memory mode.
- **If verification engine breaks ChangeEngine integration:** The ChangeEngine currently calls ValidityPipeline directly. The new VerificationEngine is an additional layer, not a replacement. If it fails, the existing validity checks continue to work.
- **If UI panels break the shell layout:** The new panels are added to the existing PanelWorkspace. If they cause layout issues, they can be disabled by removing them from the panel list without affecting other panels.

---

## 9. Risks and Approvals Required

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Verification runs take too long and block the UI | Medium | Medium | Run verification in main process, return initial status immediately, poll for completion |
| Browser automation (Layer C) fails when Playwright is not installed | High | Low | BrowserAutomationService already degrades to stub mode. VerificationEngine will mark Layer C as "skipped" with a warning. |
| Impact analysis (Component 11) is not yet accurate enough for test selection | Medium | Medium | Fall back to running all tests in the workspace if impact analysis is unavailable |
| Verification bundle selection conflicts with Component 19's risk classification | Low | High | Use Component 19's RiskAssessment as the single source of truth. VerificationEngine reads it, does not duplicate it. |
| Deploy-readiness checks (Layer E) drift into Component 17 territory | Medium | High | Strict boundary: Layer E only reads environment state and produces verdicts. It does NOT deploy, mutate, or orchestrate. |
| New SQLite tables conflict with Component 22's sync schema | Low | High | Coordinate table names with Component 22's schema. Use `CREATE TABLE IF NOT EXISTS` to avoid conflicts. |

**Approvals required:**
- Architect approval on the boundary between Component 16 (verification) and Component 17 (deploy execution)
- Orchestrator approval on the implementation plan and scope

---

## 10. Explicit Non-Build List (Deferred to Later Components)

The following are explicitly OUT OF SCOPE for Component 16:

1. **Deploy execution** — Component 17. Component 16 produces a deploy-readiness verdict but does not trigger deploys.
2. **Environment mutation** — Component 17. Component 16 reads environment state but does not create, update, or delete environments.
3. **Secrets management** — Component 18. Component 16 checks whether secrets are complete but does not rotate, store, or inject secrets.
4. **Database migration execution** — Component 18. Component 16 checks whether a migration safety record exists but does not run migrations.
5. **Post-deploy monitoring** — Component 21. Component 16 defines pre-deploy health check requirements but does not collect post-deploy telemetry.
6. **Incident detection** — Component 21. Component 16 does not detect or respond to post-deploy incidents.
7. **Memory-based verification heuristics** — Component 20. Component 16 uses static verification bundle rules, not learned heuristics.
8. **Visual screenshot diff UI** — Future enhancement. The existing before/after comparison in EvidencePanel is sufficient for now.
9. **Test selection optimization** — Future enhancement. Initial implementation uses simple file-to-test mapping, not graph-based impact analysis.
10. **CI integration** — Component 17. Component 16 does not trigger or read CI pipeline status. That is the deploy control plane's responsibility.

---

## 11. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? **Yes** — ValidityPipeline, BrowserAutomationService, EvidenceCaptureEngine, health-check, and LocalDb are all wrapped or extended, not replaced.
- [x] Did I build for missions rather than files? **Yes** — VerificationRun is keyed by missionId, and acceptance criteria are derived from missions.
- [x] Did I preserve transparency without requiring programmer workflows? **Yes** — VerificationPanel shows plain-English verdicts and reasons, not raw test output.
- [x] Did I make MCP/capabilities first-class? **N/A for this component** — Verification does not directly interact with MCP. It uses existing capabilities (browser automation, terminal) through their existing interfaces.
- [x] Did I attach evidence rather than confidence theater? **Yes** — Every verification check links to EvidenceRecord IDs. The verdict is based on actual check results, not a confidence score.
- [x] Did I classify risk and approvals? **Yes** — Verification bundles are selected based on Component 19's RiskAssessment. The verdict feeds into the approval chain.
- [x] Did I keep Git beneath the product surface? **Yes** — Verification does not expose Git operations directly. It uses workspace runs from Component 13.
- [x] Did I avoid turning the shell back into VS Code? **Yes** — New panels follow the mission-centric panel workspace model, not a file-tree-centric model.

---

## 12. DevOps Readiness Analysis

Component 16 carries the following DevOps responsibilities:

- **Verification before deploy:** Every change must pass the appropriate verification bundle before promotion.
- **Evidence linkage:** Every verification check produces or links to evidence records.
- **Rollback readiness:** Layer E verifies that a rollback path exists before declaring a candidate deploy-ready.
- **Environment awareness:** Layer E reads environment state (secrets completeness, health status) without mutating it.

Component 16 does NOT carry these responsibilities (deferred to Component 17):
- Deploy orchestration
- Environment creation or mutation
- CI/CD pipeline triggering
- Service topology updates

---

**Status:** Awaiting Orchestrator approval before implementation begins.
