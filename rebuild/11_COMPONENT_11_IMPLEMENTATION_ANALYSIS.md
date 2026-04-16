# Component 11: Project Intelligence and Context System — Implementation Analysis

**Version:** 1.0  
**Status:** Awaiting Orchestrator approval  
**Date:** 2026-04-14  
**Author:** Builder  
**Governing spec:** [`11_PROJECT_INTELLIGENCE_AND_CONTEXT_SYSTEM.md`](11_PROJECT_INTELLIGENCE_AND_CONTEXT_SYSTEM.md)  
**Working order position:** Phase 5 (after 10, 22, 12, 14)

---

## 1. Scope Summary

Component 11 gives VibeFlow a machine-usable understanding of the project beyond the file tree. It is the basis for safe planning, targeted changes, correct verification, and meaningful explanations.

**In scope for this component:**

1. **Repository model** — scan and classify project files, identify package manager, build/test commands, lockfiles, monorepo shape, generated directories, protected paths.
2. **Framework and stack detection** — identify React/Next.js/Vue/Svelte, Node/Bun/Python/Go, TypeScript vs JavaScript, ORM, test frameworks, deployment descriptors, containerization.
3. **Symbol graph** — parse files to extract exports, imports, classes, functions, types, routes, handlers, jobs, key constants. Build import/export dependency graph.
4. **Impact graph** — answer "if this file/symbol/API/schema/env var changes, what else is affected?"
5. **Service topology map** — connect frontend, backend, database, storage, auth, CDN, email, queues, external APIs, deployment platform.
6. **Configuration map** — track environment variables, config files, secret references, defaults, required-per-environment, missing-per-environment.
7. **Context pack assembly** — create per-mission context packs with inclusion/exclusion rationale, freshness guarantees, stale assumption warnings.
8. **Context dashboard** — show total context size, composition, missing context, stale items, token budget, retrieval source. Support pin/unpin, request more, swap stale, save preset.
9. **Indexing pipeline** — scan, classify, parse, build graph, infer routes/APIs, link schemas, extract config, persist index, emit invalidation events.
10. **Incremental refresh** — file-level invalidation, symbol-level refresh, command-triggered reindex, post-dependency-install refresh, post-branch-switch refresh.
11. **ContextPanel UI evolution** — replace the placeholder [`ContextPanel.tsx`](apps/desktop/src/renderer/components/panels/ContextPanel.tsx) with a real context dashboard.
12. **New IPC channels** — project intelligence queries, context pack CRUD, index management, context dashboard data.
13. **New persistence tables** — ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge, RouteRecord, ApiEndpointRecord, JobRecord, ServiceNode, ServiceEdge, ConfigVariableRecord, ContextPack, ContextItem, ContextWarning.

**Out of scope (explicitly deferred to later components):**

- **Change engine / code operations** (Component 13) — actual code modification, isolated workspaces, semantic diffs.
- **Verification and acceptance** (Component 16) — layered verification, acceptance flows, deploy gating.
- **Runtime execution and evidence capture** (Component 15) — runtime capture, browser automation, evidence bundling.
- **Memory packs and decision knowledge** (Component 20) — retrievable knowledge packs, prior fixes, design decisions.
- **Agent orchestration** (Component 12) — mission decomposition, role routing, multi-model orchestration (already partially implemented).
- **Capability fabric** (Component 14) — tool registry, MCP health, capability invocation (already partially implemented).
- **Approval and rollback** (Component 19) — risk classification, approval gates, audit chain.
- **Environments and deployments** (Component 17) — environment model, deploy workflow, service topology (Component 11 provides topology *data* but not deploy logic).

---

## 2. Non-Goals

- This component does **not** implement code modification or patch generation.
- This component does **not** run verification checks or tests.
- This component does **not** manage memory packs or decision knowledge retrieval.
- This component does **not** deploy or manage environments.
- This component does **not** replace the existing capability registry or MCP manager.
- This component does **not** implement the change engine or isolated workspace operations.
- This component does **not** implement the approval/risk/audit system.

---

## 3. Salvage Audit of Existing VibeFlow Code

### 3.1 File Inventory

| File | Lines | Current Responsibility | Quality Assessment |
|---|---|---|---|
| [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) | 500 | All TypeScript interfaces including Mission, Plan, ContextPack, EvidenceItem, Capability, Incident, DeployCandidate, Environment | Sound type system. ContextPack type exists but is flat (arrays of strings). Needs enrichment for Component 11. |
| [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) | 461 | IPC channel type definitions | Sound. No project intelligence channels exist yet. Will be extended. |
| [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) | 1007 | SQLite CRUD for all domain objects via sql.js | Solid. Uses sql.js with array-based results. Has tables for missions, plans, evidence, capabilities, MCP servers, incidents, deploy candidates, environments. Missing tables for project intelligence (symbols, references, routes, etc.). |
| [`sync-engine.ts`](apps/desktop/src/lib/sync/sync-engine.ts) | 775 | Supabase sync, device registration, lease/heartbeat, Realtime subscriptions | Implemented but disabled. Has sync methods for missions, evidence, capabilities, incidents, environments. Will need extension for new intelligence tables. |
| [`ContextPanel.tsx`](apps/desktop/src/renderer/components/panels/ContextPanel.tsx) | 15 | Placeholder component | Pure placeholder. Will be replaced with real context dashboard. |
| [`MissionPanel.tsx`](apps/desktop/src/renderer/components/panels/MissionPanel.tsx) | 210 | Displays mission state, plan steps, orchestration state | Working. Reads from IPC. Will be a consumer of context packs (receives context pack ID from mission). |
| [`PlanPanel.tsx`](apps/desktop/src/renderer/components/panels/PlanPanel.tsx) | 232 | Displays plan data with step status and role assignments | Working. Reads from IPC. Will be a consumer of context packs. |
| [`EvidenceRail.tsx`](apps/desktop/src/renderer/components/EvidenceRail.tsx) | 163 | Right-side evidence rail with placeholder | Working scaffold. Will receive evidence items from Component 15/16. |
| [`index.ts`](apps/desktop/src/main/index.ts) | 1209 | All IPC handlers, app lifecycle, window creation | Monolithic but working. Will need new IPC handlers for project intelligence. |
| [`index.ts`](apps/desktop/src/preload/index.ts) | 196 | Typed `window.vibeflow` API bridge | Sound security boundary. Will grow with new IPC channels. |
| [`file-service.ts`](apps/desktop/src/lib/tooling/file-service.ts) | 111 | File read/write/list/exists with path traversal protection | Clean, focused. Will be used by indexing pipeline to scan project files. |
| [`capability-registry.ts`](apps/desktop/src/lib/capability-fabric/capability-registry.ts) | 185 | Central capability registry with health tracking | Working. Will be a data source for service topology (what capabilities are available). |
| [`mcp-connection-manager.ts`](apps/desktop/src/lib/mcp-manager/mcp-connection-manager.ts) | 157 | MCP server lifecycle management | Working. Will be a data source for service topology (what external services are connected). |

### 3.2 Reuse Matrix

| Existing File or Module | Current Purpose | Decision | Reason | Migration Impact |
|---|---|---|---|---|
| `entities.ts` — ContextPack type | Flat context pack with string arrays | **Refactor in place** | Type exists but needs enrichment: add ContextItem, ContextWarning, ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge, RouteRecord, ApiEndpointRecord, JobRecord, ServiceNode, ServiceEdge, ConfigVariableRecord | Low — additive type definitions, no breaking changes to existing fields |
| `entities.ts` — Mission type | Mission with projectId, title, status | **Keep as-is** | Mission already has the structure needed. Context pack will be linked by missionId. | None |
| `ipc.ts` — VibeFlowAPI | Full IPC channel definitions | **Refactor in place** | Add `projectIntelligence` and `contextPacks` channels to the API interface | Low — additive, no breaking changes |
| `local-db.ts` | SQLite CRUD via sql.js | **Refactor in place** | Add new tables and CRUD methods for project intelligence domain objects. Existing tables and methods preserved. | Medium — new schema, new methods. No changes to existing CRUD. |
| `sync-engine.ts` | Supabase sync for domain objects | **Keep with adapter** | Existing sync methods cover missions, evidence, capabilities, etc. New intelligence tables will need sync methods added later (Component 22 evolution). For Component 11, intelligence data is local-only. | Low — no sync changes needed for C11. |
| `ContextPanel.tsx` | Placeholder | **Replace** | Pure placeholder with no logic. Will be replaced with real context dashboard component. | Low — no existing behavior to preserve. |
| `MissionPanel.tsx` | Mission display with plan steps | **Keep as-is** | Already reads plan data via IPC. Will be a consumer of context packs (context pack is assembled when mission starts). | None — no changes needed. |
| `PlanPanel.tsx` | Plan display with step status | **Keep as-is** | Already reads plan data via IPC. No changes needed. | None |
| `EvidenceRail.tsx` | Evidence rail scaffold | **Keep as-is** | Already displays evidence items. No changes needed for C11. | None |
| `index.ts` (main) | All IPC handlers | **Refactor in place** | Add new IPC handlers for project intelligence: index management, context pack CRUD, symbol queries, impact analysis queries. | Medium — new handlers added. No changes to existing handlers. |
| `index.ts` (preload) | Typed API bridge | **Refactor in place** | Add new IPC channel bindings for project intelligence and context packs. | Low — additive. |
| `file-service.ts` | File operations | **Keep with adapter** | Will be used by indexing pipeline to read project files. No changes to the service itself. | None — consumer, not modified. |
| `capability-registry.ts` | Capability registry | **Keep as-is** | Data source for service topology. No changes needed. | None |
| `mcp-connection-manager.ts` | MCP server management | **Keep as-is** | Data source for service topology. No changes needed. | None |

---

## 4. Proposed Implementation Plan

### 4.1 Implementation Order

1. **Domain types** — Add new TypeScript interfaces to `entities.ts` for all project intelligence domain objects.
2. **IPC types** — Add new IPC channel definitions to `ipc.ts` for project intelligence and context packs.
3. **Persistence** — Add new SQLite tables and CRUD methods to `local-db.ts`.
4. **Indexing pipeline** — Create `apps/desktop/src/lib/project-intelligence/indexing-pipeline.ts` with file scanning, classification, symbol extraction, dependency graph building.
5. **Framework detection** — Create `apps/desktop/src/lib/project-intelligence/framework-detector.ts` with stack identification logic.
6. **Impact analysis** — Create `apps/desktop/src/lib/project-intelligence/impact-analyzer.ts` with dependency traversal and blast radius calculation.
7. **Service topology** — Create `apps/desktop/src/lib/project-intelligence/topology-builder.ts` that aggregates capability registry, MCP servers, and detected services.
8. **Context pack assembler** — Create `apps/desktop/src/lib/project-intelligence/context-pack-assembler.ts` with per-mission context pack creation, inclusion/exclusion rationale, freshness tracking.
9. **Main process handlers** — Add IPC handlers to `index.ts` for all project intelligence operations.
10. **Preload bindings** — Add new channel bindings to `index.ts` (preload).
11. **ContextPanel UI** — Replace placeholder with real context dashboard.
12. **Tests** — Add unit tests for indexing pipeline, framework detection, impact analysis, context pack assembly.

### 4.2 Data Model

#### New TypeScript Interfaces (to be added to `entities.ts`)

```typescript
// Repository model
export interface ProjectIndex {
  id: string;
  projectId: string;
  repoRoot: string;
  branch: string;
  packageManager: string | null;
  buildCommand: string | null;
  testCommand: string | null;
  lockfiles: string[];
  monorepoPackages: string[];
  generatedDirs: string[];
  protectedPaths: string[];
  indexedAt: string;
  staleness: 'fresh' | 'stale' | 'unknown';
}

// File record
export interface FileRecord {
  id: string;
  projectId: string;
  path: string;
  language: string;
  sizeBytes: number;
  isGenerated: boolean;
  isProtected: boolean;
  lastModified: string;
  indexedAt: string;
}

// Symbol record
export interface SymbolRecord {
  id: string;
  projectId: string;
  fileId: string;
  filePath: string;
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'route' | 'handler' | 'job' | 'schema' | 'module';
  exportType: 'named' | 'default' | 'none';
  lineStart: number;
  lineEnd: number;
  signature: string | null;
  docComment: string | null;
}

// Reference edge (import/export dependency)
export interface ReferenceEdge {
  id: string;
  projectId: string;
  sourceFileId: string;
  targetFileId: string;
  sourceSymbolId: string | null;
  targetSymbolId: string | null;
  referenceType: 'import' | 'export' | 'dynamic-import' | 'require';
}

// Route record
export interface RouteRecord {
  id: string;
  projectId: string;
  fileId: string;
  method: string | null; // GET, POST, etc. or null for file-based routing
  path: string;
  handler: string | null;
  framework: string | null;
}

// API endpoint record
export interface ApiEndpointRecord {
  id: string;
  projectId: string;
  routeId: string | null;
  method: string;
  path: string;
  authRequired: boolean;
  description: string | null;
}

// Job record (background workers, cron, etc.)
export interface JobRecord {
  id: string;
  projectId: string;
  fileId: string;
  name: string;
  schedule: string | null;
  handler: string | null;
  description: string | null;
}

// Service topology node
export interface ServiceNode {
  id: string;
  projectId: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'storage' | 'auth' | 'cdn' | 'email' | 'queue' | 'external-api' | 'deploy-platform' | 'runtime-host';
  url: string | null;
  healthStatus: CapabilityHealth;
  capabilityId: string | null; // linked capability if applicable
  mcpServerId: string | null; // linked MCP server if applicable
}

// Service topology edge
export interface ServiceEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: 'depends-on' | 'calls' | 'stores-in' | 'authenticates-with' | 'deploys-to';
}

// Configuration variable record
export interface ConfigVariableRecord {
  id: string;
  projectId: string;
  name: string;
  sourceFile: string | null;
  defaultValue: string | null;
  isSecret: boolean;
  requiredEnvironments: string[];
  missingEnvironments: string[];
  description: string | null;
}

// Context pack (enriched from existing flat type)
export interface ContextPack {
  id: string;
  missionId: string;
  items: ContextItem[];
  warnings: ContextWarning[];
  tokenUsage: number;
  contextUsage: number;
  createdAt: string;
  updatedAt: string;
}

// Context item (new — replaces flat loadedFiles/loadedSymbols arrays)
export interface ContextItem {
  id: string;
  contextPackId: string;
  type: 'file' | 'symbol' | 'route' | 'api-endpoint' | 'service' | 'config' | 'memory-pack' | 'log' | 'incident' | 'decision';
  referenceId: string; // ID of the referenced entity
  title: string;
  summary: string;
  inclusionReason: string; // why this item was included
  source: 'auto' | 'manual' | 'impact-analysis' | 'framework-detection' | 'topology';
  freshness: 'fresh' | 'stale' | 'unknown';
  pinned: boolean;
}

// Context warning (new)
export interface ContextWarning {
  id: string;
  contextPackId: string;
  type: 'stale-index' | 'missing-context' | 'omitted-impact' | 'stale-assumption' | 'token-budget-exceeded';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  suggestedAction: string | null;
}
```

#### New SQLite Tables (to be added to `local-db.ts`)

```sql
CREATE TABLE IF NOT EXISTS project_indexes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  branch TEXT,
  package_manager TEXT,
  build_command TEXT,
  test_command TEXT,
  lockfiles_json TEXT DEFAULT '[]',
  monorepo_packages_json TEXT DEFAULT '[]',
  generated_dirs_json TEXT DEFAULT '[]',
  protected_paths_json TEXT DEFAULT '[]',
  indexed_at TEXT NOT NULL,
  staleness TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS file_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  size_bytes INTEGER,
  is_generated INTEGER DEFAULT 0,
  is_protected INTEGER DEFAULT 0,
  last_modified TEXT,
  indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'none',
  line_start INTEGER,
  line_end INTEGER,
  signature TEXT,
  doc_comment TEXT
);

CREATE TABLE IF NOT EXISTS reference_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_file_id TEXT NOT NULL,
  target_file_id TEXT NOT NULL,
  source_symbol_id TEXT,
  target_symbol_id TEXT,
  reference_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS route_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  method TEXT,
  path TEXT NOT NULL,
  handler TEXT,
  framework TEXT
);

CREATE TABLE IF NOT EXISTS api_endpoint_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  route_id TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  auth_required INTEGER DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS job_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  schedule TEXT,
  handler TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS service_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  capability_id TEXT,
  mcp_server_id TEXT
);

CREATE TABLE IF NOT EXISTS service_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relationship TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_variable_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_file TEXT,
  default_value TEXT,
  is_secret INTEGER DEFAULT 0,
  required_environments_json TEXT DEFAULT '[]',
  missing_environments_json TEXT DEFAULT '[]',
  description TEXT
);

CREATE TABLE IF NOT EXISTS context_packs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  token_usage INTEGER DEFAULT 0,
  context_usage INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 4.3 IPC Contract

#### New IPC Channels (to be added to `ipc.ts`)

```typescript
// Project Intelligence IPC
export interface ProjectIntelligenceChannel {
  // Index management
  getIndex: (projectId: string) => Promise<ProjectIndex | null>;
  triggerIndex: (projectId: string, options?: { fullReindex: boolean }) => Promise<{ success: boolean; fileCount: number }>;
  getIndexStatus: (projectId: string) => Promise<{ indexed: boolean; fileCount: number; staleness: string; indexedAt: string | null }>;

  // File queries
  getFiles: (projectId: string, filter?: { language?: string; isGenerated?: boolean }) => Promise<FileRecord[]>;
  getFile: (projectId: string, path: string) => Promise<FileRecord | null>;

  // Symbol queries
  getSymbols: (projectId: string, filter?: { fileId?: string; kind?: string }) => Promise<SymbolRecord[]>;
  getSymbol: (projectId: string, id: string) => Promise<SymbolRecord | null>;

  // Impact analysis
  getImpactAnalysis: (projectId: string, targetPath: string) => Promise<{
    affectedFiles: FileRecord[];
    affectedSymbols: SymbolRecord[];
    affectedRoutes: RouteRecord[];
    affectedServices: ServiceNode[];
    blastRadius: 'low' | 'medium' | 'high' | 'critical';
  }>;

  // Service topology
  getTopology: (projectId: string) => Promise<{ nodes: ServiceNode[]; edges: ServiceEdge[] }>;

  // Configuration
  getConfigVariables: (projectId: string) => Promise<ConfigVariableRecord[]>;
  getMissingConfig: (projectId: string, environment: string) => Promise<ConfigVariableRecord[]>;

  // Framework detection
  getDetectedStack: (projectId: string) => Promise<{
    frontend: string[];
    backend: string[];
    database: string[];
    testFramework: string[];
    deployment: string[];
    confidence: number;
  }>;
}

// Context Packs IPC
export interface ContextPacksChannel {
  createPack: (missionId: string, options?: ContextPackOptions) => Promise<ContextPack>;
  getPack: (packId: string) => Promise<ContextPack | null>;
  getPackForMission: (missionId: string) => Promise<ContextPack | null>;
  updatePack: (packId: string, updates: ContextPackUpdates) => Promise<ContextPack>;
  pinItem: (packId: string, itemId: string) => Promise<ContextPack>;
  unpinItem: (packId: string, itemId: string) => Promise<ContextPack>;
  swapStaleItem: (packId: string, itemId: string) => Promise<ContextPack>;
  getDashboard: (packId: string) => Promise<ContextDashboard>;
}
```

#### New Preload Bindings

```typescript
// In preload/index.ts — add to VibeFlowAPI:
projectIntelligence: ProjectIntelligenceChannel;
contextPacks: ContextPacksChannel;
```

### 4.4 API Design

All project intelligence operations are synchronous or near-synchronous (indexing may take seconds for large projects). The indexing pipeline runs in the main process and reports progress via IPC events.

**Indexing flow:**
1. Renderer calls `projectIntelligence.triggerIndex(projectId)`.
2. Main process starts indexing, returns `{ success: true, fileCount: 0 }` immediately.
3. Main process emits `projectIntelligence:indexProgress` events during indexing.
4. Main process emits `projectIntelligence:indexComplete` when done.
5. Renderer can poll `projectIntelligence.getIndexStatus(projectId)` for current state.

**Context pack assembly flow:**
1. When a mission starts (Component 12 triggers), the system calls `contextPacks.createPack(missionId, options)`.
2. The assembler queries the index for relevant files, symbols, routes, services.
3. It builds a context pack with inclusion rationale and warnings.
4. The pack is persisted and returned.
5. The renderer can display the pack via `contextPacks.getDashboard(packId)`.

### 4.5 UI Design

#### ContextPanel (replaces placeholder)

The ContextPanel will display:

- **Header:** Context pack title, mission link, creation time, staleness badge.
- **Summary bar:** Total items, token usage, context usage, warning count.
- **Composition breakdown:** Pie/bar chart showing items by category (files, symbols, routes, services, config, memory).
- **Item list:** Expandable list of context items with:
  - Type icon
  - Title
  - Inclusion reason
  - Freshness badge
  - Pin/unpin button
  - Swap button (for stale items)
- **Warnings section:** List of context warnings with severity and suggested actions.
- **Missing context:** List of top-impact omitted items with "request more" button.
- **Token budget:** Progress bar showing current usage vs. budget.
- **Actions:** "Rebuild pack", "Save preset", "Request more context" buttons.

### 4.6 State Management

- **Index state:** Stored in SQLite. Read on demand. No in-memory cache needed for initial implementation.
- **Context pack state:** Stored in SQLite. Loaded on demand. Renderer maintains local state for UI interactions (pin/unpin, swap).
- **Indexing progress:** Emitted via IPC events. Renderer shows progress indicator.

### 4.7 DevOps Implications

- No new CI/CD changes needed.
- No new deployment changes needed.
- Indexing may be slow on large projects — should be run asynchronously.
- Index data is local-only for Component 11. Sync will be added in Component 22 evolution.

---

## 5. Test Plan

### 5.1 Unit Tests

| Test | What it verifies |
|---|---|
| `framework-detector.test.ts` | Correct detection of React, TypeScript, Node, Vite, Electron, Supabase from file patterns and package.json |
| `indexing-pipeline.test.ts` | Correct file scanning, classification, symbol extraction on a mock project |
| `impact-analyzer.test.ts` | Correct dependency traversal and blast radius calculation |
| `context-pack-assembler.test.ts` | Correct context pack assembly with inclusion rationale and warnings |
| `topology-builder.test.ts` | Correct aggregation of capability registry, MCP servers, and detected services |

### 5.2 Integration Tests

| Test | What it verifies |
|---|---|
| IPC round-trip: trigger index → index complete → get index | Full IPC flow for indexing |
| IPC round-trip: create pack → get pack → get dashboard | Full IPC flow for context packs |
| SQLite persistence: index → restart → read index | Data survives app restart |
| SQLite persistence: create pack → restart → read pack | Data survives app restart |

### 5.3 Smoke Tests

| Test | What it verifies |
|---|---|
| App launches with Component 11 changes | No startup errors |
| ContextPanel renders with real data | No UI crashes |
| Indexing a small project completes | Index is created and queryable |
| Context pack is created for a mission | Pack is visible in ContextPanel |

---

## 6. Rollback Plan

### 6.1 Per-Feature Rollback

- **Domain types:** Revert `entities.ts` changes. No data migration needed (types are compile-time only).
- **IPC types:** Revert `ipc.ts` changes. No data migration needed.
- **Persistence:** New SQLite tables are created with `IF NOT EXISTS`. If rollback is needed, the tables remain but are unused. No data loss risk.
- **Indexing pipeline:** New file. Safe to remove.
- **ContextPanel:** Replace with original placeholder. No data loss.
- **IPC handlers:** New handlers in `index.ts`. Safe to remove.
- **Preload bindings:** New bindings in `index.ts` (preload). Safe to remove.

### 6.2 Catastrophic Rollback

- Revert to pre-rebuild baseline tag (`pre-rebuild-baseline`).
- All Component 11 changes are on a feature branch.
- If the branch fails validation, abandon and re-attempt with revised salvage audit.

---

## 7. Risks and Approvals Required

### 7.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Symbol parsing is language-specific and may miss non-TypeScript files | High | Medium | Start with TypeScript/JavaScript only. Mark other languages as "unsupported" in index staleness. |
| Indexing large projects may block the main process | Medium | High | Run indexing in a Web Worker or child process. Report progress via IPC events. |
| Context pack assembly may produce too much or too little context | Medium | Medium | Start with conservative defaults. Allow manual pin/exclude. Iterate based on feedback. |
| Impact analysis may be inaccurate without full type information | High | Medium | Use import/export graph as primary signal. Mark analysis as "approximate" when type info is unavailable. |
| New SQLite tables increase database size | Low | Low | Index data is text-heavy but bounded. Monitor size. Add cleanup/compaction if needed. |

### 7.2 Approvals Required

- **Architect:** Approval of domain type additions to `entities.ts` (ensure they align with master spec).
- **Orchestrator:** Approval of implementation scope and boundary (ensure no drift into Components 13, 15, 16, 19, 20).
- **Reviewer-Pusher:** Code review before any push.

---

## 8. What I Will NOT Build Yet (Deferred to Later Components)

| Deferred Item | Belongs To | Reason |
|---|---|---|
| Code modification / patch generation | Component 13 (Change Engine) | Out of scope — intelligence only, not action. |
| Isolated execution workspaces | Component 13 (Change Engine) | Out of scope — intelligence only. |
| Semantic diff grouping | Component 13 (Change Engine) | Out of scope — intelligence only. |
| Runtime capture and evidence bundling | Component 15 (Runtime/Debug/Evidence) | Out of scope — intelligence only. |
| Browser automation | Component 15 (Runtime/Debug/Evidence) | Out of scope — intelligence only. |
| Layered verification checks | Component 16 (Verification) | Out of scope — intelligence only. |
| Acceptance flows and deploy gating | Component 16 (Verification) | Out of scope — intelligence only. |
| Risk classification and approval gates | Component 19 (Approval/Risk/Audit) | Out of scope — intelligence only. |
| Audit chain and rollback linkage | Component 19 (Approval/Risk/Audit) | Out of scope — intelligence only. |
| Memory packs and decision knowledge retrieval | Component 20 (Memory/Skills) | Out of scope — intelligence only. Context pack references memory packs but does not implement them. |
| Prior fixes and architecture rules storage | Component 20 (Memory/Skills) | Out of scope — intelligence only. |
| Sync of intelligence data to Supabase | Component 22 (Sync) evolution | Out of scope — intelligence data is local-only for C11. |
| Real-time index watching (file watcher) | Future enhancement | Out of scope — manual reindex is sufficient for C11. |

---

## 9. Context Packs, Symbol Graphs, Impact Analysis, and Framework/Runtime Detection Boundaries

### 9.1 Context Packs

Context packs are **assembled, not accumulated**. Each pack is created fresh for a mission with explicit inclusion rationale. The pack assembler queries the index for:
- Files related to the mission's target areas (from plan steps).
- Symbols imported by those files.
- Routes and API endpoints touched by those files.
- Services connected to those files via the topology map.
- Configuration variables referenced by those files.

The pack includes **why** each item was included and **what was omitted**. It does **not** include memory packs (Component 20) — it only references them by ID.

### 9.2 Symbol Graphs

The symbol graph is built from **import/export analysis**, not from running a language server. For TypeScript/JavaScript files, the pipeline:
1. Reads the file content.
2. Extracts import statements (ESM and CommonJS).
3. Extracts export statements (named, default, re-exports).
4. Extracts top-level declarations (functions, classes, interfaces, types, constants).
5. Records each as a `SymbolRecord` with file linkage.
6. Records each import/export as a `ReferenceEdge`.

This is **not** a full AST parse — it uses regex and simple parsing for initial implementation. Language-server integration is a future enhancement.

### 9.3 Impact Analysis

Impact analysis answers "if X changes, what breaks?" by traversing the reference graph:
1. Start from the changed file or symbol.
2. Follow all incoming reference edges (files that import this file/symbol).
3. Recursively traverse up to a configurable depth.
4. Collect affected files, symbols, routes, and services.
5. Calculate blast radius based on:
   - Number of affected files.
   - Whether affected files are in protected paths.
   - Whether affected services are production-facing.
   - Whether affected routes are public APIs.

The analysis is **approximate** — it does not account for dynamic imports, runtime behavior, or type-level changes. It is marked as such in the context pack warnings.

### 9.4 Framework/Runtime Detection

Framework detection uses **file pattern matching and package.json analysis**:
1. Scan for `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc.
2. Check for framework-specific files: `next.config.js`, `vite.config.ts`, `tailwind.config.js`, `docker-compose.yml`, etc.
3. Parse `package.json` dependencies to identify React, Vue, Svelte, Express, Fastify, Prisma, etc.
4. Check for test framework files: `jest.config.js`, `vitest.config.ts`, `playwright.config.ts`, etc.
5. Check for deployment descriptors: `Dockerfile`, `docker-compose.yml`, `coolify.yml`, etc.

Detection results are exposed as **evidence, not hidden guesses**. Each detection includes a confidence score and the evidence that supports it.

---

## 10. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? **Yes** — all existing files are classified in the reuse matrix. No casual rewrites.
- [x] Did I build for missions rather than files? **Yes** — context packs are assembled per-mission, not per-file.
- [x] Did I preserve transparency without requiring programmer workflows? **Yes** — context dashboard explains context quality in plain language.
- [x] Did I make MCP/capabilities first-class? **Yes** — service topology includes MCP servers and capabilities as data sources.
- [x] Did I attach evidence rather than confidence theater? **Yes** — framework detection results include evidence and confidence scores.
- [x] Did I classify risk and approvals? **N/A for this component** — impact analysis produces blast radius labels that will be consumed by Component 19.
- [x] Did I keep Git beneath the product surface? **Yes** — Git is not exposed as a primary navigation model.
- [x] Did I avoid turning the shell back into VS Code? **Yes** — ContextPanel is a mission-centric dashboard, not a file tree.

---

## 11. Gap Analysis Against Component 11 Spec

| Spec Requirement | Addressed? | How |
|---|---|---|
| Index the codebase | ✅ | Indexing pipeline scans, classifies, and persists file/symbol/reference data. |
| Identify frameworks and runtime shape | ✅ | Framework detector uses file patterns and package.json analysis. |
| Build symbol and dependency graphs | ✅ | Symbol records and reference edges form the graph. |
| Map routes, APIs, jobs, and services | ✅ | RouteRecord, ApiEndpointRecord, JobRecord, ServiceNode, ServiceEdge. |
| Identify environment variable usage | ✅ | ConfigVariableRecord tracks env vars, defaults, secrets, missing per environment. |
| Detect database schemas and migrations | ⚠️ Partial | File scanning detects migration files. Schema introspection is deferred to Component 18. |
| Build topology links between code and connected systems | ✅ | Topology builder aggregates capabilities, MCP servers, and detected services. |
| Assemble context packs for missions | ✅ | Context pack assembler creates per-mission packs with rationale. |
| Surface context quality and omissions | ✅ | ContextWarning and dashboard show stale, missing, and omitted context. |
| Context dashboard requirements | ✅ | ContextPanel implements all required dashboard features. |
| Indexing pipeline | ✅ | Full pipeline with scan, classify, parse, build graph, persist, invalidate. |
| Incremental refresh | ✅ | File-level invalidation, symbol-level refresh, command-triggered reindex. |
| Integration with language tooling | ⚠️ Partial | Initial implementation uses regex/simple parsing. Language-server integration is a future enhancement. |
| Failure modes to detect | ⚠️ Partial | Unresolved imports and config variables referenced but unset are detected. Others are deferred. |

---

## 12. Files to Be Created or Modified

### New Files

| File | Purpose |
|---|---|
| `apps/desktop/src/lib/project-intelligence/indexing-pipeline.ts` | File scanning, classification, symbol extraction, dependency graph building |
| `apps/desktop/src/lib/project-intelligence/framework-detector.ts` | Framework and stack detection |
| `apps/desktop/src/lib/project-intelligence/impact-analyzer.ts` | Impact analysis and blast radius calculation |
| `apps/desktop/src/lib/project-intelligence/topology-builder.ts` | Service topology aggregation |
| `apps/desktop/src/lib/project-intelligence/context-pack-assembler.ts` | Per-mission context pack assembly |
| `apps/desktop/src/lib/project-intelligence/index.ts` | Barrel export for all project intelligence modules |

### Modified Files

| File | Change |
|---|---|
| `apps/desktop/src/lib/shared-types/entities.ts` | Add new domain type interfaces |
| `apps/desktop/src/lib/shared-types/ipc.ts` | Add new IPC channel definitions |
| `apps/desktop/src/lib/storage/local-db.ts` | Add new SQLite tables and CRUD methods |
| `apps/desktop/src/main/index.ts` | Add new IPC handlers |
| `apps/desktop/src/preload/index.ts` | Add new IPC channel bindings |
| `apps/desktop/src/renderer/components/panels/ContextPanel.tsx` | Replace placeholder with real context dashboard |

---

**End of analysis. Awaiting Orchestrator approval before implementation.**
