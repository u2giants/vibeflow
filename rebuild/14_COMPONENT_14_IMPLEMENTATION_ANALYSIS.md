# Component 14 — Capability Fabric, MCP, and Tool Connectors: Implementation Analysis

**Version:** 2.0 — Brownfield Migration Revision
**Status:** Awaiting Orchestrator approval (revised for brownfield conflict)
**Date:** 2026-04-14
**Author:** Builder (`qwen/qwen3.6-plus`)
**Governing spec:** [`14_CAPABILITY_FABRIC_MCP_AND_TOOL_CONNECTORS.md`](14_CAPABILITY_FABRIC_MCP_AND_TOOL_CONNECTORS.md)
**Brownfield spec:** [`01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md`](01_BROWNFIELD_REBUILD_AND_EXISTING_CODE_REUSE.md)
**Implementation plan:** [`04_PROJECT_IMPLEMENTATION_PLAN.md`](04_PROJECT_IMPLEMENTATION_PLAN.md)

---

## 0. Brownfield Migration Conflict: Existing `Capability` Model and `capabilities` Table

### 0.1 What Already Exists (from Component 22)

Component 22 already created a live `Capability` persistence shape that is actively used by the sync engine. This is not a greenfield table.

**Existing `Capability` type** in [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts:232):

```typescript
export type CapabilityHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface Capability {
  id: string;
  name: string;
  type: 'mcp' | 'direct';
  health: CapabilityHealth;
  lastFailure: string | null;
  permissions: string[];
}
```

**Existing `capabilities` table** in [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts:249):

```sql
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'direct',
  health TEXT NOT NULL DEFAULT 'unknown',
  last_failure TEXT,
  permissions_json TEXT NOT NULL DEFAULT '[]'
);
```

**Existing CRUD methods** in [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts:684):
- `listCapabilities(): Capability[]`
- `getCapability(id: string): Capability | null`
- `upsertCapability(cap: Capability): void`
- `rowToCapability(row): Capability`

**Existing sync engine references** in [`sync-engine.ts`](apps/desktop/src/lib/sync/sync-engine.ts):
- `syncCapabilities()` — pulls from Supabase `capabilities` table
- `pushCapability()` — pushes to Supabase `capabilities` table

### 0.2 The Conflict

Component 14's proposed `Capability` type and `capabilities` table are **structurally incompatible** with the existing Component 22 schema:

| Field | Existing (C22) | Proposed (C14) | Compatible? |
|---|---|---|---|
| `id` | `TEXT PRIMARY KEY` | `TEXT PRIMARY KEY` | ✅ Same |
| `name` | `TEXT NOT NULL` | `TEXT NOT NULL` | ✅ Same |
| `type` | `TEXT` (`'mcp' \| 'direct'`) | **REPLACED by** `class` (`'filesystem' \| 'git' \| ...`) | ❌ Different column, different enum |
| `health` | `TEXT` (`'healthy' \| 'degraded' \| 'unhealthy' \| 'unknown'`) | `TEXT` (`'healthy' \| 'degraded' \| 'unauthorized' \| 'misconfigured' \| 'offline' \| 'unknown'`) | ⚠️ Same column, expanded enum |
| `last_failure` | `TEXT` | **SPLIT into** `last_failure_at` + `last_failure_reason` | ❌ Different columns |
| `permissions_json` | `TEXT` (`string[]`) | **REPLACED by** `actions_json` (`CapabilityAction[]`) | ❌ Different column, different structure |
| — | — | `owner`, `description`, `scope`, `auth_method`, `enabled`, `last_success_at`, `audit_notes`, `project_id`, `actions_json`, `created_at`, `updated_at` | ❌ All new columns |

**Impact:** This is not an additive migration. The existing `type` column is being replaced by `class`, the existing `permissions_json` is being replaced by `actions_json`, and the existing `last_failure` is being split. Any existing data in the `capabilities` table will be orphaned or silently lost if the table is recreated.

### 0.3 Migration Classification

This is an **in-place schema evolution with a compatibility bridge**. Specifically:

1. **In-place schema evolution** — the existing `capabilities` table will be altered (not dropped and recreated) to add new columns and rename/repurpose existing ones.
2. **Compatibility bridge** — a one-time data migration script will transform existing rows from the old schema to the new schema, mapping `type` → `class` and `permissions_json` → `actions_json` with sensible defaults for new required fields.

### 0.4 Migration Plan

**Step 1: Alter the existing table (not recreate)**

```sql
-- Add new columns (all nullable initially)
ALTER TABLE capabilities ADD COLUMN class TEXT;
ALTER TABLE capabilities ADD COLUMN owner TEXT;
ALTER TABLE capabilities ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN scope TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN auth_method TEXT;
ALTER TABLE capabilities ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE capabilities ADD COLUMN last_success_at TEXT;
ALTER TABLE capabilities ADD COLUMN last_failure_reason TEXT;
ALTER TABLE capabilities ADD COLUMN audit_notes TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN project_id TEXT;
ALTER TABLE capabilities ADD COLUMN actions_json TEXT DEFAULT '[]';
ALTER TABLE capabilities ADD COLUMN created_at TEXT;
ALTER TABLE capabilities ADD COLUMN updated_at TEXT;
```

**Step 2: Data migration (one-time backfill)**

```sql
-- Map existing 'type' to new 'class'
UPDATE capabilities SET class = CASE
  WHEN type = 'mcp' THEN 'mcp'
  WHEN type = 'direct' THEN 'direct-api'
  ELSE 'direct-api'
END WHERE class IS NULL;

-- Set default owner for existing rows
UPDATE capabilities SET owner = 'builtin' WHERE owner IS NULL;

-- Set default description/scope for existing rows
UPDATE capabilities SET description = name WHERE description = '';
UPDATE capabilities SET scope = 'Legacy capability — scope not yet defined' WHERE scope = '';

-- Set timestamps for existing rows
UPDATE capabilities SET created_at = datetime('now') WHERE created_at IS NULL;
UPDATE capabilities SET updated_at = datetime('now') WHERE updated_at IS NULL;

-- Map existing permissions_json to actions_json (conservative: empty actions array)
-- Existing permissions were string[]; new actions are CapabilityAction[] with schema
-- We preserve the old permissions as a metadata note and start with empty actions
UPDATE capabilities SET actions_json = '[]' WHERE actions_json = '[]';

-- Drop the old 'type' column after migration is verified
-- NOTE: SQLite does not support DROP COLUMN in all versions.
-- For sql.js, we must use the recreate-table approach for dropping columns.
-- However, we will KEEP the 'type' column as deprecated (not dropped) to avoid
-- breaking any code that still reads it. It will be ignored by new code.
```

**Step 3: Update the TypeScript type**

The `Capability` interface in [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts:234) will be expanded in place. The old `type` field will be marked `@deprecated` and retained for backward compatibility during the transition period.

**Step 4: Update LocalDb CRUD methods**

The existing `upsertCapability`, `listCapabilities`, `getCapability`, and `rowToCapability` methods in [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts:684) will be updated to handle the new schema. The old `type` field will be read but ignored in favor of `class`.

**Step 5: Update sync engine**

The `syncCapabilities()` and `pushCapability()` methods in [`sync-engine.ts`](apps/desktop/src/lib/sync/sync-engine.ts) will be updated to use the new schema. The Supabase `capabilities` table will also need a matching migration (M14).

### 0.5 Rollback Plan for This Migration

If the migration causes data loss or breaks existing functionality:

1. **Code rollback:** Revert the commits that modified `entities.ts`, `local-db.ts`, and `sync-engine.ts`. The old `Capability` type and CRUD methods will be restored.

2. **Data rollback (local SQLite):** The old `type` column is preserved (not dropped), so existing data is not lost. New columns (`class`, `owner`, etc.) will remain but be ignored by the old code. No data loss occurs.

3. **Data rollback (Supabase):** If the Supabase M14 migration is run and then rolled back, the new columns can be dropped from the Supabase `capabilities` table. The old `type` and `permissions_json` columns remain intact.

4. **Compatibility guarantee:** Because the old `type` column is preserved (not dropped), the old code can still read existing rows even after the migration. The new code reads `class` and ignores `type`. This is a forward-compatible migration.

### 0.6 Other Component 22 Persistence Collisions

| Component 22 Object | Collision with Component 14? | Resolution |
|---|---|---|
| `capabilities` table + `Capability` type | **YES** — schema conflict (detailed above) | In-place schema evolution with compatibility bridge |
| `capability_invocations` table | **NO** — does not exist in Component 22 | New table, additive, no conflict |
| `mcp_servers` table | **NO** — does not exist in Component 22 | New table, additive, no conflict |
| `syncCapabilities()` / `pushCapability()` | **YES** — references old schema | Must be updated to use new schema (part of migration) |
| `missions`, `plans`, `evidence_items`, `incidents`, `deploy_candidates`, `environments` | **NO** — unrelated domain objects | No collision |

**Conclusion:** The only persistence collision is the `capabilities` table and its associated sync methods. All other Component 14 tables (`capability_invocations`, `mcp_servers`) are additive and do not conflict with existing Component 22 data.

---

## 1. Scope Summary

Component 14 builds the **Capability Fabric** — the central registry and management layer that makes all internal and external capabilities (file operations, git, terminal, SSH, MCP servers, direct connectors) discoverable, inspectable, safe, and auditable.

### What this component WILL deliver:

1. **Capability Registry** — a central in-memory + persisted registry of all capabilities with metadata: id, type, owner, description, scope, auth method, available actions, parameter schema, permission class, health status, last success/failure, audit notes.

2. **MCP Subsystem** — full MCP server lifecycle: registration, launch, tool discovery, health checks, enable/disable, tool execution, caching of discovered tools, recent usage history. UI explains each server in plain English.

3. **Capability Health Model** — every capability reports live status: healthy, degraded, unauthorized, misconfigured, offline, unknown. The system will not route work to degraded/unauthorized capabilities without surfacing that fact.

4. **Invocation Audit** — every tool invocation logs: initiating role, mission id, plan step id, capability id, operation name, parameters, dry-run/live flag, expected side effects, timestamp, result, latency, emitted artifacts.

5. **Permission Classification** — capabilities classified by: read-only, local write, repository mutation, environment mutation, service mutation, deployment action, destructive action, privileged host action, secret-bearing action. Integrated with the existing approval engine.

6. **Terminal Policy** — terminal commands classified before execution by filesystem scope, network access, package installation, git mutation, database touch, service/deploy touch, destructive flags. Blanket "terminal run is safe" is forbidden.

7. **Capabilities Panel (real)** — replaces the current placeholder [`CapabilitiesPanel.tsx`](apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx) with a real panel showing MCP connections, direct connectors, tool health, permissions, recent failures, and discovery state.

8. **MCP Management Screen** — a new screen (parallel to [`SshScreen.tsx`](apps/desktop/src/renderer/screens/SshScreen.tsx)) for adding, editing, enabling/disabling, and testing MCP server connections.

### What this component WILL NOT deliver (explicit non-goals):

- **Browser automation** — capability class defined in spec but implementation deferred to Component 15 (Runtime Execution).
- **Direct provider API connectors** (deployment, DNS, database, storage, auth) — capability class defined but actual connectors deferred to Component 17 (Environments/Deploy).
- **Secrets manager access** — capability class defined but implementation deferred to Component 18 (Secrets/Config/DB).
- **Log and metrics query access** — capability class defined but implementation deferred to Component 21 (Observability).
- **Artifact build and package actions** — capability class defined but implementation deferred to Component 13 (Change Engine) or Component 17 (Environments/Deploy).
- **Capability routing in the orchestration engine** — the orchestration engine (Component 12) will reference capabilities by id, but the actual routing logic that uses the registry to select capabilities for plan steps is a Component 12 concern. Component 14 provides the registry and health model that Component 12 will query.
- **Changes to the existing tooling service implementations** — the underlying file, terminal, git, and SSH services are preserved and wrapped, not rewritten.

---

## 2. Non-Goals

| Non-Goal | Reason |
|---|---|
| Rewrite file-service, terminal-service, git-service, or ssh-service | Brownfield mandate: these are classified as "Keep with adapter" in the salvage map. They work correctly. |
| Implement browser automation | Belongs to Component 15 (Runtime Execution, Debugging, and Evidence). |
| Implement deployment/DNS/database connectors | Belongs to Component 17 (Environments, Deployments, and Service Control Plane). |
| Implement secrets management | Belongs to Component 18 (Secrets, Config, Database, and Migration Safety). |
| Implement observability/log queries | Belongs to Component 21 (Observability, Incident Response, and Self-Healing). |
| Replace the existing approval engine | Component 14 integrates with it; Component 19 owns the approval engine. |
| Implement capability-based routing in orchestration | Component 12 owns orchestration; Component 14 provides the registry it queries. |
| Build the full CapabilitiesPanel with all features | Initial panel shows registry, health, MCP management. Advanced features (usage graphs, permission matrix) are future iterations. |

---

## 3. Salvage Audit of Existing Code

### 3.1 Tooling Services (apps/desktop/src/lib/tooling/)

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`file-service.ts`](apps/desktop/src/lib/tooling/file-service.ts:1) | File read/write/list/exists with path traversal protection | High — clean, focused, correct | **Keep with adapter** | Implementation is sound. Needs a capability registry wrapper that adds health tracking, permission classification, invocation logging, and audit trail. |
| [`terminal-service.ts`](apps/desktop/src/lib/tooling/terminal-service.ts:1) | Command execution with streaming output, process kill | High — clean, correct spawn pattern | **Keep with adapter** | Implementation is sound. Needs command classification layer (terminal policy), invocation logging, and health tracking. |
| [`git-service.ts`](apps/desktop/src/lib/tooling/git-service.ts:1) | Git status/diff/commit/push/log via local binary | High — clean, correct | **Keep with adapter** | Implementation is sound. Needs capability registry wrapper with health tracking, permission classification, and invocation logging. |
| [`ssh-service.ts`](apps/desktop/src/lib/tooling/ssh-service.ts:1) | SSH host discovery, key discovery, connection testing | High — clean, correct | **Keep with adapter** | Implementation is sound. Needs capability registry wrapper with health tracking, permission classification, and invocation logging. |

### 3.2 MCP Manager (packages/mcp-manager/)

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`README.md`](packages/mcp-manager/README.md:1) | Package description stub | N/A — no source | **Replace** (new implementation) | Only a README exists. The package describes `McpConnectionManager`, `McpToolRegistry`, `McpToolExecutor`, `McpConnectionTester` but none are implemented. Full implementation required. |

### 3.3 UI Surfaces

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`CapabilitiesPanel.tsx`](apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx:1) | Placeholder text "coming in Component 14" | N/A — placeholder | **Replace** | Must be replaced with real panel showing capability registry, health status, MCP connections, and tool discovery. |
| [`SshScreen.tsx`](apps/desktop/src/renderer/screens/SshScreen.tsx:1) | SSH host discovery and connection testing | High — working, clean UI | **Keep with adapter** | The screen works. It should be adapted to integrate with the new capability registry (show SSH as a capability with health status) rather than being a standalone screen. The existing UI logic is preserved. |

### 3.4 Shared Types

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts:232) | `Capability` interface with id, name, type, health, lastFailure, permissions — **already exists from Component 22** | Partial — too minimal, but live and synced | **Refactor in place with migration** | The current `Capability` type (lines 234-241) has only 6 fields and is actively used by the sync engine (`syncCapabilities()`, `pushCapability()`). Needs expansion to match the full capability registry schema. The `type` field (`'mcp' \| 'direct'`) must be mapped to the new `class` field (larger enum). The `permissions` field (`string[]`) must be replaced by `actions` (`CapabilityAction[]`). See §0 for the full brownfield migration plan. |
| [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts:260) | `ToolingChannel` interface for file/terminal/git/ssh IPC | High — sound | **Keep with adapter** | The existing IPC channels are preserved. New IPC channels will be added for capability registry queries, MCP management, and invocation logging. |

### 3.5 Main Process

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`index.ts`](apps/desktop/src/main/index.ts:1) | All IPC handlers including tooling (lines 789-828) | Medium — monolithic but working | **Keep with adapter** | The existing tooling IPC handlers are preserved. New handlers will be added for capability registry, MCP management, and invocation logging. The monolithic file issue is a Phase 0 concern (split into handlers/), not a Component 14 concern. |
| [`preload/index.ts`](apps/desktop/src/preload/index.ts:82) | Exposes `window.vibeflow.tooling` API | High — sound | **Keep with adapter** | The existing tooling API is preserved. New API surface will be added for capability registry and MCP management. |

### 3.6 DevOps Clients

| File | Current Purpose | Quality | Classification | Reason |
|---|---|---|---|---|
| [`devops-templates.ts`](apps/desktop/src/lib/devops/devops-templates.ts) | Deployment templates | High | **Keep with adapter** (future) | Will become registered capabilities in Component 17. Not in scope for Component 14. |
| [`github-actions-client.ts`](apps/desktop/src/lib/devops/github-actions-client.ts) | GitHub Actions API client | High | **Keep with adapter** (future) | Will become a registered capability in Component 17. Not in scope for Component 14. |
| [`coolify-client.ts`](apps/desktop/src/lib/devops/coolify-client.ts) | Coolify deploy/restart/stop client | High | **Keep with adapter** (future) | Will become a registered capability in Component 17. Not in scope for Component 14. |
| [`health-check.ts`](apps/desktop/src/lib/devops/health-check.ts) | URL-based health monitoring | High | **Keep with adapter** (future) | Will become a registered capability in Component 21. Not in scope for Component 14. |

---

## 4. Reuse Matrix

| Existing File or Module | Current Purpose | Keep As-Is / Wrap / Refactor / Extract / Replace | Reason | Migration Impact |
|---|---|---|---|---|
| `apps/desktop/src/lib/tooling/file-service.ts` | File read/write/list/exists | **Wrap** | Sound implementation; needs capability registry adapter for health, permissions, audit | Low — wrapper layer only, no changes to service internals |
| `apps/desktop/src/lib/tooling/terminal-service.ts` | Command execution with streaming | **Wrap** | Sound implementation; needs command classification and audit | Low — wrapper layer only |
| `apps/desktop/src/lib/tooling/git-service.ts` | Git operations via binary | **Wrap** | Sound implementation; needs capability registry adapter | Low — wrapper layer only |
| `apps/desktop/src/lib/tooling/ssh-service.ts` | SSH discovery and testing | **Wrap** | Sound implementation; needs capability registry adapter | Low — wrapper layer only |
| `packages/mcp-manager/README.md` | Package description stub | **Replace** | No source code exists; full implementation required | New package — no migration needed |
| `apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx` | Placeholder text | **Replace** | Must show real capability data | Low — replace placeholder content |
| `apps/desktop/src/renderer/screens/SshScreen.tsx` | SSH management screen | **Keep with adapter** | Works; should integrate with capability registry | Low — add capability health display |
| `apps/desktop/src/lib/shared-types/entities.ts` (Capability type) | Minimal capability type — **already exists from Component 22, actively synced** | **Refactor in place with migration** | Needs 12+ new fields; `type` → `class` rename; `permissions` → `actions` structural change | **Medium** — in-place schema evolution with compatibility bridge required (see §0) |
| `apps/desktop/src/lib/shared-types/ipc.ts` (ToolingChannel) | IPC type definitions | **Keep with adapter** | Sound; new channels added | Low — additive type changes |
| `apps/desktop/src/main/index.ts` (tooling handlers) | IPC handler registration | **Keep with adapter** | Working handlers; new handlers added | Low — additive handler changes |
| `apps/desktop/src/preload/index.ts` (tooling API) | Exposed renderer API | **Keep with adapter** | Sound; new API surface added | Low — additive API changes |
| `apps/desktop/src/lib/approval/approval-engine.ts` | 3-tier approval engine | **Keep as-is** (integration only) | Component 14 calls into it; does not modify it | No migration — integration only |
| `apps/desktop/src/lib/storage/local-db.ts` | SQLite persistence — **already has `capabilities` table + CRUD from Component 22** | **Keep with adapter + schema migration** | Existing `capabilities` table must be evolved in place (not recreated); `capability_invocations` and `mcp_servers` are additive | **Medium** — brownfield migration required for `capabilities` table (see §0); new tables are additive |

---

## 5. Proposed Implementation Plan

### Phase 1: Domain Model and Types (Week 1, Day 1-2)

**5.1.1 Expand `Capability` type in [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts)**

```typescript
export type CapabilityClass =
  | 'filesystem'
  | 'git'
  | 'terminal'
  | 'browser'
  | 'mcp'
  | 'direct-api'
  | 'ssh'
  | 'secrets'
  | 'logs-metrics'
  | 'build-package';

export type CapabilityHealth =
  | 'healthy'
  | 'degraded'
  | 'unauthorized'
  | 'misconfigured'
  | 'offline'
  | 'unknown';

export type CapabilityPermission =
  | 'read-only'
  | 'local-write'
  | 'repository-mutation'
  | 'environment-mutation'
  | 'service-mutation'
  | 'deployment-action'
  | 'destructive-action'
  | 'privileged-host-action'
  | 'secret-bearing-action';

export interface CapabilityAction {
  id: string;
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>; // JSON Schema
  permission: CapabilityPermission;
}

export interface Capability {
  id: string;
  name: string;
  class: CapabilityClass;
  owner: string; // 'builtin', 'mcp:<server-id>', 'connector:<id>'
  description: string;
  scope: string; // plain English: "Read and write files in the project directory"
  authMethod: string | null; // 'none', 'api-key', 'oauth', 'ssh-key', 'token'
  actions: CapabilityAction[];
  health: CapabilityHealth;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  auditNotes: string;
  projectId: string | null; // null = global, otherwise project-scoped
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityInvocationLog {
  id: string;
  capabilityId: string;
  actionId: string;
  roleSlug: string | null;
  missionId: string | null;
  planStepId: string | null;
  parameters: Record<string, unknown>;
  dryRun: boolean;
  expectedSideEffects: string;
  timestamp: string;
  success: boolean;
  result: string | null;
  latencyMs: number;
  emittedArtifacts: string[];
  error: string | null;
}
```

**5.1.2 Add MCP-specific types**

```typescript
export interface McpServerConfig {
  id: string;
  name: string;
  description: string; // plain English: "This server lets the system talk to GitHub and do repository operations"
  command: string;
  args: string[];
  env: Record<string, string>; // non-secret env vars
  transport: 'stdio' | 'sse' | 'http';
  authMethod: string | null;
  scope: string;
  enabled: boolean;
  projectId: string | null;
  health: CapabilityHealth;
  lastHealthCheckAt: string | null;
  discoveredTools: McpToolInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface McpToolInfo {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>; // JSON Schema
}

export interface McpInvocationResult {
  toolName: string;
  success: boolean;
  result: unknown;
  error: string | null;
  latencyMs: number;
}
```

**5.1.3 Add IPC types for capability registry and MCP management**

New channels in [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts):

```typescript
export interface CapabilitiesChannel {
  list: () => Promise<Capability[]>;
  get: (id: string) => Promise<Capability | null>;
  getHealth: () => Promise<Record<string, CapabilityHealth>>;
  getInvocationLog: (capabilityId: string, limit?: number) => Promise<CapabilityInvocationLog[]>;
}

export interface McpChannel {
  list: () => Promise<McpServerConfig[]>;
  add: (config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'health' | 'discoveredTools'>) => Promise<McpServerConfig>;
  update: (id: string, updates: Partial<McpServerConfig>) => Promise<McpServerConfig>;
  remove: (id: string) => Promise<{ success: boolean }>;
  enable: (id: string) => Promise<McpServerConfig>;
  disable: (id: string) => Promise<McpServerConfig>;
  testConnection: (id: string) => Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }>;
  executeTool: (serverId: string, toolName: string, parameters: Record<string, unknown>) => Promise<McpInvocationResult>;
  onHealthChanged: (callback: (data: { serverId: string; health: CapabilityHealth }) => void) => void;
}
```

### Phase 2: Capability Registry (Week 1, Day 2-3)

**5.2.1 Create `apps/desktop/src/lib/capability-fabric/capability-registry.ts`**

The central registry that:
- Maintains an in-memory map of all registered capabilities
- Provides `register()`, `deregister()`, `get()`, `list()`, `listByClass()`, `listByHealth()` methods
- Tracks health status with `updateHealth()` method
- Logs invocations with `logInvocation()` method
- Persists capability configs to LocalDb (new tables)
- Emits events on health changes (forwarded to renderer via IPC)

**5.2.2 Create `apps/desktop/src/lib/capability-fabric/capability-adapter.ts`**

The adapter that wraps existing tooling services:
- `FileCapabilityAdapter` — wraps `FileService`, registers `files:read`, `files:write`, `files:list`, `files:exists` as actions
- `TerminalCapabilityAdapter` — wraps `TerminalService`, registers `terminal:run`, `terminal:kill` as actions with command classification
- `GitCapabilityAdapter` — wraps `GitService`, registers `git:status`, `git:diff`, `git:commit`, `git:push`, `git:log` as actions
- `SshCapabilityAdapter` — wraps `SshService`, registers `ssh:discover-hosts`, `ssh:discover-keys`, `ssh:test-connection` as actions

Each adapter:
- Registers the capability on startup
- Updates health on each invocation (success → healthy, failure → degraded/unhealthy based on error type)
- Logs every invocation with full provenance
- Classifies permissions for each action
- Routes dangerous operations through the approval engine

**5.2.3 Create `apps/desktop/src/lib/capability-fabric/terminal-policy.ts`**

The terminal command classifier that:
- Analyzes a command string before execution
- Returns a classification object with: filesystem scope, network access, package installation, git mutation, database touch, service/deploy touch, destructive flags
- Returns a risk level: safe, caution, dangerous
- Integrates with the approval engine to determine required tier

### Phase 3: MCP Subsystem (Week 1, Day 3-5, Week 2, Day 1-2)

**5.3.1 Create `packages/mcp-manager/src/` (full implementation)**

Due to the exFAT constraint, the source will also be copied to `apps/desktop/src/lib/mcp-manager/`.

Files:
- `mcp-connection-manager.ts` — manages MCP server lifecycle: add, edit, remove, enable/disable, launch, stop
- `mcp-tool-registry.ts` — discovers and caches tools from connected MCP servers
- `mcp-tool-executor.ts` — executes tool calls on the appropriate MCP server
- `mcp-connection-tester.ts` — tests whether an MCP server is reachable and responding
- `mcp-health-monitor.ts` — periodic health checks, emits health change events
- `index.ts` — exports all public APIs

**MCP transport implementation:**
- Uses `@modelcontextprotocol/sdk` npm package for the MCP protocol
- Supports stdio transport (spawn child process, communicate via stdin/stdout)
- Supports SSE transport (HTTP SSE connection)
- Supports HTTP transport (JSON-RPC over HTTP POST)

**MCP server lifecycle:**
1. User adds MCP server config (name, description, command, args, transport, auth)
2. `McpConnectionManager.launch()` spawns the process or connects via SSE/HTTP
3. `McpConnectionManager.discoverTools()` calls `tools/list` on the MCP server
4. Discovered tools are cached in `McpToolRegistry`
5. `McpHealthMonitor` periodically pings the server
6. On health change, event is emitted and forwarded to renderer

**5.3.2 MCP credential handling**
- Non-secret config (server URL, name, command, args) → stored in LocalDb + Supabase
- Secret credentials (API keys, tokens) → stored in keytar
- MCP tool calls → logged in invocation log with full provenance

### Phase 4: Persistence Layer (Week 2, Day 2-3)

**5.4.1 Evolve existing `capabilities` table (brownfield migration)**

The `capabilities` table already exists from Component 22 with columns: `id, name, type, health, last_failure, permissions_json`. We ALTER it in place rather than recreating. See §0 for the full migration plan.

```sql
-- Brownfield migration: evolve existing capabilities table from Component 22 schema
-- Add new columns (all nullable initially)
ALTER TABLE capabilities ADD COLUMN class TEXT;
ALTER TABLE capabilities ADD COLUMN owner TEXT;
ALTER TABLE capabilities ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN scope TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN auth_method TEXT;
ALTER TABLE capabilities ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE capabilities ADD COLUMN last_success_at TEXT;
ALTER TABLE capabilities ADD COLUMN last_failure_at TEXT;
ALTER TABLE capabilities ADD COLUMN last_failure_reason TEXT;
ALTER TABLE capabilities ADD COLUMN audit_notes TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN project_id TEXT;
ALTER TABLE capabilities ADD COLUMN actions_json TEXT DEFAULT '[]';
ALTER TABLE capabilities ADD COLUMN created_at TEXT;
ALTER TABLE capabilities ADD COLUMN updated_at TEXT;

-- Data migration: map existing 'type' to new 'class'
UPDATE capabilities SET class = CASE
  WHEN type = 'mcp' THEN 'mcp'
  WHEN type = 'direct' THEN 'direct-api'
  ELSE 'direct-api'
END WHERE class IS NULL;

-- Set default owner for existing rows
UPDATE capabilities SET owner = 'builtin' WHERE owner IS NULL;

-- Set default description/scope for existing rows
UPDATE capabilities SET description = name WHERE description = '';
UPDATE capabilities SET scope = 'Legacy capability — scope not yet defined' WHERE scope = '';

-- Set timestamps for existing rows
UPDATE capabilities SET created_at = datetime('now') WHERE created_at IS NULL;
UPDATE capabilities SET updated_at = datetime('now') WHERE updated_at IS NULL;

-- NOTE: The old 'type' column is preserved (not dropped) for backward compatibility.
-- The old 'permissions_json' column is preserved. New code reads 'class' and 'actions_json'.
```

**5.4.2 Add new tables to LocalDb (additive, no conflict)**

```sql
-- MCP server configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  command TEXT NOT NULL,
  args_json TEXT NOT NULL, -- JSON array of strings
  env_json TEXT, -- JSON object of non-secret env vars
  transport TEXT NOT NULL,
  auth_method TEXT,
  scope TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  project_id TEXT,
  health TEXT NOT NULL DEFAULT 'unknown',
  last_health_check_at TEXT,
  discovered_tools_json TEXT, -- JSON array of McpToolInfo
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Capability invocation log
CREATE TABLE IF NOT EXISTS capability_invocations (
  id TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  role_slug TEXT,
  mission_id TEXT,
  plan_step_id TEXT,
  parameters_json TEXT,
  dry_run INTEGER NOT NULL DEFAULT 0,
  expected_side_effects TEXT,
  timestamp TEXT NOT NULL,
  success INTEGER NOT NULL,
  result TEXT,
  latency_ms INTEGER,
  artifacts_json TEXT, -- JSON array of artifact strings
  error TEXT,
  FOREIGN KEY (capability_id) REFERENCES capabilities(id)
);
```

**5.4.3 Update existing LocalDb methods**

The existing methods in [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts:684) must be updated to handle the new schema:
- `upsertCapability(capability: Capability): void` — updated to write new columns (`class`, `owner`, `actions_json`, etc.)
- `listCapabilities(): Capability[]` — updated to read new columns
- `getCapability(id: string): Capability | null` — updated to read new columns
- `rowToCapability(row): Capability` — updated to map new columns to expanded `Capability` type

**5.4.4 Add new LocalDb methods**

New methods in [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts):
- `upsertMcpServer(config: McpServerConfig): void`
- `listMcpServers(): McpServerConfig[]`
- `getMcpServer(id: string): McpServerConfig | null`
- `deleteMcpServer(id: string): void`
- `logCapabilityInvocation(log: CapabilityInvocationLog): void`
- `getCapabilityInvocations(capabilityId: string, limit: number): CapabilityInvocationLog[]`

### Phase 5: IPC Handlers (Week 2, Day 3-4)

**5.5.1 Add capability registry handlers to [`main/index.ts`](apps/desktop/src/main/index.ts)**

New handlers:
- `capabilities:list` → returns all registered capabilities
- `capabilities:get` → returns a single capability by id
- `capabilities:getHealth` → returns health map
- `capabilities:getInvocationLog` → returns recent invocations

**5.5.2 Add MCP management handlers**

New handlers:
- `mcp:list` → returns all MCP server configs
- `mcp:add` → creates new MCP server, launches it, discovers tools
- `mcp:update` → updates MCP server config
- `mcp:remove` → stops and removes MCP server
- `mcp:enable` → enables and launches MCP server
- `mcp:disable` → disables and stops MCP server
- `mcp:testConnection` → tests MCP server connectivity
- `mcp:executeTool` → executes a tool call on an MCP server

**5.5.3 Add preload API surface**

New entries in [`preload/index.ts`](apps/desktop/src/preload/index.ts):
- `window.vibeflow.capabilities` → CapabilitiesChannel
- `window.vibeflow.mcp` → McpChannel

### Phase 6: UI Surfaces (Week 2, Day 4-5)

**5.6.1 Replace [`CapabilitiesPanel.tsx`](apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx)**

The real CapabilitiesPanel will show:
- **Capability overview** — list of all capabilities with health badges (color-coded: green=healthy, yellow=degraded, red=unhealthy/misconfigured/offline, gray=unknown)
- **Filter by class** — tabs for filesystem, git, terminal, SSH, MCP, direct-api
- **Filter by health** — show only unhealthy capabilities
- **Capability detail** — click to expand: description, scope, auth method, available actions with permission badges, recent invocations, last failure
- **MCP section** — list of MCP servers with enable/disable toggle, health status, tool count
- **Link to MCP management screen** — "Manage MCP Servers" button

**5.6.2 Create `apps/desktop/src/renderer/screens/McpScreen.tsx`**

A new screen for MCP server management (accessible from left rail "Capabilities" section):
- **List of MCP servers** — name, description, health, enabled status, tool count
- **Add MCP server** — form with: name, description (plain English), command, args, transport type, auth method, scope, project binding
- **Edit MCP server** — same form pre-populated
- **Test connection** — button that tests connectivity and shows discovered tools
- **Enable/disable toggle** — switches server on/off
- **Remove server** — with confirmation dialog
- **Plain English explanation** — each server shows "This server lets the system talk to X and do Y"

**5.6.3 Update left rail navigation**

The "Capabilities" section in [`LeftRail.tsx`](apps/desktop/src/renderer/components/LeftRail.tsx) should navigate to the MCP screen when clicked (similar to how SSH section navigates to SshScreen).

**5.6.4 Update [`SshScreen.tsx`](apps/desktop/src/renderer/screens/SshScreen.tsx)**

Minor update: show SSH capability health status from the registry alongside the existing host discovery UI. This integrates the existing screen into the capability fabric without rewriting it.

### Phase 7: Integration with Approval Engine (Week 3, Day 1)

**5.7.1 Terminal policy → approval integration**

The terminal policy classifier returns a risk level. The capability adapter uses this to:
- `safe` → Tier 1 (auto-approve)
- `caution` → Tier 2 (second-model review)
- `dangerous` → Tier 3 (human approval)

**5.7.2 Capability permission → approval integration**

Each capability action has a permission class. The adapter maps permissions to approval tiers:
- `read-only` → Tier 1
- `local-write` → Tier 2
- `repository-mutation` → Tier 2
- `environment-mutation` → Tier 3
- `service-mutation` → Tier 3
- `deployment-action` → Tier 3
- `destructive-action` → Tier 3
- `privileged-host-action` → Tier 3
- `secret-bearing-action` → Tier 3

### Phase 8: Tests (Week 3, Day 1-2)

**5.8.1 Unit tests**

- `capability-registry.test.ts` — register, deregister, list, health updates, invocation logging
- `capability-adapter.test.ts` — each adapter correctly wraps its service, logs invocations, updates health
- `terminal-policy.test.ts` — command classification for safe, caution, dangerous commands
- `mcp-connection-manager.test.ts` — add, remove, enable, disable, launch, stop
- `mcp-tool-registry.test.ts` — tool discovery, caching
- `mcp-tool-executor.test.ts` — tool execution, error handling

**5.8.2 Integration tests**

- Capability invocation flows through approval engine
- MCP server lifecycle (mock MCP server)
- Health monitoring and event propagation

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### 6.1 Data Model

| Entity | Storage | Sync |
|---|---|---|
| Capability configs | LocalDb `capabilities` table | Yes — synced to Supabase |
| MCP server configs | LocalDb `mcp_servers` table | Yes — synced to Supabase |
| MCP secrets (API keys) | keytar | No — device-local only |
| Capability invocation log | LocalDb `capability_invocations` table | No — device-local audit trail |
| Capability health (runtime) | In-memory only | No — computed per device |

### 6.2 IPC

New channels added to `VibeFlowAPI`:
- `capabilities: list, get, getHealth, getInvocationLog`
- `mcp: list, add, update, remove, enable, disable, testConnection, executeTool, onHealthChanged`

Existing channels preserved:
- `tooling.files.*`, `tooling.terminal.*`, `tooling.git.*`, `tooling.ssh.*` — unchanged

### 6.3 API

The capability registry exposes:
- `register(capability: CapabilityConfig): Capability`
- `deregister(id: string): void`
- `get(id: string): Capability | null`
- `list(): Capability[]`
- `listByClass(cls: CapabilityClass): Capability[]`
- `listByHealth(health: CapabilityHealth): Capability[]`
- `updateHealth(id: string, health: CapabilityHealth): void`
- `logInvocation(log: CapabilityInvocationLog): void`
- `getInvocationLog(capabilityId: string, limit: number): CapabilityInvocationLog[]`

### 6.4 UI

- **CapabilitiesPanel** — replaces placeholder, shows registry overview
- **McpScreen** — new screen for MCP server management
- **SshScreen** — minor update to show capability health
- **LeftRail** — "Capabilities" section navigates to McpScreen

### 6.5 State

- Capability registry is in-memory in the main process, backed by LocalDb persistence
- Health status is computed at runtime and not persisted
- MCP server configs are persisted and restored on app restart
- MCP servers are re-launched on app restart (not persisted as running)

### 6.6 DevOps Implications

- MCP servers may require external dependencies (npm packages, Docker images, binaries)
- The capability registry should detect missing dependencies and report `misconfigured` health
- MCP server configs may reference environment variables that must be present
- The system should validate MCP server configs before launch and report `misconfigured` if validation fails

---

## 7. Test Plan

### 7.1 Unit Tests

| Test File | What It Tests | Expected Outcome |
|---|---|---|
| `capability-registry.test.ts` | Register, deregister, list, filter, health updates, invocation logging | All operations work correctly, events emitted |
| `file-capability-adapter.test.ts` | File service wrapped as capability, invocations logged, health updated | File operations work through adapter, audit trail created |
| `terminal-capability-adapter.test.ts` | Terminal service wrapped, command classification, approval routing | Commands classified correctly, dangerous commands routed to approval |
| `git-capability-adapter.test.ts` | Git service wrapped as capability, invocations logged | Git operations work through adapter, audit trail created |
| `ssh-capability-adapter.test.ts` | SSH service wrapped as capability, invocations logged | SSH operations work through adapter, audit trail created |
| `terminal-policy.test.ts` | Command classification for various command types | Safe commands → Tier 1, caution → Tier 2, dangerous → Tier 3 |
| `mcp-connection-manager.test.ts` | Add, remove, enable, disable, launch, stop MCP servers | Server lifecycle works correctly |
| `mcp-tool-registry.test.ts` | Tool discovery from MCP servers, caching | Tools discovered and cached correctly |
| `mcp-tool-executor.test.ts` | Tool execution, error handling, result parsing | Tool calls execute and return results |

### 7.2 Integration Tests

| Test | What It Tests | Expected Outcome |
|---|---|---|
| Capability invocation → approval engine | Dangerous capability triggers approval | Approval request created, waits for decision |
| MCP server lifecycle (mock) | Full add → launch → discover → execute → stop cycle | All steps succeed, health updates correctly |
| Health monitoring → UI update | Health change event propagates to renderer | CapabilitiesPanel updates health badge in real-time |

### 7.3 UI Smoke Tests

| Test | What It Tests | Expected Outcome |
|---|---|---|
| CapabilitiesPanel renders | Panel shows capability list with health badges | All registered capabilities visible, health color-coded |
| McpScreen renders | Screen shows MCP server list and add form | Existing servers listed, add form works |
| Add MCP server | User adds a new MCP server | Server appears in list, launches, tools discovered |
| Enable/disable MCP server | User toggles server | Server starts/stops, health updates |
| Test MCP connection | User tests a server connection | Success/failure shown, tools listed |

---

## 8. Rollback Plan

### 8.1 Per-Feature Rollback

| Feature | Rollback Method | Risk |
|---|---|---|
| Capability registry | Remove new files, restore old tooling IPC handlers | Low — old handlers preserved |
| MCP subsystem | Remove new package, remove MCP IPC handlers | Low — no existing MCP code to break |
| CapabilitiesPanel | Restore placeholder component | Low — no data loss |
| McpScreen | Remove screen file, remove nav link | Low |
| `capabilities` table schema migration | Revert `entities.ts` and `local-db.ts` to pre-C14 state; old `type` column preserved; new columns ignored | **Medium** — existing capability data preserved in old columns; new columns ignored by old code (see §0.5) |
| `mcp_servers` table | Drop new table | Low — additive, no existing data |
| `capability_invocations` table | Drop new table | Low — additive, no existing data |

### 8.2 Data Rollback

- **`capabilities` table:** The old `type` column is preserved (not dropped) during migration. Rolling back code restores the old `Capability` type which reads `type` and ignores `class`. Existing data is not lost. New columns (`class`, `owner`, `actions_json`, etc.) remain in the table but are ignored by old code.
- **`mcp_servers` table:** Additive — dropping removes all MCP server configs. No existing data is lost.
- **`capability_invocations` table:** Additive — dropping removes all invocation audit logs. No existing data is lost.
- Existing tooling service data (file operations, git commits, etc.) is unaffected.
- MCP secrets in keytar are removed when servers are deregistered.

### 8.3 Catastrophic Rollback

- If the capability fabric breaks existing tooling, revert to the pre-Component-14 commit
- The existing tooling IPC handlers are preserved (not modified), so rollback is a file removal operation
- **Brownfield migration rollback:** Because the old `type` and `permissions_json` columns are preserved (not dropped), reverting code restores the old `Capability` type which reads those columns. The new columns (`class`, `owner`, `actions_json`, etc.) remain in the table but are ignored by old code. No data loss occurs.
- **Supabase rollback:** If the Supabase M14 migration is run and then rolled back, the new columns can be dropped from the Supabase `capabilities` table. The old columns remain intact.

---

## 9. Risks and Approvals Required

### 9.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Brownfield `capabilities` table migration breaks existing data** | Medium | High | Old `type` and `permissions_json` columns preserved (not dropped); migration is ALTER TABLE ADD COLUMN only; data backfill uses conservative defaults; rollback restores old code which reads old columns (see §0) |
| MCP SDK compatibility issues | Medium | High | Use the official `@modelcontextprotocol/sdk` package; test with a mock MCP server first |
| Capability registry becomes a bottleneck | Low | Medium | In-memory registry with async persistence; no synchronous DB calls on hot path |
| Terminal policy classifier false positives/negatives | Medium | Medium | Start with conservative classification; allow manual override; log all classifications for review |
| MCP server crashes affect app stability | Medium | High | Run MCP servers as separate child processes with proper error handling; isolate crashes |
| exFAT constraint complicates package structure | Certain | Low | Continue the existing pattern: source in `packages/`, copied to `apps/desktop/src/lib/` |
| Health monitoring overhead | Low | Low | Periodic checks at configurable intervals (default: 60s); not continuous polling |
| Supabase M14 migration not run → sync silently fails for new columns | Certain (until run) | Medium | Sync methods fail silently with console.error. No crash risk. New columns nullable. |

### 9.2 Approvals Required

| Approval | From | Why |
|---|---|---|
| Orchestrator | Orchestrator agent | Analysis approval before implementation begins |
| Architect | Architect agent | MCP transport choice (stdio vs SSE vs HTTP), capability registry design |
| Reviewer-Pusher | Reviewer-Pusher agent | Code review before any push |

---

## 10. What I Will NOT Build Yet (Belongs to Later Components)

| Item | Belongs To | Reason |
|---|---|---|
| Browser automation capability | Component 15 (Runtime Execution) | Requires browser automation infrastructure |
| Direct provider API connectors (deployment, DNS, database, storage, auth) | Component 17 (Environments/Deploy) | Requires environment model and deploy infrastructure |
| Secrets manager access capability | Component 18 (Secrets/Config/DB) | Requires secrets infrastructure |
| Log and metrics query capability | Component 21 (Observability) | Requires observability infrastructure |
| Artifact build and package actions | Component 13 or 17 | Requires change engine or deploy infrastructure |
| Capability-based routing in orchestration engine | Component 12 (already in progress) | Orchestration owns routing; Component 14 provides the registry |
| Advanced CapabilitiesPanel features (usage graphs, permission matrix) | Future iteration | Initial panel covers registry, health, MCP management |
| MCP server marketplace or template library | Future iteration | Out of scope for initial capability fabric |
| Capability dependency graph (capability A requires capability B) | Future iteration | Not required by Component 14 spec |

---

## 11. MCP as First-Class and Visible

### How MCP Avoids Invisible Plumbing Drift

The Component 14 spec explicitly requires MCP to be **first-class and visible**, not hidden internal plumbing. Here is how this is enforced:

1. **MCP has its own management screen** ([`McpScreen.tsx`](apps/desktop/src/renderer/screens/McpScreen.tsx)) — parallel to [`SshScreen.tsx`](apps/desktop/src/renderer/screens/SshScreen.tsx). Users can see, add, edit, enable/disable, and test MCP servers directly.

2. **Plain English descriptions** — every MCP server requires a `description` field that explains "This server lets the system talk to X and do Y." This is displayed prominently in the UI.

3. **Health is visible** — MCP servers show health badges (healthy/degraded/unauthorized/misconfigured/offline/unknown) in both the CapabilitiesPanel and the McpScreen.

4. **Discovered tools are visible** — after an MCP server connects, its discovered tools are listed with names, descriptions, and parameter schemas. The user can see exactly what the system can do through each server.

5. **Invocation history is visible** — the CapabilitiesPanel shows recent invocations for each capability, including MCP tools. The user can see what was called, when, with what parameters, and whether it succeeded.

6. **MCP is in the left rail navigation** — "Capabilities" is a top-level navigation section, not buried in settings.

7. **MCP servers are capabilities** — MCP servers are not a separate concept; they are registered as capabilities with `class: 'mcp'` and `owner: 'mcp:<server-id>'`. This means they appear alongside file, git, terminal, and SSH capabilities in the unified registry.

8. **Permission visibility** — each MCP tool has a permission classification displayed in the UI. The user can see what level of access each tool implies.

9. **Failure history is visible** — last failure time and reason are displayed for each capability, including MCP servers.

10. **Enable/disable is user-controlled** — the user can turn any MCP server on or off. The system does not auto-enable servers without user consent.

---

## 12. Anti-Drift Checklist

| Question | Answer |
|---|---|
| Did I reuse or adapt existing VibeFlow code before inventing new structure? | Yes — all 4 tooling services are wrapped, not rewritten. Existing IPC handlers are preserved. Existing approval engine is integrated, not modified. |
| Did I build for missions rather than files? | Yes — capability invocations log missionId and planStepId. The registry is mission-aware. |
| Did I preserve transparency without requiring programmer workflows? | Yes — plain English descriptions, health badges, and visible invocation logs. |
| Did I make MCP/capabilities first-class? | Yes — dedicated screen, left rail nav, health visibility, tool discovery visibility. |
| Did I attach evidence rather than confidence theater? | Yes — invocation logs with timestamps, results, latency, and artifacts. |
| Did I classify risk and approvals? | Yes — terminal policy classifier, permission classification, approval tier mapping. |
| Did I keep Git beneath the product surface? | Yes — Git is a capability, not a primary navigation model. |
| Did I avoid turning the shell back into VS Code? | Yes — capabilities are shown in a panel, not a file tree. |

---

## 13. Files to Be Created

| File | Purpose |
|---|---|
| `apps/desktop/src/lib/capability-fabric/capability-registry.ts` | Central capability registry |
| `apps/desktop/src/lib/capability-fabric/capability-adapter.ts` | Wraps existing tooling services as capabilities |
| `apps/desktop/src/lib/capability-fabric/terminal-policy.ts` | Terminal command classifier |
| `apps/desktop/src/lib/capability-fabric/index.ts` | Re-exports |
| `apps/desktop/src/lib/mcp-manager/mcp-connection-manager.ts` | MCP server lifecycle management |
| `apps/desktop/src/lib/mcp-manager/mcp-tool-registry.ts` | MCP tool discovery and caching |
| `apps/desktop/src/lib/mcp-manager/mcp-tool-executor.ts` | MCP tool execution |
| `apps/desktop/src/lib/mcp-manager/mcp-connection-tester.ts` | MCP connectivity testing |
| `apps/desktop/src/lib/mcp-manager/mcp-health-monitor.ts` | Periodic health checks |
| `apps/desktop/src/lib/mcp-manager/index.ts` | Re-exports |
| `apps/desktop/src/renderer/screens/McpScreen.tsx` | MCP server management screen |
| `packages/mcp-manager/src/*` | Canonical source (copied to apps/desktop/src/lib/mcp-manager/) |

## 14. Files to Be Modified

| File | Change |
|---|---|
| `apps/desktop/src/lib/shared-types/entities.ts` | Expand `Capability` type, add new types |
| `apps/desktop/src/lib/shared-types/ipc.ts` | Add `CapabilitiesChannel` and `McpChannel` |
| `apps/desktop/src/main/index.ts` | Add capability and MCP IPC handlers |
| `apps/desktop/src/preload/index.ts` | Add `capabilities` and `mcp` to `VibeFlowAPI` |
| `apps/desktop/src/lib/storage/local-db.ts` | Add new tables and methods |
| `apps/desktop/src/renderer/components/panels/CapabilitiesPanel.tsx` | Replace placeholder with real panel |
| `apps/desktop/src/renderer/screens/SshScreen.tsx` | Minor update to show capability health |
| `apps/desktop/src/renderer/components/LeftRail.tsx` | Ensure Capabilities nav links to McpScreen |

---

**END OF ANALYSIS — AWAITING ORCHESTRATOR APPROVAL**
