# Component 21: Observability, Incident Response, and Self-Healing — Implementation Analysis

**Mode:** Builder (`qwen/qwen3.6-plus`)
**Date:** 2026-04-16
**Status:** Analysis-only — no application code written in this task
**Source spec:** [`rebuild/21_OBSERVABILITY_INCIDENT_RESPONSE_AND_SELF_HEALING.md`](rebuild/21_OBSERVABILITY_INCIDENT_RESPONSE_AND_SELF_HEALING.md)

---

## 1. Scope Summary

Component 21 adds post-deploy observability, incident lifecycle management, watch mode after deploys, and tightly constrained self-healing actions. It is the "Watcher" subsystem that monitors the live system after changes and helps the operator react to problems quickly.

**Core responsibilities:**
- Collect health and telemetry signals from deployed environments
- Detect anomalies against baselines and thresholds
- Correlate anomalies to recent deploys/changes
- Open, track, and resolve incidents as explicit objects
- Recommend rollback or remediation based on evidence
- Support guarded self-healing actions (restart safe preview resources, re-run non-destructive checks, disable failed probes, notify and prepare rollback)
- Enter automatic watch mode after every protected deploy with elevated evidence collection and synthetic checks

**Acceptance criteria (from spec):**
1. System continues watching after deploy
2. Incidents are explicit objects
3. Anomalies are tied back to changes and environments
4. Rollback recommendations are evidence-based
5. Self-healing is constrained and auditable

---

## 2. Explicit Non-Goals (Out of Scope)

The following are **explicitly excluded** from Component 21:

| Out of Scope | Reason / Owning Component |
|---|---|
| **Component 17 deploy execution** — actual deploy triggering, Coolify API calls, environment promotion | Already implemented in Component 17; Component 21 only *consumes* deploy events |
| **Component 18 secret-value handling** — storing, rotating, or verifying secret values | Component 18 owns secrets inventory; Component 21 only reads completeness metadata |
| **Component 19 approval engine redesign** — changing tier logic, risk scoring, audit schema | Component 21 *consumes* the existing approval engine for self-healing actions that require approval |
| **Component 22 cloud-sync reactivation** — Supabase realtime, push triggers, conflict resolution | Component 21 data is local-first; sync is a future concern |
| **Packaging / auto-updater** — electron-builder, electron-updater | Unrelated infrastructure |
| **Real telemetry ingestion pipeline** — ingesting structured logs, metrics from external APM (Datadog, Prometheus, etc.) | Component 21 uses URL-based health checks and synthetic probes only; external APM integration is deferred |
| **Business-critical synthetic check execution** — actual payment/checkout flow testing | The spec lists this as a required telemetry *type*, but actual execution of business flows is deferred; the framework for defining and running synthetic checks will be scaffolded |
| **Queue growth monitoring** — actual message queue depth polling | Deferred; the type system will support it but no implementation |
| **Auth failure monitoring** — actual auth provider log ingestion | Deferred; the type system will support it but no implementation |

---

## 3. Salvage / Brownfield Reuse Map

### 3.1 Types (entities.ts)

| Existing Type | Reuse Status | Notes |
|---|---|---|
| [`Incident`](apps/desktop/src/lib/shared-types/entities.ts:435) | **REUSE — needs extension** | Already has id, projectId, title, severity, description, status, detectedAt, resolvedAt. Missing: `environmentId`, `deployWorkflowId`, `evidenceIds`, `correlatedChangeIds`, `recommendedAction`, `selfHealingAttempted`, `selfHealingResult`, `watchModeActive` |
| [`IncidentSeverity`](apps/desktop/src/lib/shared-types/entities.ts:433) | **REUSE as-is** | `'low' | 'medium' | 'high' | 'critical'` — sufficient |
| [`DeployWorkflow`](apps/desktop/src/lib/shared-types/entities.ts:1132) | **REUSE — linkage target** | Component 21 correlates incidents to deploy workflows via `deployWorkflowId` |
| [`DriftReport`](apps/desktop/src/lib/shared-types/entities.ts:1147) | **REUSE — input signal** | Drift reports are one input to anomaly detection |
| [`HealthCheckResult`](apps/desktop/src/lib/devops/health-check.ts:3) | **REUSE — input signal** | Health check results are primary telemetry input |
| [`EvidenceItem`](apps/desktop/src/lib/shared-types/entities.ts:235) | **REUSE — linkage** | Watch mode evidence items link to incidents |
| [`EvidenceRecord`](apps/desktop/src/lib/shared-types/entities.ts:280) | **REUSE — linkage** | Evidence records from Component 15 link to incidents |
| [`AuditRecord`](apps/desktop/src/lib/shared-types/entities.ts:929) | **REUSE — audit trail** | Self-healing actions produce audit records |
| [`Checkpoint`](apps/desktop/src/lib/shared-types/entities.ts:834) | **REUSE — rollback linkage** | Self-healing rollback references Component 13 checkpoints |
| [`Environment`](apps/desktop/src/lib/shared-types/entities.ts:463) | **REUSE — linkage target** | Incidents are scoped to environments |
| [`CapabilityHealth`](apps/desktop/src/lib/shared-types/entities.ts:320) | **REUSE — status enum** | `'healthy' | 'degraded' | 'unauthorized' | 'misconfigured' | 'offline' | 'unknown'` |
| [`EvidenceItemType`](apps/desktop/src/lib/shared-types/entities.ts:213) | **EXTEND** | Needs new values: `'health-check'`, `'synthetic-check'`, `'anomaly-detection'`, `'watch-summary'` |
| [`ActionType`](apps/desktop/src/lib/shared-types/ipc.ts:306) | **EXTEND** | Already has `'incident:acknowledge'` and `'incident:remediate'`. Needs: `'watch:start'`, `'watch:stop'`, `'self-heal:restart'`, `'self-heal:rerun-check'`, `'self-heal:disable-probe'` |

### 3.2 Storage (local-db.ts)

| Existing Table | Reuse Status | Notes |
|---|---|---|
| `incidents` | **REUSE — needs ALTER TABLE** | Existing columns: id, project_id, title, severity, description, status, detected_at, resolved_at. Needs: environment_id, deploy_workflow_id, evidence_ids_json, correlated_change_ids_json, recommended_action, self_healing_attempted, self_healing_result, watch_mode_active |
| `drift_reports` | **REUSE as-is** | Drift reports are input signals; no schema change needed |
| `deploy_workflows` | **REUSE as-is** | Linkage target; no schema change needed |
| `evidence_records` | **REUSE as-is** | Watch evidence stored here; no schema change needed |
| `audit_records` | **REUSE as-is** | Self-healing audit trail; no schema change needed |
| `checkpoints` | **REUSE as-is** | Rollback reference; no schema change needed |
| `environments` | **REUSE as-is** | Linkage target; no schema change needed |

**New tables needed:**
- `watch_sessions` — tracks post-deploy watch mode sessions
- `watch_probes` — individual probe definitions and results within a watch session
- `anomaly_events` — detected anomalies with correlation data
- `self_healing_actions` — audit log of automatic and manual self-healing attempts

### 3.3 Runtime Modules

| Existing Module | Reuse Status | Notes |
|---|---|---|
| [`DeployEngine`](apps/desktop/src/lib/deploy-engine.ts:11) | **REUSE — event source** | Component 21 subscribes to deploy completion events to start watch mode |
| [`DriftDetector`](apps/desktop/src/lib/drift-detector.ts:7) | **REUSE — input signal** | Drift detection results feed into anomaly correlation |
| [`runHealthCheck()`](apps/desktop/src/lib/devops/health-check.ts:12) | **REUSE — primary probe** | Health check is the primary watch probe |
| [`VerificationEngine`](apps/desktop/src/lib/verification/verification-engine.ts) | **REUSE — re-run checks** | Self-healing "re-run non-destructive checks" uses VerificationEngine |
| [`SecretsStore`](apps/desktop/src/lib/secrets/secrets-store.ts) | **REUSE — metadata read** | Self-healing reads secret completeness for deploy readiness context |
| [`EvidenceCaptureEngine`](apps/desktop/src/lib/runtime-execution/evidence-capture-engine.ts) | **REUSE — evidence recording** | Watch mode evidence captured here |
| [`ApprovalEngine`](apps/desktop/src/lib/approval/approval-engine.ts) | **REUSE — approval gating** | Self-healing actions that are risky go through existing approval tiers |

### 3.4 IPC / Preload

| Existing Pattern | Reuse Status | Notes |
|---|---|---|
| Invoke handlers in [`main/index.ts`](apps/desktop/src/main/index.ts) | **REUSE pattern** | Follow existing `ipcMain.handle('channel:action', ...)` pattern |
| Preload exposure in [`preload/index.ts`](apps/desktop/src/preload/index.ts) | **REUSE pattern** | Follow existing `channel: { method: () => ipcRenderer.invoke(...) }` pattern |
| Event broadcasting (`mainWindow.webContents.send`) | **REUSE pattern** | Watch status changes, incident creation, anomaly detection broadcast to renderer |
| **Note:** main/index.ts has duplicated IPC handler blocks (secrets/migration repeated ~7 times each) | **DO NOT WORSEN** | New handlers must be added cleanly, not duplicated |

### 3.5 UI Surfaces

| Existing Component | Reuse Status | Notes |
|---|---|---|
| [`WatchPanel.tsx`](apps/desktop/src/renderer/components/panels/WatchPanel.tsx) | **REPLACE** | Currently a placeholder with "coming in Component 21" text. Must be replaced with real watch state UI |
| [`AuditPanel.tsx`](apps/desktop/src/renderer/components/panels/AuditPanel.tsx) | **REUSE pattern** | Self-healing audit entries can follow similar history/detail/checkpoints/rollback-preview pattern |
| [`EnvironmentPanel.tsx`](apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx) | **REUSE — add watch tab** | Watch mode status and incident summary can be shown as a tab or section |
| [`PanelWorkspace.tsx`](apps/desktop/src/renderer/components/PanelWorkspace.tsx) | **REUSE — registration** | WatchPanel already registered; just needs real implementation |

---

## 4. Required New Types and Additive Extensions

### 4.1 New Types (entities.ts)

```typescript
// Watch session — created automatically after a protected deploy
export interface WatchSession {
  id: string;
  projectId: string;
  environmentId: string;
  deployWorkflowId: string;
  status: 'active' | 'completed' | 'escalated' | 'dismissed';
  startedAt: string;
  completedAt: string | null;
  elevatedEvidence: boolean; // elevated evidence collection flag
  anomalyThreshold: 'normal' | 'elevated' | 'critical';
  syntheticChecks: WatchProbe[];
  regressionBaseline: string | null; // evidence ID of pre-deploy stable state
}

// Individual probe within a watch session
export interface WatchProbe {
  id: string;
  watchSessionId: string;
  type: 'health-check' | 'synthetic-check' | 'drift-check' | 'evidence-check';
  url: string | null; // for health-check probes
  description: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warning' | 'disabled';
  lastResult: string | null;
  lastCheckedAt: string | null;
  failureCount: number;
  disabled: boolean;
}

// Anomaly event — detected deviation from expected state
export interface AnomalyEvent {
  id: string;
  projectId: string;
  environmentId: string;
  watchSessionId: string | null;
  anomalyType: 'health-degradation' | 'error-rate-spike' | 'latency-spike' | 'drift-detected' | 'synthetic-failure' | 'evidence-gap';
  severity: IncidentSeverity;
  description: string;
  correlatedDeployWorkflowId: string | null;
  correlatedChangeIds: string[];
  evidenceIds: string[];
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

// Self-healing action record
export interface SelfHealingAction {
  id: string;
  projectId: string;
  environmentId: string;
  anomalyEventId: string | null;
  incidentId: string | null;
  actionType: 'restart-preview' | 'rerun-checks' | 'disable-probe' | 'notify-and-prepare-rollback' | 'rollback';
  automatic: boolean; // true = system-initiated, false = human-initiated
  status: 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'blocked';
  approvalRequired: boolean;
  approvalResult: string | null;
  result: string | null;
  executedAt: string | null;
  auditRecordId: string | null;
}

// Watch dashboard summary
export interface WatchDashboard {
  activeSessions: WatchSession[];
  recentAnomalies: AnomalyEvent[];
  openIncidents: Incident[];
  recentSelfHealingActions: SelfHealingAction[];
  environmentHealth: Record<string, CapabilityHealth>; // envId -> health
}
```

### 4.2 Extensions to Existing Types

**Incident** (additive fields):
```typescript
// Add to existing Incident interface:
environmentId: string | null;
deployWorkflowId: string | null;
evidenceIds: string[];
correlatedChangeIds: string[];
recommendedAction: string | null;
selfHealingAttempted: boolean;
selfHealingResult: string | null;
watchModeActive: boolean;
```

**EvidenceItemType** (additive union members):
```typescript
| 'health-check'
| 'synthetic-check'
| 'anomaly-detection'
| 'watch-summary'
```

**ActionType** (additive union members in ipc.ts):
```typescript
| 'watch:start'
| 'watch:stop'
| 'self-heal:restart'
| 'self-heal:rerun-check'
| 'self-heal:disable-probe'
```

---

## 5. Storage Changes Needed (local-db.ts)

### 5.1 ALTER TABLE for incidents

```sql
-- Brownfield-safe: each wrapped in try/catch
ALTER TABLE incidents ADD COLUMN environment_id TEXT;
ALTER TABLE incidents ADD COLUMN deploy_workflow_id TEXT;
ALTER TABLE incidents ADD COLUMN evidence_ids_json TEXT DEFAULT '[]';
ALTER TABLE incidents ADD COLUMN correlated_change_ids_json TEXT DEFAULT '[]';
ALTER TABLE incidents ADD COLUMN recommended_action TEXT;
ALTER TABLE incidents ADD COLUMN self_healing_attempted INTEGER DEFAULT 0;
ALTER TABLE incidents ADD COLUMN self_healing_result TEXT;
ALTER TABLE incidents ADD COLUMN watch_mode_active INTEGER DEFAULT 0;
```

### 5.2 New Tables

```sql
CREATE TABLE IF NOT EXISTS watch_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  deploy_workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  elevated_evidence INTEGER DEFAULT 1,
  anomaly_threshold TEXT NOT NULL DEFAULT 'elevated',
  regression_baseline TEXT,
  probes_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  watch_session_id TEXT,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  correlated_deploy_workflow_id TEXT,
  correlated_change_ids_json TEXT DEFAULT '[]',
  evidence_ids_json TEXT DEFAULT '[]',
  detected_at TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  acknowledged_by TEXT
);

CREATE TABLE IF NOT EXISTS self_healing_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  anomaly_event_id TEXT,
  incident_id TEXT,
  action_type TEXT NOT NULL,
  automatic INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  approval_required INTEGER DEFAULT 0,
  approval_result TEXT,
  result TEXT,
  executed_at TEXT,
  audit_record_id TEXT
);
```

### 5.3 New CRUD Methods

| Method | Table | Purpose |
|---|---|---|
| `upsertWatchSession(session)` | watch_sessions | Create/update watch session |
| `getWatchSession(id)` | watch_sessions | Get single session |
| `listWatchSessions(projectId)` | watch_sessions | List sessions for project |
| `listActiveWatchSessions(projectId)` | watch_sessions | Filter by status='active' |
| `completeWatchSession(id)` | watch_sessions | Set status=completed, completed_at |
| `insertAnomalyEvent(event)` | anomaly_events | Record detected anomaly |
| `listAnomalyEvents(projectId)` | anomaly_events | List anomalies for project |
| `acknowledgeAnomaly(id, by)` | anomaly_events | Mark as acknowledged |
| `upsertSelfHealingAction(action)` | self_healing_actions | Create/update self-healing record |
| `listSelfHealingActions(projectId)` | self_healing_actions | List actions for project |
| `updateSelfHealingStatus(id, status, result)` | self_healing_actions | Update action outcome |
| `getWatchDashboard(projectId)` | multiple | Aggregate dashboard query |
| `updateIncidentWatchFields(id, updates)` | incidents | Update extended incident fields |

---

## 6. Runtime Modules to Add

### 6.1 `apps/desktop/src/lib/observability/watch-engine.ts`

**Primary orchestrator for Component 21.**

Responsibilities:
- Start/stop watch sessions after deploys
- Manage probe lifecycle (health checks, drift checks, synthetic checks)
- Detect anomalies from probe results
- Correlate anomalies to recent deploys/changes
- Open incidents when anomalies exceed thresholds
- Trigger self-healing actions (automatic or approval-gated)
- Broadcast watch state changes to renderer

Dependencies:
- `LocalDb` — persistence
- `DeployEngine` or direct DB read — detect deploy completion
- `runHealthCheck()` — primary probe
- `DriftDetector` — drift check probe
- `VerificationEngine` — re-run checks self-healing
- `EvidenceCaptureEngine` — record watch evidence
- `ApprovalEngine` — gate risky self-healing actions

### 6.2 `apps/desktop/src/lib/observability/anomaly-detector.ts`

Pure function module for anomaly detection logic.

Responsibilities:
- Evaluate probe results against thresholds
- Classify anomaly types
- Calculate severity based on environment type (production vs preview)
- Determine if anomaly warrants incident creation

Dependencies:
- None (pure functions)

### 6.3 `apps/desktop/src/lib/observability/self-healing-engine.ts`

Self-healing action executor.

Responsibilities:
- Execute permitted automatic actions (restart preview, rerun checks, disable probe)
- Request approval for risky actions (rollback, production mutation)
- Record self-healing action outcomes
- Link to audit records

Dependencies:
- `LocalDb` — persistence
- `ApprovalEngine` — approval gating
- `DeployEngine` — rollback execution
- `VerificationEngine` — rerun checks
- `CoolifyClient` — restart preview resources

### 6.4 `apps/desktop/src/lib/observability/index.ts`

Barrel export for all observability modules.

---

## 7. IPC and Preload Surface Additions

### 7.1 New IPC Channels (main/index.ts)

```typescript
// Watch channel
ipcMain.handle('watch:startSession', async (_event, args: { deployWorkflowId: string; environmentId: string; projectId: string }) => ...)
ipcMain.handle('watch:stopSession', async (_event, sessionId: string) => ...)
ipcMain.handle('watch:getSession', async (_event, sessionId: string) => ...)
ipcMain.handle('watch:listSessions', async (_event, projectId: string) => ...)
ipcMain.handle('watch:getDashboard', async (_event, projectId: string) => ...)

// Anomaly channel
ipcMain.handle('anomaly:list', async (_event, projectId: string) => ...)
ipcMain.handle('anomaly:acknowledge', async (_event, id: string) => ...)

// Incident channel (extends existing incident CRUD)
ipcMain.handle('incident:list', async (_event, projectId: string) => ...)
ipcMain.handle('incident:get', async (_event, id: string) => ...)
ipcMain.handle('incident:resolve', async (_event, id: string) => ...)
ipcMain.handle('incident:dismiss', async (_event, id: string) => ...)
ipcMain.handle('incident:getRecommendation', async (_event, id: string) => ...)

// Self-healing channel
ipcMain.handle('selfHealing:list', async (_event, projectId: string) => ...)
ipcMain.handle('selfHealing:execute', async (_event, args: { actionType: string; incidentId?: string; anomalyId?: string }) => ...)
ipcMain.handle('selfHealing:getStatus', async (_event, actionId: string) => ...)
```

### 7.2 Renderer Events (main → renderer)

```typescript
mainWindow.webContents.send('watch:sessionStarted', session)
mainWindow.webContents.send('watch:sessionCompleted', session)
mainWindow.webContents.send('watch:anomalyDetected', anomaly)
mainWindow.webContents.send('incident:opened', incident)
mainWindow.webContents.send('selfHealing:actionStarted', action)
mainWindow.webContents.send('selfHealing:actionCompleted', action)
mainWindow.webContents.send('selfHealing:approvalRequired', action)
```

### 7.3 Preload Additions (preload/index.ts)

```typescript
watch: {
  startSession: (args) => ipcRenderer.invoke('watch:startSession', args),
  stopSession: (id) => ipcRenderer.invoke('watch:stopSession', id),
  getSession: (id) => ipcRenderer.invoke('watch:getSession', id),
  listSessions: (projectId) => ipcRenderer.invoke('watch:listSessions', projectId),
  getDashboard: (projectId) => ipcRenderer.invoke('watch:getDashboard', projectId),
  onSessionStarted: (cb) => { ipcRenderer.removeAllListeners('watch:sessionStarted'); ipcRenderer.on('watch:sessionStarted', (_e, d) => cb(d)); },
  onSessionCompleted: (cb) => { ... },
  onAnomalyDetected: (cb) => { ... },
  removeListeners: () => { ... },
},
anomaly: {
  list: (projectId) => ipcRenderer.invoke('anomaly:list', projectId),
  acknowledge: (id) => ipcRenderer.invoke('anomaly:acknowledge', id),
},
incident: {
  list: (projectId) => ipcRenderer.invoke('incident:list', projectId),
  get: (id) => ipcRenderer.invoke('incident:get', id),
  resolve: (id) => ipcRenderer.invoke('incident:resolve', id),
  dismiss: (id) => ipcRenderer.invoke('incident:dismiss', id),
  getRecommendation: (id) => ipcRenderer.invoke('incident:getRecommendation', id),
  onOpened: (cb) => { ... },
  removeListeners: () => { ... },
},
selfHealing: {
  list: (projectId) => ipcRenderer.invoke('selfHealing:list', projectId),
  execute: (args) => ipcRenderer.invoke('selfHealing:execute', args),
  getStatus: (id) => ipcRenderer.invoke('selfHealing:getStatus', id),
  onActionStarted: (cb) => { ... },
  onActionCompleted: (cb) => { ... },
  onApprovalRequired: (cb) => { ... },
  removeListeners: () => { ... },
},
```

### 7.4 IPC Type Additions (ipc.ts)

New interfaces: `WatchChannel`, `AnomalyChannel`, `IncidentChannel`, `SelfHealingChannel`.
Extend `VibeFlowAPI` with `watch`, `anomaly`, `incident`, `selfHealing` properties.

---

## 8. UI Surfaces to Add or Upgrade

### 8.1 WatchPanel.tsx — Full Replacement

**Current state:** Placeholder with "coming in Component 21" text.

**Target state:** Multi-tab panel with:

| Tab | Content |
|---|---|
| **Active Watches** | List of active watch sessions with environment, deploy link, status badge, elapsed time, probe summary (pass/fail counts), and stop button |
| **Anomalies** | Timeline of detected anomalies with severity color, type icon, description, correlation to deploy/change, acknowledge button |
| **Incidents** | List of open/recent incidents with severity, status, recommended action, resolve/dismiss buttons, self-healing status |
| **Self-Healing** | Log of self-healing actions with type, automatic/manual, status, result, approval status |

**Design principles:**
- Non-programmer readable: plain English descriptions, color-coded severity, clear status badges
- Action-oriented: acknowledge, resolve, dismiss, execute self-healing buttons visible
- Evidence-linked: click-through to evidence records for each anomaly/incident

### 8.2 EnvironmentPanel.tsx — Add Watch Status Indicator

Add a watch mode badge/indicator to the environment list showing:
- Whether watch mode is active for this environment
- Number of open incidents
- Current health status

### 8.3 MissionPanel.tsx — Add Watch Mode Context

When a mission involves a deploy, show watch mode status and any open incidents in the mission context.

### 8.4 Bottom Bar — Watch Status Indicator

Add a small watch indicator (👁️) to the bottom status bar showing:
- Active watch session count
- Open incident count (red badge if > 0)

---

## 9. Self-Healing Trigger Boundary

### 9.1 Automatic (No Approval Required)

| Action | Conditions | Audit |
|---|---|---|
| **Restart safe preview resources** | Environment type is `preview`; health check returns `unreachable` for 3 consecutive checks | Audit record created with `automatic: true` |
| **Re-run non-destructive checks** | Any anomaly detected; verification bundle is `low` or `medium` risk | Audit record created |
| **Disable a failed watch probe** | Probe fails 5+ consecutive times; probe is not a health-check on production | Audit record created; probe marked `disabled: true` |
| **Notify and prepare rollback** | Anomaly severity is `high` or `critical` in production; rollback checkpoint exists | Audit record created; incident opened with recommended action |

### 9.2 Requires Approval

| Action | Approval Tier | Notes |
|---|---|---|
| **Rollback a production deploy** | Tier 3 (human) | Uses existing Component 19 approval flow; links to Component 13 checkpoint |
| **Restart production service** | Tier 2 (second-model) or Tier 3 depending on environment | Uses existing approval engine |
| **Disable production health probe** | Tier 2 (second-model) | Requires second-model review |

### 9.3 Notification Only

| Event | Action |
|---|---|
| **Anomaly detected (low/medium severity)** | Incident opened with `investigating` status; operator notified via UI event |
| **Drift detected** | Drift report created; shown in WatchPanel anomalies tab |
| **Watch session completed** | Session marked `completed`; summary evidence recorded |
| **Synthetic check failure** | Anomaly event created; correlated to recent deploy if applicable |

---

## 10. Test Plan

### 10.1 Unit Tests

| Module | Test Focus | Count Estimate |
|---|---|---|
| `anomaly-detector.ts` | Threshold evaluation, severity classification, anomaly type detection | 15-20 |
| `self-healing-engine.ts` | Automatic action execution, approval gating, action recording | 10-15 |
| `watch-engine.ts` | Session lifecycle, probe scheduling, anomaly correlation | 10-15 |

### 10.2 Integration Tests

| Test Scenario | Verification |
|---|---|
| Deploy completes → watch session auto-starts | Watch session created with correct deploy_workflow_id |
| Health check fails → anomaly detected | Anomaly event created with correct type and severity |
| Anomaly exceeds threshold → incident opened | Incident created with correlated deploy/change IDs |
| Self-healing automatic action → audit record created | Audit record exists with automatic=true |
| Self-healing risky action → approval required | Approval request sent through existing approval flow |
| Watch session timeout → session completed | Session status changed to completed |

### 10.3 UI Tests

| Test Scenario | Verification |
|---|---|
| WatchPanel renders with 4 tabs | All tabs visible and switchable |
| Active watch session displayed | Session details, probe summary, stop button visible |
| Anomaly acknowledged | Anomaly marked acknowledged, UI updates |
| Incident resolved | Incident status changes, UI reflects resolution |
| Self-healing action executed | Action log updated with result |

---

## 11. Rollback Plan

### 11.1 Reversing Component 21 Changes

If Component 21 needs to be rolled back:

1. **UI:** Revert [`WatchPanel.tsx`](apps/desktop/src/renderer/components/panels/WatchPanel.tsx) to its placeholder state (the current "coming in Component 21" version is preserved in git history)
2. **IPC/Preload:** Remove `watch`, `anomaly`, `incident`, `selfHealing` from preload and VibeFlowAPI — these are additive and safe to remove
3. **Runtime:** Delete `apps/desktop/src/lib/observability/` directory — no other modules depend on it
4. **Storage:** New tables (`watch_sessions`, `anomaly_events`, `self_healing_actions`) are isolated; removing them does not affect existing data. ALTER TABLE additions to `incidents` are backward-compatible — old code ignores new columns
5. **Types:** New types in entities.ts are additive; removing them requires updating any code that references them (only the observability module itself)

**Rollback safety:** HIGH. All changes are additive. No existing tables are modified destructively. No existing behavior is changed — Component 21 adds new capabilities without modifying existing flows.

---

## 12. Risks and Dependencies

### 12.1 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **main/index.ts handler duplication** — file already has ~7 duplicated blocks of secrets/migration handlers | Medium | New handlers added in a single clean block; deduplication deferred to a separate cleanup task |
| **Watch mode timing** — detecting deploy completion reliably | Medium | Watch session started by explicit IPC call from deploy completion handler, not by polling |
| **Self-healing false positives** — automatic actions triggered by transient issues | High | Conservative thresholds; consecutive failure requirements (3+ for health, 5+ for probe disable); all automatic actions audited |
| **SQLite performance** — frequent probe writes during active watch | Low | Probe results batched; only state changes written immediately |
| **Non-programmer comprehension** — incident descriptions must be plain English | Medium | All descriptions generated from templates with plain-English explanations; no raw error messages shown directly |

### 12.2 Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Component 17 (deploy workflows) | ✅ Complete | Watch sessions triggered by deploy completion |
| Component 19 (audit/approval) | ✅ Complete | Self-healing actions audited; risky actions gated |
| Component 13 (checkpoints) | ✅ Complete | Rollback references checkpoints |
| Component 15 (evidence capture) | ✅ Complete | Watch evidence recorded |
| Component 16 (verification) | ✅ Complete | Re-run checks self-healing uses VerificationEngine |
| Component 18 (secrets) | ✅ Complete | Secret completeness read for context |
| DriftDetector | ✅ Complete | Drift checks as watch probes |
| HealthCheck | ✅ Complete | Health checks as watch probes |

---

## 13. Deferred Items

| Item | Reason for Deferral | Future Component |
|---|---|---|
| External APM integration (Datadog, Prometheus) | Requires new dependency and provider abstraction | Future observability extension |
| Queue depth monitoring | No queue infrastructure in current stack | Future |
| Auth failure log ingestion | Requires auth provider integration | Future |
| Business-critical synthetic check execution (payment, checkout) | Requires browser automation orchestration per flow | Could use Component 15 BrowserAutomationService |
| Real-time streaming metrics dashboard | Requires WebSocket/Supabase realtime | Component 22 sync reactivation |
| Machine learning anomaly detection | Overkill for v1; threshold-based detection sufficient | Future |
| Multi-environment watch correlation | Single-environment watch is sufficient for v1 | Future |
| Watch session persistence across app restarts | Watch sessions are ephemeral; app restart resets | Future |

---

## 14. Boundary Analysis with Adjacent Components

### 14.1 Component 17 (Environments, Deployments, Service Control Plane)

**Boundary:** Component 17 executes deploys; Component 21 watches after deploys complete.
**Interaction:** Component 17's `DeployEngine.executeWorkflow()` completion triggers Component 21's `WatchEngine.startSession()`.
**Shared data:** `DeployWorkflow` records, `Environment` records, `DriftReport` records.
**No overlap:** Component 21 does NOT execute deploys, promote environments, or manage environment CRUD.

### 14.2 Component 19 (Approval, Risk, Audit, Rollback)

**Boundary:** Component 19 provides approval gating and audit persistence; Component 21 consumes both.
**Interaction:** Self-healing actions that require approval call `ApprovalEngine.requestAction()`. All self-healing actions create `AuditRecord` entries.
**Shared data:** `AuditRecord`, `Checkpoint`, `RollbackPlan`.
**No overlap:** Component 21 does NOT redesign approval tiers, risk scoring, or audit schema.

### 14.3 Component 13 (Change Engine, Code Operations)

**Boundary:** Component 13 provides rollback checkpoints; Component 21 references them for rollback recommendations.
**Interaction:** When self-healing recommends rollback, it links to the most recent `Checkpoint` for the deploy workflow.
**Shared data:** `Checkpoint`, `WorkspaceRun`.
**No overlap:** Component 21 does NOT create workspaces, apply patches, or run validity checks.

### 14.4 Component 15 (Runtime Execution, Evidence Capture)

**Boundary:** Component 15 provides evidence recording; Component 21 records watch evidence through the same system.
**Interaction:** Watch probes that produce evidence (health check results, synthetic check outputs) create `EvidenceRecord` entries with new `EvidenceItemType` values.
**Shared data:** `EvidenceRecord`, `EvidenceCaptureEngine`.
**No overlap:** Component 21 does NOT run terminal commands, browser sessions, or capture stack traces.

### 14.5 Component 16 (Verification and Acceptance)

**Boundary:** Component 16 provides verification checks; Component 21 re-runs them as a self-healing action.
**Interaction:** `self-heal:rerun-checks` calls `VerificationEngine.run()` with the appropriate bundle.
**Shared data:** `VerificationRun`, `VerificationBundle`.
**No overlap:** Component 21 does NOT generate acceptance criteria or define verification bundles.

---

## 15. Recommended Phased Implementation Plan

### Phase 1: Type and Storage Foundation
**Goal:** All types, IPC contracts, and database schema in place.
- Extend `Incident` type in entities.ts
- Add new types: `WatchSession`, `WatchProbe`, `AnomalyEvent`, `SelfHealingAction`, `WatchDashboard`
- Extend `EvidenceItemType` and `ActionType` unions
- Add `WatchChannel`, `AnomalyChannel`, `IncidentChannel`, `SelfHealingChannel` to ipc.ts
- Extend `VibeFlowAPI` with new channels
- ALTER TABLE incidents in local-db.ts
- Create new tables: `watch_sessions`, `anomaly_events`, `self_healing_actions`
- Add CRUD methods for all new tables
- **Deliverable:** Types compile, schema migrates, CRUD methods testable

### Phase 2: Core Watch Engine
**Goal:** Watch sessions can be started, probes run, and results recorded.
- Create `watch-engine.ts` with session lifecycle
- Create `anomaly-detector.ts` with threshold evaluation
- Integrate `runHealthCheck()` as primary probe
- Integrate `DriftDetector` as drift-check probe
- Wire IPC handlers for watch:startSession, watch:stopSession, watch:listSessions
- Wire preload exposure
- **Deliverable:** Watch sessions start/stop, health checks run, results persisted

### Phase 3: Anomaly Detection and Incident Lifecycle
**Goal:** Anomalies detected, incidents opened and managed.
- Implement anomaly detection logic in `anomaly-detector.ts`
- Auto-create incidents when thresholds exceeded
- Correlate anomalies to deploy workflows and changes
- Wire IPC handlers for anomaly:list, anomaly:acknowledge, incident:list, incident:resolve
- Wire renderer events for anomaly detection and incident creation
- **Deliverable:** Anomalies detected, incidents opened with correlation data

### Phase 4: Self-Healing Engine
**Goal:** Automatic and approval-gated self-healing actions.
- Create `self-healing-engine.ts`
- Implement automatic actions: restart preview, rerun checks, disable probe
- Implement approval-gated actions: rollback, production restart
- Wire IPC handlers for selfHealing:list, selfHealing:execute, selfHealing:getStatus
- Link self-healing actions to audit records
- **Deliverable:** Self-healing actions execute, audit trail created

### Phase 5: WatchPanel UI
**Goal:** Real WatchPanel replaces placeholder.
- Replace WatchPanel.tsx with 4-tab implementation
- Active Watches tab: session list, probe summary, stop button
- Anomalies tab: timeline, severity, acknowledge button
- Incidents tab: list, resolve/dismiss, recommended action
- Self-Healing tab: action log, status, results
- Wire to IPC/preload API
- Add watch status indicator to bottom bar
- **Deliverable:** Full watch UI functional

### Phase 6: Integration and Polish
**Goal:** End-to-end flow from deploy → watch → anomaly → incident → self-healing.
- Wire deploy completion → auto-start watch session
- Test full incident lifecycle
- Test self-healing approval flow
- Add plain-English descriptions for all anomaly types
- Smoke test: `tsc --noEmit` passes
- **Deliverable:** End-to-end flow verified, ready for review

---

## 16. File Change Summary (Estimated)

| Category | Files | Action |
|---|---|---|
| Types | `entities.ts` | Extend Incident, add 5 new types, extend 2 unions |
| Types | `ipc.ts` | Add 4 new channel interfaces, extend VibeFlowAPI |
| Storage | `local-db.ts` | ALTER TABLE + 4 new tables + ~12 CRUD methods |
| Runtime | `observability/watch-engine.ts` | NEW — primary orchestrator |
| Runtime | `observability/anomaly-detector.ts` | NEW — pure detection functions |
| Runtime | `observability/self-healing-engine.ts` | NEW — action executor |
| Runtime | `observability/index.ts` | NEW — barrel export |
| Main | `main/index.ts` | ADDITIVE — ~15 new IPC handlers + event broadcasts |
| Preload | `preload/index.ts` | ADDITIVE — 4 new channel exposures |
| UI | `WatchPanel.tsx` | REPLACE — full 4-tab implementation |
| UI | `PanelWorkspace.tsx` | MINOR — confirm WatchPanel registration |
| Tests | `watch-engine.test.cjs` | NEW — unit tests |
| Tests | `anomaly-detector.test.cjs` | NEW — unit tests |
| Tests | `self-healing-engine.test.cjs` | NEW — unit tests |

**Total:** ~14 files touched (3 extended, 7 new, 1 replaced, 3 tests)

---

## 17. Conclusion

Component 21 is well-bounded and builds cleanly on top of Components 13, 15, 16, 17, 18, and 19. The existing `Incident` type, `incidents` table, `runHealthCheck()`, `DriftDetector`, `VerificationEngine`, and approval/audit infrastructure provide a strong foundation. The primary new work is the watch session lifecycle, anomaly detection logic, self-healing action execution, and the WatchPanel UI replacement.

All changes are additive and brownfield-safe. The rollback plan is straightforward. The phased plan allows incremental delivery with verification at each step.

**Recommended next step:** Orchestrator review of this analysis, followed by a phased Builder implementation pass starting with Phase 1 (types and storage).
