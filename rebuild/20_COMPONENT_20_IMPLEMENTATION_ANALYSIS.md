# Component 20 — Memory, Skills, and Decision Knowledge: Implementation Analysis

**Date:** 2026-04-16
**Mode:** Builder (`qwen/qwen3.6-plus`)
**Spec:** [`rebuild/20_MEMORY_SKILLS_AND_DECISION_KNOWLEDGE.md`](20_MEMORY_SKILLS_AND_DECISION_KNOWLEDGE.md)
**Status:** Analysis-only — no application code written

---

## 1. Scope Summary

Component 20 is the final remaining rebuild component. It introduces a **first-class memory subsystem** that stores project-specific intelligence beyond what fits in active context windows, making prior fixes, architectural decisions, coding standards, release rules, fragile-area notes, and reusable investigation playbooks **retrievable and injectable** into Mode prompts when relevant.

The component covers three domains:

| Domain | What it stores | How it is used |
|---|---|---|
| **Memory** | Prior bug fixes, coding standards, fragile-area notes, provider gotchas, incident postmortems | Retrieved by tag/trigger matching, injected into context packs, shown in UI with provenance |
| **Skills** | Reusable learned patterns and executable runbooks (e.g., "When upload failures occur, inspect storage auth, signed URLs, and file size limits") | Selectively invoked by Modes or operator, governed and versioned |
| **Decision Knowledge** | Retained architectural and product decisions (the structured, queryable version of [`docs/decisions.md`](../docs/decisions.md)) | Referenced during planning, shown in context packs, auditable with provenance |

The component also defines:
- **Memory lifecycle** — write, evict, summarize, retire
- **Retrieval UX** — why a pack was suggested, what it contributed, staleness, last reviewer, include/exclude toggle
- **Privacy boundaries** — what must NEVER be written to memory

---

## 2. Explicit Non-Goals

The following are **explicitly out of scope** for Component 20:

| Out of Scope | Reason |
|---|---|
| **Vector-DB or external embedding infrastructure** | The spec does not demand it. Retrieval is tag/trigger/keyword-based, not semantic similarity. Adding embeddings would introduce a new dependency, infrastructure complexity, and drift risk. |
| **Component 11 project-intelligence rewrites** | Component 11 (indexing, framework detection, context-pack assembly) is already implemented and accepted. Component 20 *feeds into* context packs but does not rewrite the pipeline. |
| **Component 12 orchestration rewrites** | The OrchestrationEngine remains unchanged. Memory retrieval is a *context enrichment* step, not an orchestration behavior change. |
| **Component 22 cloud-sync reactivation** | Memory data is local-first (SQLite). Sync of memory items is a future concern. No Supabase table changes or sync-engine modifications. |
| **Packaging / auto-update / electron-builder changes** | No packaging impact. |
| **Real-time memory sharing between concurrent sessions** | Memory is per-project, per-device. No realtime broadcast. |
| **Automatic LLM-driven memory creation** | Memory items are created explicitly (by Modes during handoff, or by operator curation). No autonomous "learn from conversation" pipeline. |
| **Changing the existing 5-panel layout** | Memory UI is a new panel within the existing left-rail / PanelWorkspace architecture. |

---

## 3. Salvage / Brownfield Reuse Map

### 3.1 Types — [`apps/desktop/src/lib/shared-types/entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts)

| Existing Asset | Reuse Strategy |
|---|---|
| [`ContextItem`](../apps/desktop/src/lib/shared-types/entities.ts:759) type already has `type: 'memory-pack' | 'decision'` in its union — **reuse as-is** for memory and decision items inside context packs |
| [`ContextPack`](../apps/desktop/src/lib/shared-types/entities.ts:228) already has `loadedMemoryPacks: string[]` — **reuse as-is** |
| [`ContextPackEnriched`](../apps/desktop/src/lib/shared-types/entities.ts:783) — **reuse as the container** that memory items flow into |
| [`EvidenceItemType`](../apps/desktop/src/lib/shared-types/entities.ts:242) — no memory-specific types yet; **additive extension needed** |
| [`Incident`](../apps/desktop/src/lib/shared-types/entities.ts:469) — already exists; memory can reference incidents by ID |
| [`AuditRecord`](../apps/desktop/src/lib/shared-types/entities.ts:972) — already tracks provenance (role, mission, capability); **reuse pattern** for memory provenance |
| [`DesignDecision`](../apps/desktop/src/lib/shared-types/entities.ts:564) — already exists as an orchestration output; **extend or parallel** for persistent decision knowledge |

### 3.2 Storage — [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts)

| Existing Asset | Reuse Strategy |
|---|---|
| `context_packs` table (line 473) — stores packs as JSON blobs | **Reuse pattern**: memory packs will follow the same JSON-blob storage pattern for complex nested data |
| `audit_records` table (line 553) — provenance tracking pattern | **Reuse pattern**: memory items will have similar provenance columns |
| `incidents` table (line 325) — lifecycle tracking | **Reference by ID** from memory items |
| sql.js API patterns throughout | **Follow existing patterns** for all new table CRUD |

### 3.3 Runtime — Existing Modules

| Existing Asset | Reuse Strategy |
|---|---|
| [`ContextPackAssembler`](../apps/desktop/src/lib/project-intelligence/context-pack-assembler.ts:25) — already assembles context packs with items, warnings, token budget | **Extend**: add a `MemoryRetriever` dependency that supplies memory-pack items to the assembler |
| [`OrchestrationEngine`](../apps/desktop/src/lib/orchestrator/orchestration-engine.ts:149) — mission decomposition, role assignment | **No change needed**: memory retrieval happens *before* orchestration, enriching the context pack |
| [`generateHandoffDoc()`](../apps/desktop/src/lib/handoff/handoff-generator.ts:35) — already produces end-of-conversation summaries | **Extend**: handoff can trigger memory write (absorb conversation learnings into memory) |
| [`classifyAction()`](../apps/desktop/src/lib/approval/approval-engine.ts) — action classification | **Reference**: memory can store classification patterns for future reuse |

### 3.4 IPC / Preload — Existing Patterns

| Existing Asset | Reuse Strategy |
|---|---|
| Channel interface pattern (e.g., [`CapabilitiesChannel`](../apps/desktop/src/lib/shared-types/ipc.ts:495), [`AuditChannel`](../apps/desktop/src/lib/shared-types/ipc.ts:406)) | **Follow pattern**: create `MemoryChannel`, `SkillsChannel`, `DecisionsChannel` |
| [`VibeFlowAPI`](../apps/desktop/src/lib/shared-types/ipc.ts:813) interface | **Extend**: add `memory`, `skills`, `decisions` namespaces |
| Preload API exposure pattern (e.g., lines 182-203 for capabilities) | **Follow pattern**: expose memory/skills/decisions APIs via contextBridge |
| Event listener pattern with `removeAllListeners` cleanup | **Follow pattern** for memory retrieval events |

### 3.5 UI — Existing Panel Architecture

| Existing Asset | Reuse Strategy |
|---|---|
| [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) — section navigation | **Add**: "Memory" section entry |
| [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx) — panel registration | **Register**: new MemoryPanel |
| Placeholder panel pattern (e.g., [`WatchPanel.tsx`](../apps/desktop/src/renderer/components/panels/WatchPanel.tsx) before Component 21) | **Replace**: create real MemoryPanel with tabs |
| [`ContextPanel.tsx`](../apps/desktop/src/renderer/components/panels/ContextPanel.tsx) — already shows context packs | **Extend or co-locate**: memory retrieval results should be visible alongside context items |

### 3.6 Documentation Files

| Existing Asset | Reuse Strategy |
|---|---|
| [`docs/decisions.md`](../docs/decisions.md) — 15 decisions logged | **Migrate source**: decisions become the seed data for the Decision Knowledge store. The file remains as human-readable backup; the database becomes the queryable source. |
| [`docs/idiosyncrasies.md`](../docs/idiosyncrasies.md) — 10 entries of intentional weirdness | **Migrate source**: idiosyncrasies become seed data for the memory store (category: "idiosyncrasy"). The file remains as human-readable backup. |

---

## 4. Required New Types and Additive Extensions

### 4.1 New Types in `entities.ts`

```typescript
// ── Component 20: Memory, Skills, and Decision Knowledge ──

/** Categories of memory items. */
export type MemoryCategory =
  | 'prior-fix'
  | 'architecture-rule'
  | 'deployment-rule'
  | 'auth-identity'
  | 'provider-gotcha'
  | 'style-pattern'
  | 'incident-postmortem'
  | 'idiosyncrasy'
  | 'fragile-area'
  | 'coding-standard'
  | 'release-rule'
  | 'skill-runbook';

/** A single memory item — a unit of retained project intelligence. */
export interface MemoryItem {
  id: string;
  projectId: string;
  category: MemoryCategory;
  title: string;
  scope: string; // plain English: what subsystem / area this covers
  tags: string[]; // for trigger matching
  description: string; // structured facts
  freeFormNotes: string | null;
  examples: string[]; // concrete examples of the memory in action
  triggerConditions: string[]; // when this memory should be loaded
  freshnessNotes: string | null; // staleness indicator
  sourceMaterial: string | null; // where this came from (conversation ID, handoff, manual)
  owner: string | null; // Mode slug or 'operator'
  reviewer: string | null; // who last reviewed
  lastReviewedAt: string | null;
  revisionHistory: MemoryRevision[];
  isActive: boolean; // false = retired
  createdAt: string;
  updatedAt: string;
}

/** A single revision entry in a memory item's history. */
export interface MemoryRevision {
  revisionNumber: number;
  changedAt: string;
  changedBy: string; // Mode slug or 'operator'
  changeSummary: string;
  conversationId: string | null;
}

/** A skill — an executable runbook or structured procedure. */
export interface Skill {
  id: string;
  projectId: string;
  title: string;
  description: string; // plain English explanation
  category: MemoryCategory; // typically 'skill-runbook'
  steps: SkillStep[];
  triggerConditions: string[]; // when this skill should be suggested
  version: number;
  versionHistory: SkillVersionEntry[];
  owner: string | null;
  reviewer: string | null;
  lastReviewedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A single step within a skill runbook. */
export interface SkillStep {
  order: number;
  instruction: string;
  checkCondition: string | null; // optional guard
  fallbackAction: string | null;
}

/** A version history entry for a skill. */
export interface SkillVersionEntry {
  version: number;
  changedAt: string;
  changedBy: string;
  changeSummary: string;
}

/** A retained decision — the structured, queryable version of docs/decisions.md entries. */
export interface DecisionRecord {
  id: string;
  projectId: string;
  decisionNumber: number; // maps to "Decision N" in docs/decisions.md
  title: string;
  date: string;
  decidedBy: string; // e.g., "Orchestrator + Albert"
  decision: string; // what was decided
  alternativesConsidered: Array<{ option: string; reason: string }>;
  rationale: string;
  consequences: string[];
  relatedFiles: string[]; // file paths referenced
  tags: string[];
  isActive: boolean; // false = superseded
  supersededBy: string | null; // ID of the decision that replaced this
  createdAt: string;
  updatedAt: string;
}

/** Result of a memory retrieval query. */
export interface MemoryRetrievalResult {
  items: MemoryItem[];
  skills: Skill[];
  decisions: DecisionRecord[];
  retrievalReason: string; // why these were returned
  triggerMatch: string; // what triggered the retrieval
  totalTokenEstimate: number; // rough token count for injection
}

/** Memory lifecycle state for batch operations. */
export type MemoryLifecycleAction = 'write' | 'evict' | 'summarize' | 'retire' | 'reactivate';

/** Memory dashboard summary. */
export interface MemoryDashboard {
  totalMemories: number;
  memoriesByCategory: Record<string, number>;
  activeMemories: number;
  retiredMemories: number;
  staleMemories: number; // not reviewed in >30 days
  totalSkills: number;
  activeSkills: number;
  totalDecisions: number;
  activeDecisions: number;
  lastWriteAt: string | null;
  lastReviewAt: string | null;
}
```

### 4.2 Additive Extensions to Existing Types

| Type | Extension |
|---|---|
| [`EvidenceItemType`](../apps/desktop/src/lib/shared-types/entities.ts:242) | Add `'memory-write'` | `'memory-retrieval'` | `'decision-recorded'` |
| [`ActionType`](../apps/desktop/src/lib/shared-types/ipc.ts:329) union | Add `'memory:write'` | `'memory:retire'` | `'memory:summarize'` | `'skill:invoke'` | `'decision:record'` |
| [`ContextItem.type`](../apps/desktop/src/lib/shared-types/entities.ts:762) | Already includes `'memory-pack'` | `'decision'` — **no change needed** |
| [`HandoffContext`](../apps/desktop/src/lib/handoff/handoff-generator.ts:5) | Add `memoryItemsWritten?: MemoryItem[]` — items absorbed from this conversation |

---

## 5. Storage Changes Needed in `local-db.ts`

### 5.1 New Tables

```sql
-- Memory items table
CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  free_form_notes TEXT,
  examples_json TEXT NOT NULL DEFAULT '[]',
  trigger_conditions_json TEXT NOT NULL DEFAULT '[]',
  freshness_notes TEXT,
  source_material TEXT,
  owner TEXT,
  reviewer TEXT,
  last_reviewed_at TEXT,
  revision_history_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'skill-runbook',
  steps_json TEXT NOT NULL DEFAULT '[]',
  trigger_conditions_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  version_history_json TEXT NOT NULL DEFAULT '[]',
  owner TEXT,
  reviewer TEXT,
  last_reviewed_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Decision records table
CREATE TABLE IF NOT EXISTS decision_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  decision_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  decided_by TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT '',
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  rationale TEXT NOT NULL DEFAULT '',
  consequences_json TEXT NOT NULL DEFAULT '[]',
  related_files_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  superseded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.2 New CRUD Methods

| Method | Purpose |
|---|---|
| `upsertMemoryItem(item: MemoryItem)` | Create or update a memory item |
| `getMemoryItem(id: string)` | Get single memory item |
| `listMemoryItems(projectId: string, filters?)` | List with optional category/tag filters |
| `searchMemoryItems(projectId: string, query: { tags?, category?, triggerMatch? })` | Tag/trigger-based retrieval |
| `retireMemoryItem(id: string)` | Set is_active = 0 |
| `reactivateMemoryItem(id: string)` | Set is_active = 1 |
| `addMemoryRevision(id: string, revision: MemoryRevision)` | Append to revision history |
| `getStaleMemories(projectId: string, daysThreshold: number)` | Items not reviewed in N days |
| `getMemoryDashboard(projectId: string)` | Aggregate counts by category/status |
| `upsertSkill(skill: Skill)` | Create or update a skill |
| `getSkill(id: string)` | Get single skill |
| `listSkills(projectId: string, activeOnly?)` | List skills |
| `invokeSkill(id: string)` | Log invocation, increment version |
| `upsertDecisionRecord(record: DecisionRecord)` | Create or update a decision |
| `getDecisionRecord(id: string)` | Get single decision |
| `listDecisionRecords(projectId: string, activeOnly?)` | List decisions |
| `supersedeDecision(id: string, supersededBy: string)` | Mark decision as superseded |
| `getDecisionByNumber(projectId: string, number: number)` | Look up by decision number |
| `bulkWriteMemoriesFromHandoff(items: MemoryItem[])` | Batch write after handoff |
| `evictMemoriesOlderThan(projectId: string, cutoffDate: string)` | Lifecycle eviction |

### 5.3 Brownfield Migration: Seed Data

On first run after Component 20 implementation:
1. Parse [`docs/decisions.md`](../docs/decisions.md) — create `DecisionRecord` entries for all 15 existing decisions
2. Parse [`docs/idiosyncrasies.md`](../docs/idiosyncrasies.md) — create `MemoryItem` entries with category `'idiosyncrasy'`
3. Mark both as `sourceMaterial: 'docs/decisions.md'` / `'docs/idiosyncrasies.md'` respectively
4. These are **seed entries** — the files remain as human-readable backups

---

## 6. Runtime Modules to Add

### 6.1 `apps/desktop/src/lib/memory/memory-retriever.ts`

**Purpose:** Core retrieval engine. Matches mission intent, tags, trigger conditions, and affected subsystems to return relevant memory items, skills, and decisions.

**Dependencies (reuses):**
- [`LocalDb`](../apps/desktop/src/lib/storage/local-db.ts) — reads memory_items, skills, decision_records
- [`ImpactAnalyzer`](../apps/desktop/src/lib/project-intelligence/impact-analyzer.ts) — uses blast radius to identify fragile areas
- [`ContextPackAssembler`](../apps/desktop/src/lib/project-intelligence/context-pack-assembler.ts) — supplies retrieved items as ContextItem entries

**Key methods:**
- `retrieveForMission(missionId, missionTitle, operatorRequest): MemoryRetrievalResult` — primary retrieval entry point
- `retrieveByTags(projectId, tags): MemoryItem[]` — tag-based lookup
- `retrieveByTrigger(projectId, triggerText): MemoryRetrievalResult` — trigger-condition matching
- `getPinnedPacks(projectId): MemoryItem[]` — operator-pinned items
- `estimateTokenCount(result: MemoryRetrievalResult): number` — token budget awareness

**Retrieval algorithm (deterministic, no embeddings):**
1. Parse mission title and operator request for keywords
2. Match keywords against memory item tags (exact + substring)
3. Match against trigger_conditions (keyword overlap scoring)
4. Include all pinned items
5. Include decisions tagged with matching subsystems
6. Score and rank by relevance (tag match count + trigger match count + pinned bonus)
7. Apply token budget cap — lowest-scored items dropped first
8. Return with retrieval reason and trigger match explanation

### 6.2 `apps/desktop/src/lib/memory/memory-lifecycle.ts`

**Purpose:** Manages the memory lifecycle — write, evict, summarize, retire.

**Dependencies (reuses):**
- [`LocalDb`](../apps/desktop/src/lib/storage/local-db.ts)
- [`OpenRouterProvider`](../apps/desktop/src/lib/providers/openrouter-provider.ts) — optional LLM-assisted summarization
- [`HandoffStorage`](../apps/desktop/src/lib/handoff/handoff-storage.ts) — reads handoff docs for memory absorption

**Key methods:**
- `writeFromHandoff(handoffDoc, conversationId, projectId): MemoryItem[]` — absorb handoff learnings
- `writeManual(item: MemoryItem, operatorId: string): MemoryItem` — operator-created memory
- `evictStale(projectId, cutoffDate): number` — retire items not reviewed in N days
- `summarizeGroup(projectId, category: MemoryCategory): MemoryItem` — merge multiple items into one summary
- `retire(id: string, reason: string): void` — mark inactive with reason
- `getLifecycleStats(projectId): { total, active, retired, stale, lastWrite }`

**Lifecycle rules:**
| Action | Trigger | Approval |
|---|---|---|
| **Write** | Handoff completion or operator manual creation | Handoff writes are auto-approved (conversation already happened). Manual writes require operator confirmation. |
| **Evict** | Item not reviewed in 30 days AND no trigger matches in last 10 missions | Auto-retire with notification. Operator can reactivate. |
| **Summarize** | 3+ items in same category with overlapping tags | LLM-assisted merge, operator reviews before committing |
| **Retire** | Operator action or superseded decision | Operator confirmation required |

### 6.3 `apps/desktop/src/lib/memory/index.ts`

Barrel export for `memory-retriever.ts` and `memory-lifecycle.ts`.

### 6.4 Module Dependency Graph

```
memory-retriever.ts
  ├── LocalDb (read)
  ├── ImpactAnalyzer (fragile area identification)
  └── ContextPackAssembler (supplies items)

memory-lifecycle.ts
  ├── LocalDb (write/evict/retire)
  ├── OpenRouterProvider (optional summarization)
  └── HandoffStorage (reads handoff docs)

main/index.ts
  ├── MemoryRetriever (initialized with LocalDb, ImpactAnalyzer)
  ├── MemoryLifecycle (initialized with LocalDb, OpenRouterProvider)
  └── IPC handlers (memory:*, skills:*, decisions:*)

preload/index.ts
  └── Exposes memory, skills, decisions APIs
```

---

## 7. IPC and Preload Surface Additions

### 7.1 New IPC Channel Interfaces in `ipc.ts`

```typescript
// ── Component 20: Memory IPC ──

export interface MemoryChannel {
  list: (projectId: string, filters?: { category?: MemoryCategory; activeOnly?: boolean }) => Promise<MemoryItem[]>;
  get: (id: string) => Promise<MemoryItem | null>;
  search: (projectId: string, query: { tags?: string[]; category?: MemoryCategory; triggerMatch?: string }) => Promise<MemoryRetrievalResult>;
  create: (item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MemoryItem>;
  update: (id: string, updates: Partial<MemoryItem>) => Promise<MemoryItem>;
  retire: (id: string, reason: string) => Promise<{ success: boolean }>;
  reactivate: (id: string) => Promise<{ success: boolean }>;
  getStale: (projectId: string, daysThreshold?: number) => Promise<MemoryItem[]>;
  getDashboard: (projectId: string) => Promise<MemoryDashboard>;
  evictStale: (projectId: string, cutoffDate: string) => Promise<number>;
  summarizeGroup: (projectId: string, category: MemoryCategory) => Promise<MemoryItem>;
}

// ── Component 20: Skills IPC ──

export interface SkillsChannel {
  list: (projectId: string, activeOnly?: boolean) => Promise<Skill[]>;
  get: (id: string) => Promise<Skill | null>;
  create: (skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<Skill>;
  update: (id: string, updates: Partial<Skill>) => Promise<Skill>;
  invoke: (id: string) => Promise<Skill>;
  retire: (id: string) => Promise<{ success: boolean }>;
}

// ── Component 20: Decisions IPC ──

export interface DecisionsChannel {
  list: (projectId: string, activeOnly?: boolean) => Promise<DecisionRecord[]>;
  get: (id: string) => Promise<DecisionRecord | null>;
  getByNumber: (projectId: string, number: number) => Promise<DecisionRecord | null>;
  create: (record: Omit<DecisionRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DecisionRecord>;
  update: (id: string, updates: Partial<DecisionRecord>) => Promise<DecisionRecord>;
  supersede: (id: string, supersededBy: string) => Promise<{ success: boolean }>;
  seedFromDocs: (projectId: string) => Promise<{ decisions: number; memories: number }>;
}
```

### 7.2 Extend `VibeFlowAPI` in `ipc.ts`

```typescript
export interface VibeFlowAPI {
  // ... existing namespaces ...
  memory: MemoryChannel;
  skills: SkillsChannel;
  decisions: DecisionsChannel;
}
```

### 7.3 Extend `ActionType` union in `ipc.ts`

```typescript
export type ActionType =
  // ... existing values ...
  // Component 20: memory and decision actions
  | 'memory:write'
  | 'memory:retire'
  | 'memory:summarize'
  | 'skill:invoke'
  | 'decision:record';
```

### 7.4 Preload Additions in `preload/index.ts`

Follow the exact pattern used for Component 18 secrets/migration (lines 292-312):

```typescript
// Component 20: Memory, Skills, Decisions
memory: {
  list: (projectId, filters) => ipcRenderer.invoke('memory:list', projectId, filters),
  get: (id) => ipcRenderer.invoke('memory:get', id),
  search: (projectId, query) => ipcRenderer.invoke('memory:search', projectId, query),
  create: (item) => ipcRenderer.invoke('memory:create', item),
  update: (id, updates) => ipcRenderer.invoke('memory:update', id, updates),
  retire: (id, reason) => ipcRenderer.invoke('memory:retire', id, reason),
  reactivate: (id) => ipcRenderer.invoke('memory:reactivate', id),
  getStale: (projectId, days) => ipcRenderer.invoke('memory:getStale', projectId, days),
  getDashboard: (projectId) => ipcRenderer.invoke('memory:getDashboard', projectId),
  evictStale: (projectId, cutoff) => ipcRenderer.invoke('memory:evictStale', projectId, cutoff),
  summarizeGroup: (projectId, category) => ipcRenderer.invoke('memory:summarizeGroup', projectId, category),
},
skills: {
  list: (projectId, activeOnly) => ipcRenderer.invoke('skills:list', projectId, activeOnly),
  get: (id) => ipcRenderer.invoke('skills:get', id),
  create: (skill) => ipcRenderer.invoke('skills:create', skill),
  update: (id, updates) => ipcRenderer.invoke('skills:update', id, updates),
  invoke: (id) => ipcRenderer.invoke('skills:invoke', id),
  retire: (id) => ipcRenderer.invoke('skills:retire', id),
},
decisions: {
  list: (projectId, activeOnly) => ipcRenderer.invoke('decisions:list', projectId, activeOnly),
  get: (id) => ipcRenderer.invoke('decisions:get', id),
  getByNumber: (projectId, number) => ipcRenderer.invoke('decisions:getByNumber', projectId, number),
  create: (record) => ipcRenderer.invoke('decisions:create', record),
  update: (id, updates) => ipcRenderer.invoke('decisions:update', id, updates),
  supersede: (id, supersededBy) => ipcRenderer.invoke('decisions:supersede', id, supersededBy),
  seedFromDocs: (projectId) => ipcRenderer.invoke('decisions:seedFromDocs', projectId),
},
```

### 7.5 Main Process IPC Handlers in `main/index.ts`

Add ~25 new IPC handlers following the existing pattern (one `ipcMain.handle` per channel method). Initialize `MemoryRetriever` and `MemoryLifecycle` alongside existing services. Wire the `handoff:generate` handler to optionally call `memoryLifecycle.writeFromHandoff()`.

---

## 8. UI Surfaces

### 8.1 New Panel: `MemoryPanel.tsx`

A new panel registered in [`PanelWorkspace.tsx`](../apps/desktop/src/renderer/components/PanelWorkspace.tsx), accessible via the left rail.

**4-tab layout:**

| Tab | Content |
|---|---|
| **Memories** | List of all memory items grouped by category. Each item shows: title, category badge, tags, last reviewed date, staleness indicator, active/retired status. Click to expand: full description, examples, trigger conditions, revision history. Actions: edit, retire, reactivate, pin. |
| **Skills** | List of skills with version numbers, step count, last invoked date. Click to expand: full runbook with steps, trigger conditions, version history. Actions: edit, invoke (test run), retire. |
| **Decisions** | List of decision records (seeded from docs/decisions.md). Each shows: decision number, title, date, decided-by, active/superseded status. Click to expand: full decision with alternatives, rationale, consequences, related files. Actions: edit, supersede, link to new decision. |
| **Lifecycle** | Dashboard view: counts by category, stale items list, eviction controls, summarize-group controls. Shows "last write" and "last review" timestamps. |

### 8.2 Integration with Existing Panels

| Panel | Integration |
|---|---|
| [`ContextPanel.tsx`](../apps/desktop/src/renderer/components/panels/ContextPanel.tsx) | Show memory retrieval results as part of the context pack. Each memory item appears as a ContextItem with `type: 'memory-pack'`, showing why it was suggested and an include/exclude toggle. |
| [`MissionPanel.tsx`](../apps/desktop/src/renderer/components/panels/MissionPanel.tsx) | When a mission starts, show a badge indicating "N memory packs loaded" with a drill-down link. |
| [`HandoffDialog`](../apps/desktop/src/renderer/components/HandoffDialog.tsx) | After handoff generation, show a summary: "N memory items written from this conversation" with a link to review them. |
| [`LeftRail.tsx`](../apps/desktop/src/renderer/components/LeftRail.tsx) | Add "🧠 Memory" section entry between existing sections. |

### 8.3 Retrieval UX (Spec §6 compliance)

When memory is retrieved into a context pack, each item shows:
- **Why suggested:** "Matched tags: auth, redirect" or "Trigger: changing auth subsystem"
- **What contributed:** The description and key facts (truncated, expandable)
- **Staleness:** "Last reviewed 45 days ago — may be stale" (yellow) or "Reviewed 2 days ago" (green)
- **Last reviewer:** "Reviewed by: orchestrator" or "Reviewed by: operator"
- **Include/exclude toggle:** Checkbox to exclude from current context pack

---

## 9. Memory Lifecycle Boundaries

### 9.1 What Gets Written Automatically

| Source | What is written | Approval |
|---|---|---|
| **Handoff completion** | Key learnings from `whatWorked`, `whatFailed`, `warnings` are converted to memory items | **No approval** — the conversation already happened and the operator approved the handoff. Items are written with `sourceMaterial: conversationId`. |
| **Decision logging** | When a major decision is made (via IPC or code path), a DecisionRecord is created | **No approval** — decisions are factual records of what was decided. |

### 9.2 What Requires Approval to Retain

| Source | What requires approval | Approval mechanism |
|---|---|---|
| **Manual memory creation** | Operator-created memory items | Operator confirms before save (simple modal) |
| **Skill creation** | New skill runbooks | Operator confirms steps before save |
| **Summarization** | LLM-assisted merge of multiple memories | Operator reviews merged result before committing |

### 9.3 Retired vs. Summarized

| Action | When | Effect | Reversible |
|---|---|---|---|
| **Retire** | Item is obsolete, superseded, or no longer relevant | `is_active = 0`, hidden from retrieval, preserved in history | Yes — `reactivate` restores |
| **Summarize** | 3+ items in same category with overlapping content | Creates one new summary item, retires the originals | Partially — originals are retired but preserved; summary can be edited |
| **Evict** | Item not reviewed in 30 days AND no trigger matches in 10 missions | Auto-retire with notification | Yes — operator can reactivate |

### 9.4 Provenance on Every Item

Every memory item, skill, and decision record carries:
- `owner` — which Mode created it (e.g., `'architect'`, `'debugger'`) or `'operator'`
- `sourceMaterial` — which conversation ID, handoff filename, or manual entry
- `revisionHistory` — array of `MemoryRevision` with `changedBy`, `changedAt`, `changeSummary`, `conversationId`
- `projectId` — which project this belongs to
- `createdAt` / `updatedAt` — timestamps

This satisfies AGENTS.md rule 7: "Every action must have provenance: which Mode, which model, which conversation, which project."

---

## 10. Privacy / Safety Boundaries

### 10.1 What Must NEVER Be Written to Memory

| Category | Examples | Enforcement |
|---|---|---|
| **Secret values** | API keys, passwords, tokens, SSH private keys | `memory-lifecycle.ts` filters out any content matching secret patterns (keytar entries, `.env` values, `Authorization:` headers) |
| **Raw credentials** | OAuth tokens, Supabase anon keys (beyond noting they exist) | Same filter as above |
| **Personal data beyond project scope** | User's personal files, non-project conversations, system credentials | Memory is scoped to `projectId` — only project-relevant content is written |
| **Full file contents** | Entire source files, config files | Memory stores references and summaries, not full content. File references use paths only. |
| **Ephemeral debugging data** | Stack traces, temporary variable values, console output | These belong in evidence records (Component 15), not long-term memory |

### 10.2 Enforcement Mechanism

1. **Write-time filter** in `memory-lifecycle.writeFromHandoff()`:
   - Scan for patterns: `sk-`, `ghp_`, `eyJ`, `-----BEGIN`, `password`, `secret`, `token`
   - If found, redact and log a warning: `[MemoryLifecycle] Redacted secret-bearing content from memory item`
   - Store only the fact that a secret exists (e.g., "OpenRouter API key configured") without the value

2. **UI-level guard**: Memory creation form warns if content appears to contain secrets

3. **Audit trail**: All memory writes are logged to `audit_records` with `actionType: 'memory:write'`

---

## 11. Test Plan

### 11.1 Unit Tests

| Test File | Tests |
|---|---|
| `memory-retriever.test.cjs` | Tag matching (exact, substring, none), trigger condition scoring, pinned item inclusion, token budget capping, retrieval reason generation, empty result handling |
| `memory-lifecycle.test.cjs` | Write from handoff (parses whatWorked/whatFailed), secret redaction (5 patterns), evict stale (date comparison), retire/reactivate toggle, summarize group (merges 3 items) |
| `local-db-memory.test.cjs` | CRUD for memory_items, skills, decision_records tables, search with filters, stale query, dashboard aggregation, seed from docs parsing |

### 11.2 Integration Tests

| Test | Description |
|---|---|
| Handoff → Memory write | Generate a handoff, verify memory items are created with correct provenance |
| Memory → Context pack | Create memory items, assemble a context pack, verify items appear as ContextItem entries |
| Decision seed → List | Seed from docs/decisions.md, verify 15 decisions are created with correct numbers |
| Idiosyncrasy seed → List | Seed from docs/idiosyncrasies.md, verify 10 memory items are created with category 'idiosyncrasy' |

### 11.3 Smoke Tests

| Test | Description |
|---|---|
| `tsc --noEmit` passes | Zero TypeScript errors |
| App launches | Memory panel renders in left rail |
| Memory CRUD | Create, read, update, retire, reactivate a memory item via UI |
| Decision list | Decisions tab shows seeded decisions from docs/decisions.md |
| Skills list | Skills tab is empty initially, create a skill, verify it appears |

---

## 12. Rollback Plan

### 12.1 If Component 20 Breaks the App

1. **Immediate rollback**: Comment out the 3 new IPC handler blocks in `main/index.ts` and the 3 preload namespaces in `preload/index.ts`. The app will start without memory functionality but all existing features remain intact.

2. **Database rollback**: The 3 new tables (`memory_items`, `skills`, `decision_records`) are created with `CREATE TABLE IF NOT EXISTS`. They do not affect existing tables. No data loss is possible. If needed, drop the tables:
   ```sql
   DROP TABLE IF EXISTS memory_items;
   DROP TABLE IF EXISTS skills;
   DROP TABLE IF EXISTS decision_records;
   ```

3. **Type rollback**: Remove the new types from `entities.ts` and `ipc.ts`. The existing `ContextItem.type` union already includes `'memory-pack'` and `'decision'`, so removing the new types won't break existing context packs.

4. **UI rollback**: Remove MemoryPanel import and registration from `PanelWorkspace.tsx`. Remove the Memory section from `LeftRail.tsx`.

### 12.2 If Seed Data Migration Fails

- The seed-from-docs parsing is a one-time operation wrapped in try/catch
- If it fails, log a warning and continue — the memory system works with empty data
- Operator can manually trigger seed via the UI later

---

## 13. Risks and Dependencies

### 13.1 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Memory accumulation / junk** | High | Strict eviction policy (30-day review threshold), operator-visible stale list, no autonomous LLM writing |
| **Token budget overflow** | Medium | Retrieval result includes `totalTokenEstimate`; context pack assembler already enforces budget |
| **Stale memory influencing prompts** | High | Every retrieved item shows staleness; operator can exclude; retrieval reason is visible |
| **Secret leakage into memory** | Critical | Write-time filter with pattern matching, audit trail, UI warning |
| **Large SQLite database growth** | Low | Memory items are text-only; even 1000 items at ~500 bytes each = ~500KB. Eviction keeps it bounded. |
| **IPC handler duplication in main/index.ts** | Medium | The file already has a duplicated handler problem. New handlers are added in a single bounded block with clear comments. |

### 13.2 Dependencies

| Dependency | Status | Impact |
|---|---|---|
| Component 11 (Context Pack Assembler) | ✅ Implemented | MemoryRetriever feeds into it |
| Component 12 (Orchestration Engine) | ✅ Implemented | No changes needed |
| Component 15 (Evidence Capture) | ✅ Implemented | Memory can reference evidence by ID |
| Component 19 (Audit Records) | ✅ Implemented | Memory writes are logged here |
| Handoff System | ✅ Implemented | Handoff triggers memory write |
| LocalDb (sql.js) | ✅ Implemented | New tables and CRUD methods |

---

## 14. Recommended Phased Implementation Plan

### Phase 1: Types and Storage (Foundation)
**Files:** `entities.ts`, `ipc.ts`, `local-db.ts`
- Add all new types to `entities.ts`
- Add IPC channel interfaces to `ipc.ts`
- Extend `ActionType` union
- Create 3 new SQLite tables in `local-db.ts`
- Add all CRUD methods (~20 methods)
- **Test:** `local-db-memory.test.cjs` — CRUD, search, dashboard

### Phase 2: Runtime Modules (Core Logic)
**Files:** `memory-retriever.ts`, `memory-lifecycle.ts`, `memory/index.ts`
- Implement `MemoryRetriever` with tag/trigger matching algorithm
- Implement `MemoryLifecycle` with write, evict, summarize, retire
- Implement secret redaction filter
- **Test:** `memory-retriever.test.cjs`, `memory-lifecycle.test.cjs`

### Phase 3: IPC Wiring (Main + Preload)
**Files:** `main/index.ts`, `preload/index.ts`
- Initialize `MemoryRetriever` and `MemoryLifecycle` in main process
- Add ~25 IPC handlers (memory:*, skills:*, decisions:*)
- Extend `handoff:generate` to optionally write memory
- Add preload API exposure
- **Test:** Manual IPC invocation test

### Phase 4: UI — Memory Panel
**Files:** `MemoryPanel.tsx`, `LeftRail.tsx`, `PanelWorkspace.tsx`
- Create MemoryPanel with 4 tabs (Memories, Skills, Decisions, Lifecycle)
- Add Memory section to LeftRail
- Register panel in PanelWorkspace
- **Test:** Smoke test — panel renders, CRUD works

### Phase 5: Context Pack Integration
**Files:** `context-pack-assembler.ts`, `ContextPanel.tsx`
- Extend ContextPackAssembler to accept MemoryRetriever results
- Memory items appear as ContextItem entries in context packs
- Show retrieval reason, staleness, include/exclude toggle in ContextPanel
- **Test:** Integration test — memory → context pack flow

### Phase 6: Seed Data and Handoff Integration
**Files:** `main/index.ts`, `handoff-generator.ts`, `HandoffDialog.tsx`
- Implement seed-from-docs parsing (decisions.md → DecisionRecord, idiosyncrasies.md → MemoryItem)
- Extend HandoffContext with `memoryItemsWritten`
- Extend handoff:generate handler to call memoryLifecycle.writeFromHandoff()
- Show memory write summary in HandoffDialog
- **Test:** Integration tests — seed data, handoff → memory

### Phase 7: Verification
- `tsc --noEmit` — zero errors
- All unit tests pass
- Smoke test: app launches, all panels render, CRUD works
- Verify no secret leakage in memory items
- Verify retrieval reasons are accurate

---

## 15. Deferred Items

| Item | Reason for Deferral | Future Component |
|---|---|---|
| **Semantic search / embeddings** | Requires vector DB infrastructure; not in spec | Future enhancement |
| **Cross-device memory sync** | Component 22 sync is currently disabled | When sync is reactivated |
| **Autonomous LLM memory creation** | High risk of junk accumulation; requires careful design | Future enhancement with strict governance |
| **Memory sharing between projects** | Out of scope; memory is per-project | Future enhancement |
| **Skill execution engine** | Skills are currently informational runbooks; actual execution would need a separate runtime | Future enhancement |
| **Memory impact analytics** | "Did this memory actually help?" — requires feedback loop | Future enhancement |

---

## 16. Boundary Analysis with Adjacent Components

### Component 11 (Project Intelligence)
- **Boundary:** Component 11 indexes code, detects frameworks, assembles context packs. Component 20 provides *additional* context items (memories, skills, decisions) that flow *into* the context pack.
- **Interaction:** `MemoryRetriever.retrieveForMission()` is called by `ContextPackAssembler.assemble()`. Retrieved items become `ContextItem` entries with `type: 'memory-pack'` or `'decision'`.
- **No overlap:** Component 11 does not store long-term memory. Component 20 does not index code.

### Component 12 (Orchestration)
- **Boundary:** Component 12 decomposes missions and assigns roles. Component 20 provides context *before* decomposition.
- **Interaction:** None direct. Memory retrieval happens at context-pack assembly time, which precedes orchestration.
- **No overlap:** OrchestrationEngine is unchanged.

### Component 15 (Runtime Execution / Evidence)
- **Boundary:** Component 15 captures runtime evidence (logs, traces, screenshots). Component 20 can *reference* evidence by ID but does not store evidence content.
- **Interaction:** Memory items can include `sourceMaterial` pointing to evidence record IDs.
- **No overlap:** Evidence is ephemeral/runtime; memory is persistent/long-term.

### Component 18 (Secrets / Migration Safety)
- **Boundary:** Component 18 manages secret inventory and migration plans. Component 20 must *not* store secret values.
- **Interaction:** Memory lifecycle filter redacts secret-bearing content. Memory can note "secret X exists" without storing the value.
- **No overlap:** Secrets are in keytar; memory is in SQLite.

### Component 19 (Audit / Risk / Rollback)
- **Boundary:** Component 19 audits actions. Component 20's memory writes are *audited* by Component 19.
- **Interaction:** Every memory write creates an `AuditRecord` with `actionType: 'memory:write'`.
- **No overlap:** Audit is the log; memory is the content.

### Component 21 (Observability / Self-Healing)
- **Boundary:** Component 21 monitors post-deploy health. Component 20 can store incident postmortems as memory items.
- **Interaction:** Memory items with category `'incident-postmortem'` can reference incident IDs from Component 21.
- **No overlap:** Observability is real-time monitoring; memory is persistent knowledge.

### Component 22 (Sync / Collaboration)
- **Boundary:** Component 22 syncs data to Supabase. Component 20 memory is local-first.
- **Interaction:** None currently. When sync is reactivated, memory tables would need Supabase migration and sync-engine mapping.
- **No overlap:** Memory is local-only for now.

---

## Summary

Component 20 is a **bounded, additive, brownfield-safe** subsystem that:
- Adds 3 new SQLite tables (~60 columns total) and ~20 CRUD methods
- Adds 2 new runtime modules (~400 lines total)
- Adds 3 new IPC channels (~25 handlers)
- Adds 1 new UI panel with 4 tabs
- Extends existing context-pack assembly with memory retrieval
- Seeds from existing docs/decisions.md and docs/idiosyncrasies.md
- Has clear lifecycle rules (write, evict, summarize, retire)
- Has strict privacy boundaries (no secrets, no raw credentials)
- Has full provenance on every item (Mode, model, conversation, project)
- Has a straightforward rollback plan (comment out IPC blocks, drop tables)
- Does not touch Components 11, 12, 15, 18, 19, 21, or 22 beyond defined interfaces
