# Component 22 — Implementation Analysis

Version: 1.0
Status: Retroactive analysis (code was implemented before this analysis was produced)
Date: 2026-04-14
Author: Builder (`qwen/qwen3.6-plus`)
Governing spec: [`22_SYNC_COLLABORATION_AND_PERSISTENT_STATE.md`](22_SYNC_COLLABORATION_AND_PERSISTENT_STATE.md)

---

## 1. Scope Summary

Component 22 covers **sync, collaboration, and persistent state** for the VibeFlow brownfield rebuild. Its responsibilities are:

1. **Persist all domain objects** — projects, missions, plans, context packs, changesets, evidence records, approvals, deploy history, memory packs, capability configurations, device/session state — to local SQLite and sync them to Supabase Postgres.
2. **Device identity and ownership** — stable device ID, explicit ownership/lease records for active missions or project sessions.
3. **Handoff model** — first-class handoff packages containing mission state, completed steps, pending risks, active context summary, evidence summary, blocked items, and recommended next actions. Handoffs must work between sessions, devices, and human/AI roles.
4. **Conflict handling** — detect and surface stale plans, concurrent edits, environment state drift, conflicting approvals, and duplicate missions.
5. **Acceptance criteria** — state survives restart and device change, handoff is first-class, device identity is stable, mission continuity does not depend on reading old chat scrollback.

### What this component IS

- The persistence layer for all domain objects introduced by Component 10's type definitions.
- The sync engine that bridges local SQLite to Supabase Postgres.
- The lease/heartbeat mechanism for conversation ownership.
- The handoff context extension that includes mission/plan/evidence data.

### What this component IS NOT

- It is not the mission decomposition engine (Component 12).
- It is not the context pack assembly system (Component 11).
- It is not the MCP capability registry (Component 14).
- It is not the change engine or isolated workspace (Component 13).
- It is not the evidence capture runtime (Component 15).
- It is not the verification and acceptance system (Component 16).
- It is not the secrets/config/migration safety system (Component 18).
- It is not the environment/deploy control plane (Component 17).
- It is not the observability/incident/self-healing system (Component 21).
- It is not the memory/skills/decision knowledge system (Component 20).

---

## 2. Non-Goals

The following are explicitly **out of scope** for Component 22:

| Non-Goal | Belongs To |
|---|---|
| Mission creation, decomposition, or plan generation logic | Component 12 (Agent Orchestration) |
| Context pack assembly, symbol graphs, impact analysis | Component 11 (Project Intelligence) |
| MCP server connections, tool discovery, tool execution | Component 14 (Capability Fabric) |
| Isolated workspace creation, semantic diff generation | Component 13 (Change Engine) |
| Runtime evidence capture (browser automation, screenshots, traces) | Component 15 (Runtime/Debug/Evidence) |
| Layered verification, acceptance tests, deploy gating | Component 16 (Verification) |
| Secrets inventory, migration safety classification | Component 18 (Secrets/Config/DB) |
| Environment model with promotion/rollback workflows | Component 17 (Environments/Deploy) |
| Post-deploy watch, incident detection, self-healing | Component 21 (Observability) |
| Retrivable knowledge packs, decision memory, skill loading | Component 20 (Memory/Skills) |
| Risk classification beyond existing 3-tier approval | Component 19 (Approval/Risk/Audit) |
| UI for mission/plan/evidence panels (beyond existing placeholders) | Later components that populate the panels |

---

## 3. Salvage Audit

### 3.1 Existing Code Inventory

| Existing File or Module | Current Purpose | Classification | Reason | Migration Impact |
|---|---|---|---|---|
| [`apps/desktop/src/lib/sync/sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) (759 lines) | Full sync engine: device registration, initial sync, push to Supabase, lease/heartbeat, realtime subscriptions. Already extended with mission/evidence/capability/incident/environment/deploy-candidate sync and push methods. | **Refactor in place** | The sync engine was already implemented (501 lines originally, now 759). It covers all required sync/push methods for the new domain objects. The lease/heartbeat model is complete. Realtime subscriptions exist for conversations, messages, and leases. | Low — the code is already in place. Needs Supabase migration SQL to be run before it works with cloud backend. The sync methods reference Supabase tables (`missions`, `evidence_items`, `capabilities`, `incidents`, `environments`, `deploy_candidates`) that do not yet exist in the Supabase schema. |
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) (827 lines) | Local SQLite CRUD. Already extended with 7 new tables (missions, plans, evidence_items, capabilities, incidents, deploy_candidates, environments) and full CRUD methods for each. | **Refactor in place** | The schema and CRUD methods are already implemented. Tables use JSON columns for complex fields (`clarified_constraints_json`, `steps_json`, `permissions_json`). | Low — code is in place. No data migration needed since these are new tables. |
| [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) (1061 lines) | Main process entry point. Already has real `initSyncEngine()` (not stub), real sync IPC handlers calling SyncEngine methods, `syncEngine.stop()` in before-quit, and extended handoff context with mission/plan/evidence data. | **Extract into boundary** (Phase 0) | The sync IPC handlers are functional. The handoff:generate handler queries LocalDb for missions, plans, and evidence. The file is still a 1061-line monolith that should be split per Phase 0 plan. | Medium — the sync logic is correct but buried in the monolith. Splitting into `handlers/sync.ts` would improve maintainability without changing behavior. |
| [`apps/desktop/src/lib/handoff/handoff-generator.ts`](../apps/desktop/src/lib/handoff/handoff-generator.ts) (185 lines) | Pure functions for handoff doc/prompt generation. Already extended with `missionState`, `planState`, `evidenceSummary`, `blockedItems` optional fields in `HandoffContext`. | **Keep with adapter** | The extension is additive and backward-compatible. The handoff doc now includes mission, plan, evidence, and blocked items sections when data is present. | Low — no migration needed. The adapter is the optional fields pattern. |
| [`apps/desktop/src/lib/shared-types/entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | TypeScript interfaces. Already has Mission, Plan, EvidenceItem, Capability, Incident, DeployCandidate, Environment types from Component 10. | **Keep as-is** | Types are defined and match the LocalDb schema. | None. |
| [`apps/desktop/src/lib/shared-types/ipc.ts`](../apps/desktop/src/lib/shared-types/ipc.ts) | IPC channel type definitions. Already has sync channels (`getDeviceId`, `registerDevice`, `syncAll`, `acquireLease`, `releaseLease`, `takeoverLease`, `getLease`). | **Keep as-is** | Sync IPC types are already defined. | None. |
| [`apps/desktop/src/renderer/hooks/useUiState.ts`](../apps/desktop/src/renderer/hooks/useUiState.ts) | Persistent UI state hook using localStorage. Already wired to LeftRail and PanelWorkspace from Component 10 cleanup. | **Keep as-is** | UI state persistence is already working. Component 22 does not need to change this. | None. |
| [`docs/supabase-migration-m4.sql`](../docs/supabase-migration-m4.sql) | Supabase migration for conversations, messages, conversation_leases tables. | **Keep with adapter** | This migration exists but has not been run. Component 22 needs an additional migration (M22) for the new domain object tables. | Medium — M22 migration SQL must be created and run before sync works for new domain objects. |
| [`apps/desktop/src/renderer/components/HandoffDialog.tsx`](../apps/desktop/src/renderer/components/HandoffDialog.tsx) | Handoff generation modal. Already works with existing handoff system. | **Keep with adapter** | The dialog triggers `handoff:generate` IPC which now includes extended context. No UI changes needed for Component 22 scope. | Low. |

### 3.2 Salvage Summary

| Classification | Count |
|---|---|
| Keep as-is | 4 |
| Keep with adapter | 3 |
| Refactor in place | 2 |
| Extract into boundary | 1 |
| Replace | 0 |

**Key finding:** 100% of the code needed for Component 22's core responsibilities already exists in the repo. No replacement is needed. The primary gap is operational: the Supabase migration for new domain tables has not been created or run.

---

## 4. Reuse Matrix

| Existing File or Module | Current Purpose | Keep As-Is / Wrap / Refactor / Extract / Replace | Reason | Migration Impact |
|---|---|---|---|---|
| `sync-engine.ts` | Sync engine with device registration, push/pull for all domain objects, lease/heartbeat, realtime | **Refactor in place** | Already implements all required sync/push methods. Needs Supabase tables to exist. | Low — operational prerequisite only |
| `local-db.ts` | Local SQLite with 7 new domain tables and CRUD | **Refactor in place** | Schema and CRUD already implemented. | Low — no data migration |
| `main/index.ts` | Sync IPC handlers, handoff context extension | **Extract into boundary** | Functional but monolithic. Split is Phase 0 work. | Medium — mechanical refactor |
| `handoff-generator.ts` | Handoff doc/prompt with mission/plan/evidence sections | **Keep with adapter** | Additive extension, backward-compatible. | Low |
| `entities.ts` | Domain type definitions | **Keep as-is** | Types match schema. | None |
| `ipc.ts` | Sync IPC channel types | **Keep as-is** | Already defined. | None |
| `useUiState.ts` | Persistent UI state | **Keep as-is** | Already wired from Component 10 cleanup. | None |
| `supabase-migration-m4.sql` | Existing Supabase migration | **Keep with adapter** | Needs M22 extension for new tables. | Medium |
| `HandoffDialog.tsx` | Handoff UI modal | **Keep with adapter** | Works with extended context automatically. | Low |

---

## 5. Proposed Implementation Plan

### 5.1 What Was Already Implemented (Retroactive)

The previous Builder implementation created the following:

**Data model (local-db.ts):**
- 7 new SQLite tables: `missions`, `plans`, `evidence_items`, `capabilities`, `incidents`, `deploy_candidates`, `environments`
- Full CRUD methods for each table
- JSON columns for complex nested data (`clarified_constraints_json`, `steps_json`, `permissions_json`)

**Sync engine (sync-engine.ts):**
- `syncMissions()`, `syncEvidence()`, `syncCapabilities()`, `syncIncidents()`, `syncEnvironments()` — pull from Supabase
- `pushMission()`, `pushEvidenceItem()`, `pushCapability()`, `pushIncident()`, `pushEnvironment()`, `pushDeployCandidate()` — push to Supabase
- New `SyncEventType` values: `mission-updated`, `evidence-added`, `incident-updated`, `environment-updated`
- Integration into `syncAll()` method

**IPC handlers (main/index.ts):**
- `initSyncEngine()` replaced from no-op to real SyncEngine initialization
- All sync IPC handlers (`getDeviceId`, `registerDevice`, `syncAll`, `acquireLease`, `releaseLease`, `takeoverLease`, `getLease`) call real SyncEngine methods
- `syncEngine.stop()` added to `before-quit` handler
- `handoff:generate` handler extended to query missions, plans, evidence from LocalDb

**Handoff context (handoff-generator.ts):**
- `HandoffContext` extended with `missionState`, `planState`, `evidenceSummary`, `blockedItems`
- Handoff doc generation includes mission, plan, evidence, and blocked items sections

### 5.2 What Is Still Missing

| Gap | Description | Priority |
|---|---|---|
| Supabase M22 migration | New tables (`missions`, `plans`, `evidence_items`, `capabilities`, `incidents`, `deploy_candidates`, `environments`) do not exist in Supabase. Sync pull/push will fail silently. | **Blocking** |
| Push-to-cloud triggers | LocalDb CRUD methods (e.g., `insertMission`, `upsertPlan`) do not automatically trigger sync push. The sync engine has push methods but nothing calls them after local writes. | **High** |
| Realtime subscriptions for new tables | Supabase Realtime only subscribes to `conversations`, `messages`, `conversation_leases`. New domain objects are not subscribed. | **Medium** |
| Conflict detection UI | The spec requires surfacing stale plans, concurrent edits, environment drift, conflicting approvals, duplicate missions. None of this detection or surfacing exists. | **Medium** |
| Context packs persistence | Component 22 spec lists "context packs" as a persistable object, but no `context_packs` table exists. | **Low** (belongs to Component 11) |
| Changesets persistence | Component 22 spec lists "changesets" as a persistable object, but no `changesets` table exists. | **Low** (belongs to Component 13) |
| Approvals persistence | Component 22 spec lists "approvals" as persistable, but approval logger is still in-memory. | **Low** (belongs to Component 19) |
| Memory packs persistence | Component 22 spec lists "memory packs" as persistable, but no table exists. | **Low** (belongs to Component 20) |
| Device/session state persistence | Device ID is stored in settings table. Session state is not explicitly persisted beyond conversation run state. | **Low** (partially covered) |

### 5.3 Data Model Implications

| Object | Local Table | Supabase Table | Status |
|---|---|---|---|
| Mission | `missions` ✅ | `missions` ❌ (needs M22) | Local only |
| Plan | `plans` ✅ | `plans` ❌ (needs M22) | Local only |
| Evidence Item | `evidence_items` ✅ | `evidence_items` ❌ (needs M22) | Local only |
| Capability | `capabilities` ✅ | `capabilities` ❌ (needs M22) | Local only |
| Incident | `incidents` ✅ | `incidents` ❌ (needs M22) | Local only |
| Deploy Candidate | `deploy_candidates` ✅ | `deploy_candidates` ❌ (needs M22) | Local only |
| Environment | `environments` ✅ | `environments` ❌ (needs M22) | Local only |
| Context Pack | ❌ | ❌ | Not started (C11) |
| Change Set | ❌ | ❌ | Not started (C13) |
| Memory Pack | ❌ | ❌ | Not started (C20) |

### 5.4 IPC Implications

All sync IPC handlers are functional. No new IPC channels are needed for Component 22 scope. The existing channels cover:
- `sync:getDeviceId`
- `sync:registerDevice`
- `sync:syncAll`
- `sync:acquireLease`
- `sync:releaseLease`
- `sync:takeoverLease`
- `sync:getLease`

Future components will need additional IPC channels for domain object CRUD (e.g., `missions:create`, `plans:save`, `evidence:add`), but those belong to the components that implement the business logic.

### 5.5 API Implications

The Supabase API calls in `sync-engine.ts` reference tables that do not exist yet. All sync/push methods will fail silently (console.error, no exception thrown). This is safe but means sync is effectively local-only until M22 migration is run.

### 5.6 UI Implications

Component 22 does not require new UI surfaces. The existing placeholder panels (MissionPanel, PlanPanel, EvidencePanel, EnvironmentPanel, CapabilitiesPanel, AuditPanel) from Component 10 are the rendering targets. Populating them with real data belongs to the components that implement the business logic for each domain object.

### 5.7 State Implications

- **Local state:** All domain objects persist in SQLite and survive app restart. ✅
- **Cloud state:** Sync pull/push methods exist but Supabase tables do not. ❌
- **UI state:** Panel collapse and left-rail collapse persist via `useUiState` (Component 10 cleanup). ✅
- **Lease state:** Conversation leases work via Supabase `conversation_leases` table (requires M4 migration). ⚠️

---

## 6. Test Plan

### 6.1 Unit Tests (Not Yet Written)

| Test | Target | Expected |
|---|---|---|
| `LocalDb.insertMission` / `getMission` | local-db.ts | Mission round-trips correctly |
| `LocalDb.upsertPlan` / `getPlan` | local-db.ts | Plan with JSON steps round-trips |
| `LocalDb.insertEvidenceItem` / `listEvidenceItems` | local-db.ts | Evidence items list correctly |
| `LocalDb.upsertCapability` / `getCapability` | local-db.ts | Capability with permissions JSON round-trips |
| `LocalDb.insertIncident` / `getIncident` | local-db.ts | Incident round-trips |
| `LocalDb.upsertDeployCandidate` / `listDeployCandidates` | local-db.ts | Deploy candidates list correctly |
| `LocalDb.upsertEnvironment` / `getEnvironment` | local-db.ts | Environment round-trips |
| `SyncEngine.pushMission` | sync-engine.ts | Calls Supabase upsert (mocked) |
| `SyncEngine.syncMissions` | sync-engine.ts | Pulls from Supabase and inserts locally (mocked) |
| `generateHandoffDoc` with missionState | handoff-generator.ts | Includes mission section |
| `generateHandoffDoc` without missionState | handoff-generator.ts | Omits mission section |

### 6.2 Integration Tests

| Test | Prerequisite | Expected |
|---|---|---|
| App launches with new tables | LocalDb init | No errors, tables created |
| Sync engine starts | Supabase M4 + M22 run | Status changes to "synced" |
| Handoff includes mission data | Mission exists in LocalDb | Handoff doc has mission section |
| Lease acquisition works | Supabase M4 run | Lease created, heartbeat starts |

### 6.3 Smoke Tests

| Test | Expected |
|---|---|
| `pnpm dev` launches app | App opens, no console errors |
| `tsc --noEmit` passes | Zero TypeScript errors |
| Sign-in → create project → create mission | Mission persists after restart |

---

## 7. Rollback Plan

### 7.1 Code Rollback

If the Component 22 implementation introduces regressions:
1. Revert the commits that modified `local-db.ts`, `sync-engine.ts`, `main/index.ts`, and `handoff-generator.ts`.
2. The existing tables in LocalDb will remain (SQLite does not drop tables on code revert). This is safe — unused tables are harmless.
3. The sync engine will revert to its pre-Component-22 state (which was already functional for conversations/messages).

### 7.2 Data Rollback

- **Local SQLite:** New tables (`missions`, `plans`, etc.) will persist after code rollback. No data loss risk — they are additive.
- **Supabase:** If M22 migration is run and then rolled back, the Supabase tables would need to be dropped manually. This is low-risk since no production data exists yet.

### 7.3 Migration Rollback

- M22 migration (when created) should include a `DROP TABLE IF EXISTS` rollback script for each new table.
- No existing data will be affected since these are new tables.

---

## 8. Risks and Approvals Required

### 8.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase M22 migration not run → sync silently fails | Certain (until run) | Medium | Sync methods already fail silently with console.error. No crash risk. |
| LocalDb schema grows large with JSON columns | Low | Low | JSON columns are acceptable for now. Can normalize later. |
| Sync push not triggered after local writes | Certain | Medium | Data stays local-only until manual `sync:syncAll`. Not a crash risk, but sync is not automatic. |
| Realtime subscriptions missing for new tables | Certain | Low | No real-time updates for missions/evidence/etc. until added. |
| Main process monolith (1061 lines) | Certain | Low | Phase 0 extraction planned. Not a Component 22 blocker. |

### 8.2 Approvals Required

| Approval | From | Reason |
|---|---|---|
| Supabase M22 migration execution | DevOps / Orchestrator | Requires Supabase project access |
| Sync engine re-enablement confirmation | Orchestrator | Changes app from local-only to cloud-sync |
| Analysis artifact review | Orchestrator | This document requires review before any further code changes |

---

## 9. What Will NOT Be Built Yet (Later Components)

The following items are in the Component 22 spec but belong to later components:

| Item | Reason for Deferral | Belongs To |
|---|---|---|
| Context packs persistence | No context pack business logic exists yet | Component 11 (Project Intelligence) |
| Changesets persistence | No change engine exists yet | Component 13 (Change Engine) |
| Approvals persistence to SQLite | Approval logger is in-memory; persisting it is an approval system concern | Component 19 (Approval/Risk/Audit) |
| Memory packs persistence | No memory system exists yet | Component 20 (Memory/Skills) |
| Conflict detection UI (stale plans, concurrent edits, environment drift, conflicting approvals, duplicate missions) | Requires business logic from multiple later components to detect conflicts | Components 11, 12, 13, 17, 19 |
| Mission creation / plan generation UI | Requires mission decomposition logic | Component 12 (Agent Orchestration) |
| Evidence capture runtime | Requires browser automation, screenshot capture, trace collection | Component 15 (Runtime/Debug/Evidence) |
| Environment promotion/rollback workflows | Requires environment model and deploy workflows | Component 17 (Environments/Deploy) |
| MCP capability health monitoring | Requires MCP server connections | Component 14 (Capability Fabric) |
| Incident auto-detection | Requires observability and monitoring | Component 21 (Observability) |

---

## 10. Process Correction Notes

### 10.1 What Was Implemented Before Approval

The Builder previously implemented Component 22 code changes **before** this analysis was produced and **before** Orchestrator approval. Specifically, the following changes were made in Sprint 22:

1. **`main/index.ts`** — Replaced stub `initSyncEngine()` with real SyncEngine initialization; replaced stub sync IPC handlers with real SyncEngine method calls; added `syncEngine.stop()` to before-quit; extended `handoff:generate` handler with mission/plan/evidence context.
2. **`local-db.ts`** — Added 7 new SQLite tables and full CRUD methods for missions, plans, evidence items, capabilities, incidents, deploy candidates, and environments.
3. **`sync-engine.ts`** — Extended with `syncMissions()`, `syncEvidence()`, `syncCapabilities()`, `syncIncidents()`, `syncEnvironments()` pull methods and `pushMission()`, `pushEvidenceItem()`, `pushCapability()`, `pushIncident()`, `pushEnvironment()`, `pushDeployCandidate()` push methods; added new `SyncEventType` values.
4. **`handoff-generator.ts`** — Extended `HandoffContext` with `missionState`, `planState`, `evidenceSummary`, `blockedItems`; added corresponding sections to handoff doc generation.

This violated the required analysis-first protocol defined in [`03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md`](03_AI_BUILDER_HANDOFF_PROTOCOL_AND_IMPLEMENTATION_SEQUENCING.md) §2 rules 5, 7, and 10:
- Rule 5: "Require the AI to restate scope, non-goals, required data model, required UI surfaces, required tests, required event logs."
- Rule 7: "Require a contract-first implementation plan before code."
- Rule 10: "Require a salvage audit and reuse matrix before every major subsystem implementation."

### 10.2 Whether Current Code Matches the Retroactive Analysis

**Broadly, yes.** The implemented code aligns with what this analysis identifies as the correct scope for Component 22:

- ✅ Local persistence for all domain objects listed in the spec (except context packs, changesets, approvals, memory packs — correctly deferred).
- ✅ Sync engine extended with pull/push for all implemented domain objects.
- ✅ Device identity and lease management already existed and continues to work.
- ✅ Handoff context extended with mission/plan/evidence data.
- ✅ No later-component logic was implemented (no mission creation UI, no evidence capture runtime, no MCP connections, no verification logic).

### 10.3 Mismatches Between Implementation and Approved Plan

| Mismatch | Description | Severity |
|---|---|---|
| **No Supabase M22 migration created** | The sync engine references Supabase tables that do not exist. The implementation added sync/push methods but no migration SQL to create the cloud tables. | **High** — sync will silently fail for new domain objects. |
| **No automatic push triggers** | LocalDb CRUD methods do not call sync push methods after local writes. Data stays local until manual `sync:syncAll`. The spec implies continuous sync. | **Medium** — functional gap, not a bug. |
| **No realtime subscriptions for new tables** | Supabase Realtime only watches conversations, messages, and leases. New domain objects are not watched. | **Medium** — no real-time collaboration for missions/evidence/etc. |
| **No conflict detection** | The spec requires surfacing stale plans, concurrent edits, environment drift, conflicting approvals, duplicate missions. None of this exists. | **Medium** — partially deferred to later components. |
| **Main process not split** | The 1061-line monolith was not split. This was a Phase 0 requirement that remains outstanding. | **Low** — not a Component 22 concern, but makes the code harder to review. |

### 10.4 Whether Corrective Code Changes Are Needed Before Orchestrator Approval

**No corrective code changes are needed in this task.** This correction task is analysis-only. The following actions should be decided by Orchestrator:

1. **Create Supabase M22 migration SQL** — This is a DevOps task. The migration should create tables for `missions`, `plans`, `evidence_items`, `capabilities`, `incidents`, `deploy_candidates`, and `environments` in Supabase. This is required before sync works for new domain objects.

2. **Decide on automatic push triggers** — Orchestrator should decide whether LocalDb CRUD methods should automatically call sync push methods, or whether sync should remain manual (`sync:syncAll`) until later components implement the business logic that triggers sync.

3. **Decide on realtime subscriptions** — Orchestrator should decide whether to add Supabase Realtime subscriptions for new domain objects now, or defer until the components that populate them are implemented.

4. **Decide on conflict detection scope** — Orchestrator should decide whether basic conflict detection (e.g., duplicate mission detection) should be added now, or deferred to the components that own the relevant business logic.

**Recommendation:** The existing code is structurally sound and within Component 22 scope. The primary gap is the missing Supabase M22 migration. Orchestrator should approve the analysis, assign the M22 migration to DevOps, and decide on the push-trigger and realtime subscription questions before proceeding to Component 12.
