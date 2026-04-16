# Component 15: Runtime Execution, Debugging, and Evidence Capture — Implementation Analysis

**Version:** 1.0  
**Status:** Awaiting Orchestrator approval  
**Date:** 2026-04-14  
**Author:** Builder  
**Governing spec:** [`15_RUNTIME_EXECUTION_DEBUGGING_AND_EVIDENCE.md`](15_RUNTIME_EXECUTION_DEBUGGING_AND_EVIDENCE.md)  
**Working order position:** 8th (after Component 19, before Component 16)

---

## 1. Scope Summary

Component 15 provides the ability to **run software, observe behavior, capture evidence, and debug with real runtime data** rather than text speculation. It is the bridge between code changes (Component 13) and verification (Component 16).

### What this component WILL build:

1. **Runtime execution service** — start/stop local runtimes, capture stdout/stderr, structured app logs, stack traces
2. **Browser automation service** — Playwright-based browser control for login, navigation, form filling, screenshots, console/network inspection, flow replay
3. **Evidence capture engine** — collect and store all evidence types (logs, screenshots, DOM snapshots, network traces, performance timings, database query summaries)
4. **Before/after comparison** — capture evidence before and after a fix, produce diff summaries
5. **Debug workflow UI** — EvidencePanel populated with real evidence, EvidenceRail wired to live data, debug workflow controls
6. **Correlation layer** — link every evidence item to mission, plan step, workspace run, capability invocation, changeset, environment
7. **Performance analysis surface** — response-time deltas, repeated request patterns, N+1 detection hints

### What this component will NOT build (belongs to later components):

| Excluded Item | Belongs To | Reason |
|---|---|---|
| Test suite execution (unit, integration) | Component 16 | Verification layers, not runtime capture |
| Acceptance test orchestration | Component 16 | Verification and acceptance system |
| Deploy gating based on verification | Component 16 | Deploy gating is verification's job |
| Environment model CRUD | Component 17 | Environments and deployments |
| Service topology map | Component 17 | Service control plane |
| Secrets/config inventory | Component 18 | Secrets and config |
| Post-deploy watch mode | Component 21 | Observability and incidents |
| Incident detection and response | Component 21 | Observability |
| Memory packs / decision knowledge | Component 20 | Memory and skills |
| MCP server management | Component 14 (already done) | Capability fabric |
| Mission decomposition | Component 12 (already done) | Agent orchestration |
| Code change operations | Component 13 (already done) | Change engine |
| Approval/risk classification | Component 19 (already done) | Approval and audit |

---

## 2. Non-Goals

- This component does **not** replace the existing terminal service or file service. It wraps and extends them for evidence capture.
- This component does **not** implement the full verification system (Component 16). It provides the evidence capture primitives that Component 16 will consume.
- This component does **not** implement deploy workflows (Component 17) or post-deploy monitoring (Component 21).
- This component does **not** implement browser automation for production mutation — only observation and synthetic checks.
- This component does **not** implement test running or test result aggregation — that is Component 16's responsibility.
- This component does **not** implement the full debug hypothesis engine — it provides the evidence capture and comparison surfaces.

---

## 3. Salvage Audit

### 3.1 Existing modules relevant to Component 15

| File / Module | Current Purpose | Classification | Reason | Migration Impact |
|---|---|---|---|---|
| [`apps/desktop/src/lib/tooling/terminal-service.ts`](apps/desktop/src/lib/tooling/terminal-service.ts) | Run commands with streaming output, kill processes | **Keep with adapter** | Already captures stdout/stderr with streaming. Needs evidence capture wrapper (store results, link to mission/workspace run). | Low — add evidence recording around existing runCommand |
| [`apps/desktop/src/lib/tooling/file-service.ts`](apps/desktop/src/lib/file-service.ts) | File read/write/list/exists with path traversal protection | **Keep as-is** | Not directly in scope for runtime execution, but used for reading log files and config. | None — no changes needed |
| [`apps/desktop/src/lib/change-engine/validity-pipeline.ts`](apps/desktop/src/lib/change-engine/validity-pipeline.ts) | Syntax check, typecheck, lint, dependency check — produces EvidenceItem objects | **Keep with adapter** | Already produces EvidenceItem objects. Component 15 adds runtime evidence types (log, screenshot, trace, browser) that extend the EvidenceItemType union. | Low — extend type union, reuse EvidenceItem shape |
| [`apps/desktop/src/renderer/screens/ConversationScreen.tsx`](apps/desktop/src/renderer/screens/ConversationScreen.tsx) | Chat UI with streaming, execution stream, file viewer, terminal | **Refactor in place** | Contains terminal output listener and execution stream. Component 15 will add evidence capture hooks here. | Medium — add evidence capture calls without breaking existing streaming |
| [`apps/desktop/src/renderer/components/EvidenceRail.tsx`](apps/desktop/src/renderer/components/EvidenceRail.tsx) | Right-side evidence rail with placeholder data | **Refactor in place** | Already renders EvidenceItem[] with status colors. Needs wiring to real evidence from Component 15 capture engine. | Low — connect to evidence store |
| [`apps/desktop/src/renderer/components/panels/EvidencePanel.tsx`](apps/desktop/src/renderer/components/panels/EvidencePanel.tsx) | Placeholder: "Evidence panel — coming in Component 16" | **Replace** | Currently a static placeholder. Will be replaced with real evidence display, before/after comparison, and debug workflow controls. | Low — replace placeholder content |
| [`apps/desktop/src/lib/shared-types/entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) | TypeScript interfaces including EvidenceItem, EvidenceItemType, WorkspaceRun | **Refactor in place** | EvidenceItemType union needs new types: `log`, `screenshot`, `trace`, `browser`, `network`, `performance`, `dom-snapshot`, `db-query`, `crash-dump`. WorkspaceRun already exists and links to mission/planStep. | Low — additive type changes |
| [`apps/desktop/src/lib/shared-types/ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) | IPC channel type definitions | **Refactor in place** | Needs new RuntimeExecutionChannel and BrowserAutomationChannel interfaces. | Low — additive IPC types |
| [`apps/desktop/src/main/index.ts`](apps/desktop/src/main/index.ts) | Main process with all IPC handlers | **Refactor in place** | Needs new IPC handlers for runtime execution and browser automation. Should follow the planned handler split (Phase 0) but can be added inline for now. | Medium — add handlers without breaking existing ones |
| [`apps/desktop/src/preload/index.ts`](apps/desktop/src/preload/index.ts) | Preload bridge exposing window.vibeflow API | **Refactor in place** | Needs new runtime and browser automation API surface. | Low — additive |
| [`apps/desktop/src/lib/storage/local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) | SQLite CRUD for projects, modes, conversations, etc. | **Refactor in place** | Needs new tables for evidence_records, runtime_executions, browser_sessions. | Medium — schema extension |
| [`apps/desktop/src/lib/capability-fabric/capability-registry.ts`](apps/desktop/src/lib/capability-fabric/capability-registry.ts) | Capability registry with health tracking | **Keep with adapter** | Browser automation will be registered as a new capability (class: 'browser'). | Low — register new capability |
| [`apps/desktop/src/lib/change-engine/change-engine.ts`](apps/desktop/src/lib/change-engine/change-engine.ts) | Workspace runs, patch application, validity checks | **Keep with adapter** | WorkspaceRun already exists and links evidence to missions. Component 15 will add runtime execution as a workspace run activity. | Low — extend existing workspace run model |

---

## 4. Reuse Matrix

| Existing File or Module | Current Purpose | Keep As-Is / Wrap / Refactor / Extract / Replace | Reason | Migration Impact |
|---|---|---|---|---|
| `terminal-service.ts` | Command execution with streaming | **Wrap** | Add evidence capture layer around existing run/kill | Low |
| `file-service.ts` | File operations | **Keep as-is** | Not in scope, used for log file reading | None |
| `validity-pipeline.ts` | Syntax/type/lint checks → EvidenceItem | **Wrap** | Extend with runtime evidence types | Low |
| `EvidenceRail.tsx` | Evidence display rail | **Refactor** | Wire to real evidence store | Low |
| `EvidencePanel.tsx` | Static placeholder | **Replace** | Real evidence display + before/after comparison | Low |
| `entities.ts` (EvidenceItem, EvidenceItemType) | Type definitions | **Refactor** | Add new evidence types to union | Low |
| `ipc.ts` | IPC channel types | **Refactor** | Add runtime/browser IPC channels | Low |
| `main/index.ts` | Main process IPC handlers | **Refactor** | Add runtime/browser handlers | Medium |
| `preload/index.ts` | Preload bridge | **Refactor** | Add runtime/browser API surface | Low |
| `local-db.ts` | SQLite persistence | **Refactor** | Add evidence/execution/session tables | Medium |
| `capability-registry.ts` | Capability management | **Wrap** | Register browser as new capability | Low |
| `change-engine.ts` | Workspace runs | **Keep with adapter** | Link runtime executions to workspace runs | Low |
| `ConversationScreen.tsx` | Chat + terminal UI | **Refactor** | Add evidence capture hooks | Medium |

---

## 5. Proposed Implementation Plan

### Phase 1: Data Model and Types (Foundation)

**Files changed:**
- [`apps/desktop/src/lib/shared-types/entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) — extend EvidenceItemType union, add RuntimeExecution, BrowserSession, EvidenceRecord types
- [`apps/desktop/src/lib/shared-types/ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) — add RuntimeExecutionChannel, BrowserAutomationChannel interfaces

**New types to add:**
```typescript
// Extended EvidenceItemType union
export type EvidenceItemType =
  | 'lint' | 'type-check' | 'build' | 'test' | 'browser'
  | 'screenshot' | 'trace' | 'log' | 'policy' | 'performance'
  | 'schema-safety'
  // Component 15 additions:
  | 'runtime-log' | 'stack-trace' | 'network-trace'
  | 'dom-snapshot' | 'db-query' | 'crash-dump' | 'console-log'
  | 'before-after-comparison';

// Runtime execution record
export interface RuntimeExecution {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string | null;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
}

// Browser session record
export interface BrowserSession {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string | null;
  baseUrl: string;
  status: 'starting' | 'running' | 'closed' | 'failed';
  screenshots: string[]; // paths to stored screenshots
  consoleLogs: string;
  networkTraces: string;
  startedAt: string;
  closedAt: string | null;
}

// Evidence record (persisted)
export interface EvidenceRecord {
  id: string;
  missionId: string;
  workspaceRunId: string;
  planStepId: string | null;
  changesetId: string | null;
  environmentId: string | null;
  capabilityInvocationId: string | null;
  type: EvidenceItemType;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'skipped';
  title: string;
  detail: string | null;
  artifactPath: string | null; // path to stored artifact (screenshot, log file, etc.)
  timestamp: string;
}
```

### Phase 2: Runtime Execution Service

**New file:** `apps/desktop/src/lib/runtime-execution/runtime-execution-service.ts`

**Responsibilities:**
- Start/stop local runtimes (dev servers, build processes)
- Capture stdout/stderr streams
- Store execution results with mission/workspace run linkage
- Emit evidence items for each execution
- Support structured log parsing

**Design:**
- Wraps existing `TerminalService` for command execution
- Adds evidence recording layer (stores results to LocalDb, creates EvidenceRecord entries)
- Emits IPC events for real-time streaming to renderer
- Supports runtime lifecycle management (start, monitor, stop)

**IPC handlers to add:**
- `runtime:start` — start a runtime (dev server, build, etc.)
- `runtime:stop` — stop a running runtime
- `runtime:getStatus` — get current runtime status
- `runtime:getExecutions` — get execution history for a mission
- `runtime:getLogs` — get captured logs for an execution

### Phase 3: Browser Automation Service

**New file:** `apps/desktop/src/lib/runtime-execution/browser-automation-service.ts`

**Responsibilities:**
- Launch/close headless browser (Playwright)
- Navigate to URLs
- Perform actions: login, form filling, button clicks, file upload, modal handling
- Capture screenshots (before/after pairs)
- Capture browser console logs
- Capture network request/response summaries
- Capture DOM snapshots
- Support flow replay

**Design:**
- Uses Playwright as the browser automation engine (industry standard, well-maintained)
- Runs in the Electron main process (has access to Node.js modules)
- Each browser session is linked to a workspace run and mission
- Screenshots stored as files, metadata stored in LocalDb
- Console logs and network traces captured as structured strings
- Safety: production mode is observation-only, no mutation

**IPC handlers to add:**
- `browser:startSession` — launch browser, return session ID
- `browser:navigate` — navigate to URL
- `browser:click` — click element by selector
- `browser:fillForm` — fill form fields
- `browser:uploadFile` — upload file to input
- `browser:screenshot` — capture screenshot, return path
- `browser:getConsoleLogs` — get captured console logs
- `browser:getNetworkTraces` — get captured network traces
- `browser:getDomSnapshot` — get DOM snapshot for selector
- `browser:closeSession` — close browser session

**Dependency:** `playwright` (npm package) — must be added to `apps/desktop/package.json`

### Phase 4: Evidence Capture Engine

**New file:** `apps/desktop/src/lib/runtime-execution/evidence-capture-engine.ts`

**Responsibilities:**
- Central evidence recording service
- Correlate evidence to mission, plan step, workspace run, capability invocation, changeset, environment
- Store evidence records to LocalDb
- Produce EvidenceItem objects for UI consumption
- Support before/after comparison generation

**Design:**
- Singleton service registered in main process
- Methods: `recordEvidence()`, `getEvidenceForMission()`, `getEvidenceForWorkspaceRun()`, `compareBeforeAfter()`
- Uses existing `EvidenceItem` interface from shared-types
- Extends LocalDb with evidence_records table

### Phase 5: Persistence Layer

**Files changed:**
- [`apps/desktop/src/lib/storage/local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) — add tables and CRUD methods
- [`packages/storage/src/schema.sql`](packages/storage/src/schema.sql) — add SQL schema

**New tables:**
```sql
CREATE TABLE IF NOT EXISTS runtime_executions (
  id TEXT PRIMARY KEY,
  workspace_run_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  plan_step_id TEXT,
  command TEXT NOT NULL,
  cwd TEXT NOT NULL,
  status TEXT NOT NULL,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_run_id) REFERENCES workspace_runs(id)
);

CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  workspace_run_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  plan_step_id TEXT,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL,
  screenshots TEXT, -- JSON array of paths
  console_logs TEXT,
  network_traces TEXT,
  started_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (workspace_run_id) REFERENCES workspace_runs(id)
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  workspace_run_id TEXT NOT NULL,
  plan_step_id TEXT,
  changeset_id TEXT,
  environment_id TEXT,
  capability_invocation_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  artifact_path TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (workspace_run_id) REFERENCES workspace_runs(id)
);
```

### Phase 6: IPC Wiring

**Files changed:**
- [`apps/desktop/src/main/index.ts`](apps/desktop/src/main/index.ts) — add IPC handlers
- [`apps/desktop/src/preload/index.ts`](apps/desktop/src/preload/index.ts) — add API surface

**New IPC channels:**
```typescript
// Runtime execution
runtime: {
  start: (args: RuntimeStartArgs) => Promise<RuntimeExecution>;
  stop: (executionId: string) => Promise<void>;
  getStatus: (executionId: string) => Promise<RuntimeExecution>;
  getExecutions: (missionId: string) => Promise<RuntimeExecution[]>;
  getLogs: (executionId: string) => Promise<{ stdout: string; stderr: string }>;
}

// Browser automation
browser: {
  startSession: (args: BrowserSessionArgs) => Promise<BrowserSession>;
  navigate: (sessionId: string, url: string) => Promise<void>;
  click: (sessionId: string, selector: string) => Promise<void>;
  fillForm: (sessionId: string, fields: Record<string, string>) => Promise<void>;
  uploadFile: (sessionId: string, selector: string, filePath: string) => Promise<void>;
  screenshot: (sessionId: string, name: string) => Promise<{ path: string }>;
  getConsoleLogs: (sessionId: string) => Promise<string>;
  getNetworkTraces: (sessionId: string) => Promise<string>;
  getDomSnapshot: (sessionId: string, selector: string) => Promise<string>;
  closeSession: (sessionId: string) => Promise<void>;
}

// Evidence capture
evidence: {
  getForMission: (missionId: string) => Promise<EvidenceRecord[]>;
  getForWorkspaceRun: (workspaceRunId: string) => Promise<EvidenceRecord[]>;
  compareBeforeAfter: (beforeId: string, afterId: string) => Promise<EvidenceItem>;
}
```

### Phase 7: UI Surfaces

**Files changed:**
- [`apps/desktop/src/renderer/components/panels/EvidencePanel.tsx`](apps/desktop/src/renderer/components/panels/EvidencePanel.tsx) — replace placeholder
- [`apps/desktop/src/renderer/components/EvidenceRail.tsx`](apps/desktop/src/renderer/components/EvidenceRail.tsx) — wire to real data

**EvidencePanel replacement:**
- Show evidence items grouped by type (logs, screenshots, traces, browser, performance)
- Before/after comparison view with side-by-side screenshots
- Evidence timeline with timestamps
- Filter by mission, plan step, changeset
- Click to expand detail view
- Link to mission history

**EvidenceRail wiring:**
- Connect to `window.vibeflow.evidence.getForMission()` for live data
- Show evidence count by status (pass/fail/warning)
- Show latest evidence timestamp
- Badge for new evidence

### Phase 8: Capability Registration

**Files changed:**
- [`apps/desktop/src/lib/capability-fabric/capability-adapter.ts`](apps/desktop/src/lib/capability-fabric/capability-adapter.ts) — register browser automation capability

**New capability:**
```typescript
{
  id: 'builtin:browser-automation',
  name: 'Browser Automation',
  class: 'browser',
  owner: 'builtin',
  description: 'Automated browser interaction for verification and debugging',
  scope: 'Login, navigation, form filling, screenshots, console/network inspection',
  health: 'unknown',
  enabled: true,
  actions: [
    { id: 'browser:navigate', name: 'Navigate', permission: 'read-only', ... },
    { id: 'browser:click', name: 'Click', permission: 'read-only', ... },
    { id: 'browser:screenshot', name: 'Screenshot', permission: 'read-only', ... },
    // ... etc
  ]
}
```

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### Data Model
- **3 new tables:** runtime_executions, browser_sessions, evidence_records
- **Extended EvidenceItemType union** with 8 new types
- **EvidenceRecord** links to mission, workspace run, plan step, changeset, environment, capability invocation
- **Artifacts** (screenshots, log files) stored on disk, paths stored in DB

### IPC
- **3 new channel groups:** runtime, browser, evidence
- **~20 new IPC methods** across the three groups
- **Streaming events** for runtime output (reuse terminal:output pattern)
- **Health events** for browser session status

### API
- **No external API changes** — all operations are local
- **Playwright** is the only new dependency
- **Browser automation** runs in main process, communicates via IPC

### UI
- **EvidencePanel** replaced with real evidence display
- **EvidenceRail** wired to live evidence data
- **Before/after comparison** view with side-by-side screenshots
- **Evidence timeline** with filtering

### State
- **Runtime execution state** tracked in main process (running processes map)
- **Browser session state** tracked in main process (active sessions map)
- **Evidence state** persisted to LocalDb, loaded on demand
- **UI state** loaded via IPC on mission selection

### DevOps
- **Playwright browsers** must be installed — `npx playwright install` in postinstall
- **CI must include** Playwright browser installation step
- **Packaged builds** must bundle Playwright Chromium
- **No cloud dependencies** — all local execution

---

## 7. Test Plan

### Unit Tests
1. `runtime-execution-service.test.ts` — test start/stop, output capture, evidence recording
2. `browser-automation-service.test.ts` — test session lifecycle, navigation, screenshot capture (mock Playwright)
3. `evidence-capture-engine.test.ts` — test evidence recording, correlation, before/after comparison
4. `local-db.test.ts` — test new table CRUD operations

### Integration Tests
1. Runtime execution → evidence capture → LocalDb storage → IPC retrieval
2. Browser session → screenshot → evidence record → UI display
3. Before/after comparison generation

### UI Smoke Tests
1. EvidencePanel renders with real evidence data
2. EvidenceRail shows evidence count and latest timestamp
3. Before/after comparison view displays side-by-side screenshots
4. Evidence filtering by mission and type

### Regression Tests
1. Existing terminal service still works unchanged
2. Existing EvidenceRail still renders with empty state
3. Existing validity pipeline still produces EvidenceItem objects

---

## 8. Rollback Plan

### Per-file rollback
- All new files can be deleted independently
- Type additions to `entities.ts` and `ipc.ts` are backward-compatible (additive)
- LocalDb table additions are safe (CREATE TABLE IF NOT EXISTS)
- IPC handler additions are safe (new channels, no existing channel changes)

### Data rollback
- New tables can be dropped without affecting existing tables
- Evidence records are append-only — no migration needed
- Runtime execution and browser session records are ephemeral — safe to delete

### Dependency rollback
- If Playwright causes issues, remove from package.json and delete browser automation files
- Browser automation is isolated — removal does not affect runtime execution or evidence capture

### Catastrophic rollback
- Revert to pre-Component-15 commit
- All changes are additive — no destructive migrations

---

## 9. Risks and Approvals Required

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Playwright Chromium download fails in CI | Medium | Medium | Use `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and install separately |
| Packaged build bundles Playwright incorrectly | Medium | High | Test packaged build before merge; use electron-builder extraResources |
| Browser automation leaks memory (unclosed sessions) | Medium | Medium | Implement session timeout and auto-cleanup |
| Evidence records grow unbounded | Low | Medium | Implement evidence retention policy (future component) |
| Runtime execution conflicts with existing terminal service | Low | Low | Runtime execution wraps terminal service, does not replace |
| New IPC handlers break existing main process | Low | High | Test each handler independently; follow existing handler patterns |

### Approvals Required

1. **Orchestrator approval** — scope confirmation, working order validation
2. **Reviewer-Pusher approval** — code review before any git push
3. **No Architect approval needed** — no architectural decisions required (Playwright is standard, evidence model extends existing types)

---

## 10. Browser Automation: Scope and Boundaries

### What IS in scope for Component 15

| Capability | Purpose |
|---|---|
| Launch/close headless browser | Start and stop browser sessions |
| Navigate to URLs | Load pages for inspection |
| Click elements | Interact with UI for verification |
| Fill form fields | Test form-based flows |
| Upload files | Test file upload flows |
| Handle modals | Test modal-based interactions |
| Capture screenshots | Visual evidence before/after |
| Inspect console logs | Runtime error evidence |
| Inspect network traces | API call evidence |
| Capture DOM snapshots | Structural evidence |
| Flow replay | Reproduce bugs consistently |

### What is NOT in scope (belongs to later components)

| Excluded Capability | Belongs To | Reason |
|---|---|---|
| Running test suites via browser | Component 16 | Verification system |
| Acceptance test orchestration | Component 16 | Verification and acceptance |
| Deploy verification via browser | Component 16/17 | Verification + deploy |
| Production mutation via browser | Component 21 | Observability (synthetic checks) |
| Performance load testing | Component 21 | Observability |
| Cross-browser testing | Future | Not required for initial debug workflow |
| Visual regression testing | Future | Not required for initial debug workflow |

### How browser automation stays bounded

1. **No test runner integration** — browser automation provides primitives only, not test orchestration
2. **No deploy gating** — browser automation captures evidence, does not make deploy decisions
3. **No production mutation** — production mode is observation-only (safety rule from spec §10)
4. **No performance load testing** — only single-session capture, not load generation
5. **No cross-browser matrix** — Chromium only for initial implementation
6. **No visual regression** — screenshots are for evidence, not pixel comparison

### Browser automation as mandatory for modern web apps

The spec (§5) states: "This is mandatory for modern web apps." The rationale is:
- AI systems cannot reliably predict runtime behavior of web applications
- Many bugs are only visible in the browser (CSS, layout, interaction, network)
- Screenshots provide concrete evidence that text descriptions cannot
- Console logs reveal runtime errors that static analysis misses
- Network traces reveal API contract violations
- Flow replay enables consistent bug reproduction

Component 15 provides the **capture primitives** that Component 16 will use for **verification flows**. The boundary is clear: Component 15 captures evidence, Component 16 decides what to do with it.

---

## 11. Explicit List of What Will NOT Be Built Yet

The following items are explicitly excluded from Component 15 because they belong to later components in the fixed implementation order:

| Excluded Item | Component | Reason |
|---|---|---|
| Test suite execution (unit, integration, e2e) | 16 | Verification layers |
| Layered verification system | 16 | Verification architecture |
| Acceptance test orchestration | 16 | Verification and acceptance |
| Deploy gating based on verification results | 16 | Verification system |
| Environment model CRUD and management | 17 | Environments and deployments |
| Service topology map maintenance | 17 | Service control plane |
| Deploy workflow orchestration | 17 | Deploy control plane |
| Secrets/config inventory and completeness checks | 18 | Secrets and config |
| Database migration safety checks | 18 | Migration safety |
| Post-deploy watch mode and telemetry | 21 | Observability |
| Incident detection and response workflows | 21 | Incident handling |
| Self-healing and remediation automation | 21 | Self-healing |
| Memory packs and decision knowledge retrieval | 20 | Memory system |
| Skill-like retrieval system | 20 | Skills system |
| Main process handler split (Phase 0) | Phase 0 | Pre-rebuild stabilization |
| Test infrastructure setup (Vitest) | Phase 0 | Pre-rebuild stabilization |
| Cloud sync re-enablement | Phase 0 / Component 22 | Sync system |

---

## 12. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? **Yes** — terminal service wrapped, EvidenceRail refactored, validity pipeline extended, LocalDb extended
- [x] Did I build for missions rather than files? **Yes** — all evidence linked to mission/workspace run
- [x] Did I preserve transparency without requiring programmer workflows? **Yes** — evidence displayed in plain English with visual comparisons
- [x] Did I make MCP/capabilities first-class? **Yes** — browser automation registered as capability
- [x] Did I attach evidence rather than confidence theater? **Yes** — all evidence is concrete (logs, screenshots, traces)
- [x] Did I classify risk and approvals? **Yes** — production mutation restricted, observation-only mode enforced
- [x] Did I keep Git beneath the product surface? **Yes** — no Git changes in this component
- [x] Did I avoid turning the shell back into VS Code? **Yes** — evidence surfaces are mission-centric panels

---

## 13. Definition of Done

Component 15 is done when:
1. [ ] Runtime execution service can start/stop local runtimes and capture stdout/stderr
2. [ ] Browser automation service can launch browser, navigate, interact, capture screenshots/logs/traces
3. [ ] Evidence capture engine records and correlates evidence to missions/workspace runs
4. [ ] Before/after comparison generates evidence difference summaries
5. [ ] EvidencePanel displays real evidence with filtering and comparison views
6. [ ] EvidenceRail shows live evidence counts and latest timestamps
7. [ ] All evidence types are persisted to LocalDb with proper correlation links
8. [ ] Browser automation is registered as a capability with health tracking
9. [ ] Unit tests pass for all new services
10. [ ] UI smoke tests pass for EvidencePanel and EvidenceRail
11. [ ] Gap analysis against component spec completed
12. [ ] Anti-drift checklist answered (above)

---

## 14. File Change Summary (Estimated)

| Action | File | Purpose |
|---|---|---|
| **Modify** | `apps/desktop/src/lib/shared-types/entities.ts` | Add new evidence types, RuntimeExecution, BrowserSession, EvidenceRecord |
| **Modify** | `apps/desktop/src/lib/shared-types/ipc.ts` | Add runtime, browser, evidence IPC channels |
| **Modify** | `apps/desktop/src/main/index.ts` | Add IPC handlers for runtime, browser, evidence |
| **Modify** | `apps/desktop/src/preload/index.ts` | Add runtime, browser, evidence API surface |
| **Modify** | `apps/desktop/src/lib/storage/local-db.ts` | Add tables and CRUD for runtime_executions, browser_sessions, evidence_records |
| **Modify** | `packages/storage/src/schema.sql` | Add SQL schema for new tables |
| **Modify** | `apps/desktop/src/renderer/components/panels/EvidencePanel.tsx` | Replace placeholder with real evidence display |
| **Modify** | `apps/desktop/src/renderer/components/EvidenceRail.tsx` | Wire to live evidence data |
| **Modify** | `apps/desktop/src/lib/capability-fabric/capability-adapter.ts` | Register browser automation capability |
| **New** | `apps/desktop/src/lib/runtime-execution/runtime-execution-service.ts` | Runtime execution service |
| **New** | `apps/desktop/src/lib/runtime-execution/browser-automation-service.ts` | Browser automation service (Playwright) |
| **New** | `apps/desktop/src/lib/runtime-execution/evidence-capture-engine.ts` | Evidence capture and correlation engine |
| **New** | `apps/desktop/src/lib/runtime-execution/index.ts` | Barrel export |
| **New** | `apps/desktop/src/lib/runtime-execution/runtime-execution-service.test.ts` | Unit tests |
| **New** | `apps/desktop/src/lib/runtime-execution/browser-automation-service.test.ts` | Unit tests |
| **New** | `apps/desktop/src/lib/runtime-execution/evidence-capture-engine.test.ts` | Unit tests |
| **Modify** | `apps/desktop/package.json` | Add playwright dependency |

**Total:** 17 files (10 modified, 7 new)
