# Component 18 Implementation Analysis — Secrets, Configuration, Database, and Migration Safety

**Mode:** Builder (`qwen/qwen3.6-plus`)
**Date:** 2026-04-14
**Provenance:** Orchestrator task → Builder analysis → awaiting Orchestrator approval
**Governing spec:** [`rebuild/18_SECRETS_CONFIG_DATABASE_AND_MIGRATION_SAFETY.md`](rebuild/18_SECRETS_CONFIG_DATABASE_AND_MIGRATION_SAFETY.md)
**Working order:** `10, 22 (partially done), 12, 14, 11, 13, 19, 15, 16, 18, 17, 21, 20`

---

## 1. Scope Summary for This Component Only

Component 18 covers four tightly related surfaces:

1. **Secrets and config inventory** — a structured registry of all configuration variables and secrets the project knows about, with per-environment completeness tracking, sensitivity classification, and code-reference linking.
2. **Missing config detection** — a pre-deploy/pre-verification check that answers: what variables are required, which are missing, which changed since last deploy, and which code paths depend on them.
3. **Database awareness** — the system knows the database engine, schema source files, migration history, tables, relationships, protected entities, and high-risk data domains.
4. **Migration safety** — a risk-classified migration workflow that detects proposed schema/data changes, classifies them, shows blast radius, requires checkpoints/backups for dangerous operations, generates migration plans, and logs rollback constraints.

**What this component builds:**
- New shared types: `SecretRecord`, `MigrationPlan`, `MigrationRiskClass`, `MigrationPreview`, `DatabaseSchemaInfo`
- New SQLite tables: `secret_records`, `migration_plans`, `migration_history`
- New IPC channels: `SecretsChannel`, `MigrationChannel`
- New main-process services: `secrets-store.ts`, `migration-safety.ts`
- New preload API surfaces: `secrets`, `migration`
- New UI panels: `SecretsPanel.tsx`, `MigrationPanel.tsx` (rendered into the existing mission workspace)
- Integration with existing `ConfigVariableRecord` (Component 11) — extends it into a full secrets inventory
- Integration with existing `Environment.secretsComplete` boolean — replaces the placeholder with real data from the secrets inventory
- Integration with existing Component 19 audit system — migration actions produce audit records

**What this component does NOT build:**
- Actual Supabase migration execution (that is Component 17 deploy control plane territory)
- Secret rotation automation (that is a future capability)
- Real-time telemetry or incident detection (Component 21)
- Deploy initiation, environment promotion, or canary logic (Component 17)
- Actual database connection or query execution against production databases

---

## 2. Non-Goals for This Component

| Non-Goal | Reason |
|---|---|
| Execute migrations against real databases | Component 17 owns deploy execution; Component 18 only plans, classifies, and previews |
| Store actual secret values in SQLite | Secrets are stored in keytar (Windows Credential Manager); SQLite stores metadata only |
| Build a full migration runner | Out of scope — this component produces migration plans and safety checks, not execution |
| Replace `ConfigVariableRecord` | Component 11's `ConfigVariableRecord` is the discovery layer; Component 18 adds the inventory/management layer on top |
| Build observability or incident automation | Component 21 owns that; Component 18 only provides migration safety data that Component 21 may consume later |
| Implement secret rotation workflows | Future capability; this component only tracks rotation notes as metadata |
| Build environment drift detection UI | Component 17 owns environment management; Component 18 provides the data |

---

## 3. Salvage Audit of Existing VibeFlow Code

### 3.1 Existing code relevant to Component 18

| File / Module | Current Purpose | Quality |
|---|---|---|
| [`ConfigVariableRecord`](apps/desktop/src/lib/shared-types/entities.ts:686) | Config variable discovered by project intelligence (name, source file, isSecret flag, required/missing environments) | **Good** — already has `isSecret`, `requiredEnvironments`, `missingEnvironments` fields |
| [`config_variable_records` table](apps/desktop/src/lib/storage/local-db.ts:456) | SQLite table storing `ConfigVariableRecord` with CRUD methods | **Good** — table exists, CRUD works |
| [`Environment.secretsComplete`](apps/desktop/src/lib/shared-types/entities.ts:461) | Boolean flag on environment record indicating secrets are complete | **Placeholder** — set manually, not computed from real data |
| [`environments` table](apps/desktop/src/lib/storage/local-db.ts:342) | SQLite table with `secrets_complete` integer column | **Good** — column exists, needs computed population |
| [`ActionType` union](apps/desktop/src/lib/shared-types/ipc.ts:306) | Already includes `migration:run`, `migration:rollback`, `config:change`, `secret:rotate` | **Good** — action types already defined |
| [`EvidenceItemType`](apps/desktop/src/lib/shared-types/entities.ts:220) | Already includes `'schema-safety'` | **Good** — evidence type exists |
| [`RiskClass`](apps/desktop/src/lib/shared-types/entities.ts:864) | Already includes `destructive`, `privileged-production` | **Good** — risk classes cover migration scenarios |
| [`audit_records` table](apps/desktop/src/lib/storage/local-db.ts:548) | Already stores migration-related audit data via Component 19 | **Good** — can link migration plans to audit records |
| [`checkpoints` table](apps/desktop/src/lib/storage/local-db.ts:503) | Already provides rollback checkpoints for workspace runs | **Good** — migration safety can reference these |
| keytar (referenced in DevOps subsystem) | Stores GitHub token, Coolify API key | **Good** — existing secret storage mechanism |
| [`supabase-client.ts`](packages/storage/src/supabase-client.ts) | Supabase client factory | **Good** — reads config from env |
| [`supabase-schema.sql`](docs/supabase-schema.sql) | Supabase DDL for profiles, devices, projects | **Good** — baseline schema |
| [`supabase-migration-m4.sql`](docs/supabase-migration-m4.sql) | Supabase DDL for sync tables | **Good** — migration history reference |

### 3.2 What does NOT exist yet

| Missing | Impact |
|---|---|
| `SecretRecord` type | No structured secrets inventory |
| `MigrationPlan`, `MigrationRiskClass`, `MigrationPreview` types | No migration planning surface |
| `secret_records` SQLite table | No local persistence for secrets metadata |
| `migration_plans` SQLite table | No local persistence for migration plans |
| `migration_history` SQLite table | No local migration history tracking |
| `SecretsChannel`, `MigrationChannel` IPC | No IPC for secrets/migration surfaces |
| `secrets-store.ts` service | No secrets management logic |
| `migration-safety.ts` service | No migration classification/preview logic |
| `SecretsPanel.tsx`, `MigrationPanel.tsx` | No UI surfaces |
| Computed `Environment.secretsComplete` | Currently a manual boolean, not derived from inventory |

---

## 4. Reuse Matrix

| Existing file or module | Current purpose | Keep as-is / Wrap / Refactor / Extract / Replace | Reason | Migration impact |
|---|---|---|---|---|
| [`ConfigVariableRecord`](apps/desktop/src/lib/shared-types/entities.ts:686) | Discovered config variables from project intelligence | **Keep as-is** | Already has `isSecret`, `requiredEnvironments`, `missingEnvironments` — serves as the discovery input for the secrets inventory | None — additive only |
| [`config_variable_records` table + CRUD](apps/desktop/src/lib/storage/local-db.ts:1627) | SQLite persistence for config variables | **Keep as-is** | Working CRUD, correct schema | None |
| [`Environment.secretsComplete`](apps/desktop/src/lib/shared-types/entities.ts:461) | Boolean flag | **Refactor in place** | Change from manual boolean to computed value derived from `SecretRecord` inventory | Backward-compatible — existing code reads the boolean; new code computes it |
| [`environments` table](apps/desktop/src/lib/storage/local-db.ts:342) | Environment persistence | **Keep as-is** | `secrets_complete` column stays; population logic changes | None — column shape unchanged |
| [`ActionType` union](apps/desktop/src/lib/shared-types/ipc.ts:306) | Action type classification | **Keep as-is** | Already includes `migration:run`, `migration:rollback`, `config:change`, `secret:rotate` | None |
| [`EvidenceItemType.schema-safety`](apps/desktop/src/lib/shared-types/entities.ts:220) | Evidence type for schema safety | **Keep as-is** | Already defined | None |
| [`RiskClass`](apps/desktop/src/lib/shared-types/entities.ts:864) | Risk classification | **Keep as-is** | Already covers `destructive`, `privileged-production` | None |
| [`audit_records` table](apps/desktop/src/lib/storage/local-db.ts:548) | Audit persistence | **Keep as-is** | Migration actions will produce audit records via existing Component 19 infrastructure | None — additive usage |
| [`checkpoints` table](apps/desktop/src/lib/storage/local-db.ts:503) | Rollback checkpoints | **Keep as-is** | Migration safety references existing checkpoints | None |
| keytar (DevOps subsystem) | Secret storage for GitHub/Coolify tokens | **Wrap** | Wrap with a `secrets-store.ts` service that provides inventory metadata + keytar read/write | Additive — keytar behavior unchanged |
| [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts) | SQLite CRUD for all domain objects | **Refactor in place** | Add new tables (`secret_records`, `migration_plans`, `migration_history`) and CRUD methods | Additive — no existing tables modified |
| [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts) | All TypeScript interfaces | **Refactor in place** | Add new types (`SecretRecord`, `MigrationPlan`, `MigrationRiskClass`, `MigrationPreview`, `DatabaseSchemaInfo`) | Additive — no existing types modified |
| [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts) | IPC channel definitions | **Refactor in place** | Add `SecretsChannel`, `MigrationChannel`, extend `VibeFlowAPI` | Additive — no existing channels modified |
| [`main/index.ts`](apps/desktop/src/main/index.ts) | Main process, IPC handler registration | **Refactor in place** | Register new IPC handlers for secrets and migration | Additive — existing handlers unchanged |
| [`preload/index.ts`](apps/desktop/src/preload/index.ts) | Preload API bridge | **Refactor in place** | Expose `secrets` and `migration` on `window.vibeflow` | Additive — existing API unchanged |
| [`PanelWorkspace.tsx`](apps/desktop/src/renderer/components/PanelWorkspace.tsx) | Mission workspace with 9 panels | **Keep as-is** | New panels will be added to the workspace | Additive — existing panels unchanged |
| [`LeftRail.tsx`](apps/desktop/src/renderer/components/LeftRail.tsx) | Left navigation rail | **Keep as-is** | May add a "Secrets" or "Database" nav item | Additive — existing nav unchanged |
| [`EnvironmentPanel.tsx`](apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx) | Environment panel placeholder | **Refactor in place** | Populate with real secrets completeness data from inventory | Enhancement — placeholder becomes functional |

---

## 5. Proposed Implementation Plan

### Phase 1: Shared Types (Additive)

**Files:** [`entities.ts`](apps/desktop/src/lib/shared-types/entities.ts), [`ipc.ts`](apps/desktop/src/lib/shared-types/ipc.ts)

Add the following types to `entities.ts`:

```typescript
// Secrets inventory
export interface SecretRecord {
  id: string;
  projectId: string;
  keyName: string;
  category: string; // 'database', 'api-key', 'oauth', 'smtp', 'storage', 'auth', 'custom'
  description: string;
  requiredEnvironments: string[]; // environment IDs
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  sourceOfTruth: string; // e.g., 'Supabase dashboard', 'Coolify settings', 'operator-provided'
  rotationNotes: string;
  approvalRulesForChanges: string;
  codeReferences: string[]; // file paths that reference this secret
  storedInKeytar: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Migration risk classes
export type MigrationRiskClass =
  | 'additive-safe'
  | 'backfill-required'
  | 'index-performance'
  | 'destructive-schema'
  | 'data-rewrite'
  | 'auth-identity';

export interface MigrationSafeguard {
  type: string;
  description: string;
  required: boolean;
  satisfied: boolean;
}

// Migration plan
export interface MigrationPlan {
  id: string;
  projectId: string;
  missionId: string | null;
  riskClass: MigrationRiskClass;
  description: string;
  affectedTables: string[];
  estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical';
  forwardCompatible: boolean;
  backwardCompatible: boolean;
  requiresCheckpoint: boolean;
  checkpointId: string | null;
  safeguards: MigrationSafeguard[];
  orderingRequirement: 'app-first' | 'schema-first' | 'simultaneous';
  approvalRequired: boolean;
  rollbackConstraints: string;
  status: 'draft' | 'previewed' | 'approved' | 'executed' | 'rolled-back' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// Migration preview
export interface MigrationPreview {
  planId: string;
  sqlPreview: string;
  affectedEntities: string[];
  destructiveOperations: string[];
  estimatedDowntime: string | null;
  warnings: string[];
}

// Database schema info
export interface DatabaseSchemaInfo {
  projectId: string;
  engine: string; // 'postgresql', 'sqlite', 'mysql'
  schemaSourceFiles: string[]; // paths to .sql files
  migrationHistory: Array<{ id: string; name: string; appliedAt: string; riskClass: MigrationRiskClass }>;
  tables: Array<{ name: string; columnCount: number; rowCountEstimate: number | null; isProtected: boolean }>;
  relationships: Array<{ fromTable: string; toTable: string; type: string }>;
  protectedEntities: string[];
  highRiskDomains: string[];
}
```

Add to `ipc.ts`:

```typescript
export interface SecretsChannel {
  list: (projectId: string) => Promise<SecretRecord[]>;
  get: (id: string) => Promise<SecretRecord | null>;
  upsert: (record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>) => Promise<SecretRecord>;
  delete: (id: string) => Promise<{ success: boolean }>;
  getMissingForEnvironment: (projectId: string, environmentId: string) => Promise<SecretRecord[]>;
  getChangedSinceLastDeploy: (projectId: string) => Promise<SecretRecord[]>;
  verify: (id: string) => Promise<{ success: boolean; error?: string }>;
  getInventorySummary: (projectId: string) => Promise<{ total: number; missing: number; verified: number }>;
}

export interface MigrationChannel {
  createPlan: (plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MigrationPlan>;
  getPlan: (id: string) => Promise<MigrationPlan | null>;
  listPlans: (projectId: string) => Promise<MigrationPlan[]>;
  generatePreview: (planId: string) => Promise<MigrationPreview>;
  classifyRisk: (sql: string) => Promise<{ riskClass: MigrationRiskClass; safeguards: MigrationSafeguard[] }>;
  getSchemaInfo: (projectId: string) => Promise<DatabaseSchemaInfo | null>;
  requireCheckpoint: (planId: string) => Promise<{ checkpointRequired: boolean; checkpointId?: string }>;
}
```

Extend `VibeFlowAPI` with `secrets: SecretsChannel` and `migration: MigrationChannel`.

### Phase 2: SQLite Schema and CRUD (Additive)

**File:** [`local-db.ts`](apps/desktop/src/lib/storage/local-db.ts)

Add three new tables to `initializeSchema()`:

```sql
CREATE TABLE IF NOT EXISTS secret_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  key_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_environments_json TEXT NOT NULL DEFAULT '[]',
  sensitivity_level TEXT NOT NULL DEFAULT 'internal',
  source_of_truth TEXT NOT NULL DEFAULT '',
  rotation_notes TEXT DEFAULT '',
  approval_rules TEXT DEFAULT '',
  code_references_json TEXT NOT NULL DEFAULT '[]',
  stored_in_keytar INTEGER NOT NULL DEFAULT 0,
  last_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  mission_id TEXT,
  risk_class TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_tables_json TEXT NOT NULL DEFAULT '[]',
  estimated_blast_radius TEXT NOT NULL DEFAULT 'low',
  forward_compatible INTEGER NOT NULL DEFAULT 1,
  backward_compatible INTEGER NOT NULL DEFAULT 1,
  requires_checkpoint INTEGER NOT NULL DEFAULT 0,
  checkpoint_id TEXT,
  safeguards_json TEXT NOT NULL DEFAULT '[]',
  ordering_requirement TEXT NOT NULL DEFAULT 'schema-first',
  approval_required INTEGER NOT NULL DEFAULT 0,
  rollback_constraints TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  applied_by TEXT NOT NULL DEFAULT 'system',
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  rollback_executed INTEGER NOT NULL DEFAULT 0
);
```

Add CRUD methods:
- `upsertSecretRecord`, `listSecretRecords`, `getSecretRecord`, `deleteSecretRecord`
- `getMissingSecretsForEnvironment`, `getChangedSecretsSinceLastDeploy`
- `upsertMigrationPlan`, `getMigrationPlan`, `listMigrationPlans`
- `insertMigrationHistoryEntry`, `listMigrationHistory`

### Phase 3: Secrets Store Service (New)

**File:** `apps/desktop/src/lib/secrets/secrets-store.ts`

A thin service that:
- Wraps `LocalDb` secret record CRUD
- Provides `getMissingForEnvironment()` — compares `SecretRecord.requiredEnvironments` against the environment's known secrets
- Provides `getChangedSinceLastDeploy()` — compares `lastVerifiedAt` against the last deploy timestamp
- Provides `verify()` — checks if the secret exists in keytar (does NOT read the value, only checks presence)
- Provides `getInventorySummary()` — counts total, missing, verified
- Integrates with `Environment.secretsComplete` — computes the boolean from inventory data

**Boundary note:** This service does NOT store secret values. It stores metadata only. Actual secret values remain in keytar.

### Phase 4: Migration Safety Service (New)

**File:** `apps/desktop/src/lib/secrets/migration-safety.ts`

A service that:
- Provides `classifyRisk(sql: string)` — parses SQL to determine risk class using pattern matching:
  - `CREATE TABLE` / `ADD COLUMN` → `additive-safe`
  - `UPDATE` / `INSERT` with data transforms → `backfill-required` or `data-rewrite`
  - `CREATE INDEX` / `DROP INDEX` → `index-performance`
  - `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN TYPE` → `destructive-schema`
  - Changes to auth/identity tables → `auth-identity`
- Provides `generatePreview(planId)` — produces a `MigrationPreview` with SQL preview, affected entities, destructive operations list, warnings
- Provides `requireCheckpoint(planId)` — returns whether a checkpoint is required based on risk class
- Determines `orderingRequirement` — schema-first for additive, simultaneous for backfill, app-first for index changes
- Determines `approvalRequired` — true for `destructive-schema`, `data-rewrite`, `auth-identity`

### Phase 5: IPC Handlers in Main Process (Additive)

**File:** [`main/index.ts`](apps/desktop/src/main/index.ts)

Register new IPC handlers:
- `secrets:list`, `secrets:get`, `secrets:upsert`, `secrets:delete`
- `secrets:getMissingForEnvironment`, `secrets:getChangedSinceLastDeploy`
- `secrets:verify`, `secrets:getInventorySummary`
- `migration:createPlan`, `migration:getPlan`, `migration:listPlans`
- `migration:generatePreview`, `migration:classifyRisk`
- `migration:getSchemaInfo`, `migration:requireCheckpoint`

Each handler wraps the corresponding service method. No new dependencies.

### Phase 6: Preload API (Additive)

**File:** [`preload/index.ts`](apps/desktop/src/preload/index.ts)

Expose `secrets` and `migration` channels on `window.vibeflow`. Follow the existing pattern for IPC channel exposure.

### Phase 7: UI Panels (New)

**Files:**
- `apps/desktop/src/renderer/components/panels/SecretsPanel.tsx`
- `apps/desktop/src/renderer/components/panels/MigrationPanel.tsx`

**SecretsPanel.tsx:**
- Lists all secrets for the current project
- Shows sensitivity level badges (color-coded)
- Shows per-environment completeness (checkmarks for each required environment)
- "Missing secrets" alert banner
- "Verify all" button (checks keytar presence)
- Add/edit secret dialog (metadata only — no value entry)
- Summary card: total / missing / verified counts

**MigrationPanel.tsx:**
- Lists migration plans for the current project
- Shows risk class badges (color-coded: green for additive-safe, red for destructive-schema)
- "Create migration plan" button
- Plan detail view: affected tables, blast radius, safeguards checklist, ordering requirement
- "Generate preview" button — shows SQL preview and warnings
- Checkpoint requirement indicator
- Link to audit history (Component 19)

Both panels are placeholders that become functional. They render inside the existing mission workspace.

### Phase 8: Environment Panel Enhancement

**File:** [`EnvironmentPanel.tsx`](apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx)

Replace the placeholder with real data:
- Show secrets completeness per environment (computed from `SecretRecord` inventory)
- Show missing secrets list per environment
- Show migration readiness status

### Phase 9: Compilation and Smoke Test

Run `tsc --noEmit` to verify zero errors.

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### Data Model
- **Additive only.** Three new SQLite tables, no modifications to existing tables.
- `SecretRecord` does NOT store secret values — only metadata. Values remain in keytar.
- `MigrationPlan` is a planning artifact, not an execution record.
- `migration_history` is an append-only log.

### IPC
- Two new channels: `SecretsChannel`, `MigrationChannel`.
- 14 new IPC handlers in main process.
- All handlers are synchronous SQLite reads/writes — no async external calls.

### API
- `VibeFlowAPI` gains `secrets` and `migration` properties.
- No changes to existing API surfaces.

### UI
- Two new panels in the mission workspace.
- Environment panel becomes functional.
- No changes to existing panels or navigation.

### State
- All state is SQLite-backed. No in-memory state beyond service instances.
- `Environment.secretsComplete` transitions from manual boolean to computed value.

### DevOps
- Component 18 provides data that Component 17 (deploy control plane) will consume:
  - Secrets completeness check before deploy
  - Migration plan approval before schema changes
  - Blast radius information for deploy risk assessment
- Component 18 does NOT execute deploys or migrations.

---

## 7. Test Plan

### Unit Tests
- `secrets-store.test.ts`:
  - `getMissingForEnvironment()` returns correct missing secrets
  - `getChangedSinceLastDeploy()` returns correct changed secrets
  - `verify()` returns true when keytar has the secret, false when not
  - `getInventorySummary()` returns correct counts

- `migration-safety.test.ts`:
  - `classifyRisk()` correctly classifies:
    - `CREATE TABLE users` → `additive-safe`
    - `ALTER TABLE users ADD COLUMN email TEXT` → `additive-safe`
    - `DROP TABLE users` → `destructive-schema`
    - `ALTER TABLE users DROP COLUMN email` → `destructive-schema`
    - `CREATE INDEX idx_users_email ON users(email)` → `index-performance`
    - `UPDATE users SET role = 'admin' WHERE id = 1` → `data-rewrite`
    - `ALTER TABLE auth_sessions ...` → `auth-identity`
  - `requireCheckpoint()` returns true for destructive, false for additive-safe
  - `orderingRequirement` is correct for each risk class

### Integration Tests
- Full CRUD cycle for `SecretRecord` via `LocalDb`
- Full CRUD cycle for `MigrationPlan` via `LocalDb`
- IPC handler round-trip for secrets and migration channels

### Smoke Test
- `tsc --noEmit` passes with zero errors
- App launches without crashes
- Secrets panel renders with empty state
- Migration panel renders with empty state

---

## 8. Rollback Plan

If Component 18 introduces issues:

1. **Type errors:** All new types are additive. Remove the new type declarations from `entities.ts` and `ipc.ts` to revert.
2. **SQLite schema issues:** New tables use `CREATE TABLE IF NOT EXISTS`. They do not affect existing tables. Drop the three new tables to revert.
3. **IPC handler issues:** New handlers are registered additively. Remove the handler registrations in `main/index.ts` to revert.
4. **UI issues:** New panels are additive. Remove the panel imports and renders to revert.
5. **Data loss risk:** None — no existing data is modified. New tables are empty on first run.

**Rollback procedure:**
1. Revert the git commit containing Component 18 changes.
2. Restart the app — SQLite will ignore the dropped tables (they are `IF NOT EXISTS`).
3. No data migration needed — no existing data was touched.

---

## 9. Risks and Approvals Required

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| SQL pattern matching in `classifyRisk()` may miss edge cases | Medium | Start with conservative classification — default to `destructive-schema` for unrecognized patterns |
| `Environment.secretsComplete` computation change may break existing code that sets it manually | Low | Keep backward compatibility — if no `SecretRecord` exists, fall back to the manual boolean |
| Keytar integration for `verify()` may fail on non-Windows platforms | Low | Wrap in try/catch, return `unknown` status on failure |
| Migration panel UI may be confusing for non-programmers | Medium | Use plain-English labels, color-coded risk badges, and clear safeguard checklists |

### Approvals Required

| Approval | From | Reason |
|---|---|---|
| Orchestrator | Orchestrator | Analysis approval before implementation |
| Architect | Architect | None required — no architectural decisions needed |
| Reviewer-Pusher | Reviewer-Pusher | Code review before any git push |

---

## 10. Explicit List of What Will NOT Be Built Yet

| Deferred Item | Belongs To | Reason |
|---|---|---|
| Actual migration execution against Supabase | Component 17 | Deploy control plane owns execution |
| Secret rotation automation | Future capability | Requires keytar write + external API calls |
| Real-time database monitoring | Component 21 | Observability owns telemetry |
| Environment drift detection UI | Component 17 | Environment management owns drift |
| Deploy readiness gate | Component 17 | Deploy control plane owns gates |
| Incident detection from migration failures | Component 21 | Observability owns incidents |
| Supabase migration SQL file generation | Component 17 | Deploy control plane owns migration artifacts |
| Database connection testing | Component 17 | Service control plane owns connectivity |
| Coolify/Railway secret injection | Component 17 | Deploy platform owns secret distribution |
| Multi-database engine support | Future | PostgreSQL is the only target for now |

---

## 11. Boundary Analysis

### Component 17 (Environments, Deployments, Service Control Plane) — NEXT in order

**Boundary:** Component 18 provides data; Component 17 consumes it.
- Component 18 computes `Environment.secretsComplete` → Component 17 reads it before deploy
- Component 18 produces `MigrationPlan` → Component 17 executes it during deploy
- Component 18 classifies migration risk → Component 17 uses risk class for approval gating
- Component 18 does NOT initiate deploys, manage environments, or execute migrations

**Contract:** Component 18 exposes:
- `secrets:getMissingForEnvironment(projectId, environmentId)` → Component 17 calls this pre-deploy
- `migration:listPlans(projectId)` → Component 17 reads pending plans before deploy
- `Environment.secretsComplete` → Component 17 reads this for deploy readiness

### Component 21 (Observability, Incident Response, Self-Healing) — LATER in order

**Boundary:** Component 18 provides migration safety data; Component 21 consumes it for incident detection.
- Component 18's `migration_history` table → Component 21 reads for post-migration incident correlation
- Component 18's `MigrationPlan.riskClass` → Component 21 uses for anomaly threshold calibration
- Component 18 does NOT detect incidents, collect telemetry, or trigger self-healing

### Existing keytar/local-db/supabase/config scanning code

**Boundary:** Component 18 wraps and extends existing code.
- keytar: Component 18 reads keytar for secret presence verification (not value reading). No keytar schema changes.
- `local-db.ts`: Component 18 adds three new tables and CRUD methods. No existing table modifications.
- `supabase-client.ts`: Component 18 does NOT modify the Supabase client. It only plans migrations.
- `ConfigVariableRecord`: Component 18 reads `ConfigVariableRecord` as input for the secrets inventory. No modifications to the type or its CRUD.
- `Environment.secretsComplete`: Component 18 changes the population logic from manual to computed. The type and column shape remain unchanged.

---

## 12. Anti-Drift Checklist

- [x] Did I reuse or adapt existing VibeFlow code before inventing new structure? Yes — `ConfigVariableRecord`, `Environment.secretsComplete`, `ActionType`, `EvidenceItemType`, `RiskClass`, `audit_records`, `checkpoints`, keytar, `local-db.ts`, `entities.ts`, `ipc.ts` are all reused or extended.
- [x] Did I build for missions rather than files? Yes — migration plans are linked to missions, secrets are linked to projects and environments.
- [x] Did I preserve transparency without requiring programmer workflows? Yes — UI uses plain-English labels, color-coded risk badges, and clear safeguard checklists.
- [x] Did I make MCP/capabilities first-class? N/A for this component — secrets and migration are not MCP capabilities.
- [x] Did I attach evidence rather than confidence theater? Yes — migration previews show actual SQL, affected tables, and explicit warnings.
- [x] Did I classify risk and approvals? Yes — `MigrationRiskClass` with 6 classes, `approvalRequired` flag, safeguard checklist.
- [x] Did I keep Git beneath the product surface? Yes — no Git changes needed.
- [x] Did I avoid turning the shell back into VS Code? Yes — new panels are mission-workspace panels, not file-tree views.

---

**STATUS:** Analysis complete. Awaiting Orchestrator approval before implementation.
**WHAT WAS DONE:** Read all 11 governing files, audited existing codebase, produced full implementation analysis.
**FILES TO BE CHANGED (pending approval):**
- `apps/desktop/src/lib/shared-types/entities.ts` — ADDITIVE: 5 new types
- `apps/desktop/src/lib/shared-types/ipc.ts` — ADDITIVE: 2 new channels, extend VibeFlowAPI
- `apps/desktop/src/lib/storage/local-db.ts` — ADDITIVE: 3 new tables, ~12 new CRUD methods
- `apps/desktop/src/lib/secrets/secrets-store.ts` — NEW: secrets management service
- `apps/desktop/src/lib/secrets/migration-safety.ts` — NEW: migration classification service
- `apps/desktop/src/main/index.ts` — ADDITIVE: 14 new IPC handlers
- `apps/desktop/src/preload/index.ts` — ADDITIVE: secrets and migration API exposure
- `apps/desktop/src/renderer/components/panels/SecretsPanel.tsx` — NEW: secrets inventory UI
- `apps/desktop/src/renderer/components/panels/MigrationPanel.tsx` — NEW: migration planning UI
- `apps/desktop/src/renderer/components/panels/EnvironmentPanel.tsx` — REFACTORED: populate with real data
- `CURRENT_TASK.md` — UPDATE: record analysis completion

**HOW TO TEST (pending implementation):** `tsc --noEmit`, unit tests for `secrets-store` and `migration-safety`, smoke test app launch.
**LIMITATIONS / RISKS:** SQL pattern matching may miss edge cases (mitigated by conservative default). `Environment.secretsComplete` computation change is backward-compatible. Keytar verify may fail on non-Windows (mitigated by try/catch).
**NEXT STEP:** Awaiting Orchestrator approval of this analysis.
