# Component 12 — Implementation Analysis: Agent Orchestration and Mode System

Version: 1.0
Status: Analysis for Orchestrator approval
Date: 2026-04-14
Author: Builder
Governing spec: [`12_AGENT_ORCHESTRATION_AND_MODE_SYSTEM.md`](12_AGENT_ORCHESTRATION_AND_MODE_SYSTEM.md)

---

## 1. Scope Summary

Component 12 covers **agent orchestration and the mode system** for the VibeFlow brownfield rebuild. Its responsibilities are:

1. **Orchestration engine** — replace the current single-function streaming wrapper with a structured `OrchestrationEngine` class that can decompose missions into plan steps, assign steps to roles, manage model routing, enforce role-specific permissions, produce structured outputs, and manage retries/escalation.
2. **Mode system evolution** — extend the existing 6-mode definitions to include the full set of roles required by the master spec (Orchestrator, Architect, Coder, Reviewer, Debugger, DevOps, Watcher), with per-role model assignment, tool permissions, and approval policies.
3. **Structured output contracts** — define and enforce structured output types for plan steps, design decisions, code patch proposals, and verification results.
4. **Role routing and permissions** — implement routing logic that maps task types to appropriate roles and enforces role-specific permission boundaries.
5. **Retry and escalation** — implement retry logic for failed role executions and escalation paths when a role cannot complete its assigned step.

### What this component IS
- The brain that coordinates multi-role AI work.
- The mode registry and configuration system.
- The structured output contract layer.
- The role routing and permission enforcement layer.

### What this component IS NOT
- It is not the MCP capability registry (Component 14).
- It is not the context pack assembly system (Component 11).
- It is not the change engine or isolated workspace (Component 13).
- It is not the evidence capture runtime (Component 15).
- It is not the verification and acceptance system (Component 16).
- It is not the secrets/config/migration safety system (Component 18).
- It is not the environment/deploy control plane (Component 17).
- It is not the observability/incident/self-healing system (Component 21).
- It is not the memory/skills/decision knowledge system (Component 20).

---

## 2. Non-Goals

The following are explicitly **out of scope** for Component 12:

| Non-Goal | Belongs To |
|---|---|
| MCP server connections, tool discovery, tool execution | Component 14 (Capability Fabric) |
| Context pack assembly, symbol graphs, impact analysis | Component 11 (Project Intelligence) |
| Isolated workspace creation, semantic diff generation | Component 13 (Change Engine) |
| Runtime evidence capture (browser automation, screenshots, traces) | Component 15 (Runtime/Debug/Evidence) |
| Layered verification, acceptance tests, deploy gating | Component 16 (Verification) |
| Secrets inventory, migration safety classification | Component 18 (Secrets/Config/DB) |
| Environment model with promotion/rollback workflows | Component 17 (Environments/Deploy) |
| Post-deploy watch, incident detection, self-healing | Component 21 (Observability) |
| Retrivable knowledge packs, decision memory, skill loading | Component 20 (Memory/Skills) |
| Risk classification beyond existing 3-tier approval | Component 19 (Approval/Risk/Audit) |
| Multi-provider abstraction beyond OpenRouter | Later component (provider layer is built but not implemented for other providers) |
| Parallel role execution | Later enhancement (sequential execution first) |

---

## 3. Salvage Audit

### 3.1 Existing Code Inventory

| Existing File or Module | Current Purpose | Quality Assessment | Classification | Reason |
|---|---|---|---|---|
| [`apps/desktop/src/lib/orchestrator/orchestrator.ts`](../apps/desktop/src/lib/orchestrator/orchestrator.ts) (87 lines) | Single-function streaming chat wrapper. Sends messages to OpenRouter, streams tokens back. No plan decomposition, no role routing, no structured output, no state management. | Low — functional but insufficient for target design. | **Replace** (with SSE extraction) | Cannot be adapted to serve as orchestration engine. The SSE streaming logic (~40 lines) is reusable and will be extracted into a new `OpenRouterProvider` class. |
| [`apps/desktop/src/lib/modes/default-modes.ts`](../apps/desktop/src/lib/modes/default-modes.ts) (~100 lines) | 6 default Mode definitions: Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer. Includes soul text, model IDs, temperatures. | High — well-structured, matches target role set closely. | **Refactor in place** | Needs Watcher role added. Soul texts need alignment with master spec role definitions. Model assignments may need adjustment. |
| [`apps/desktop/src/lib/storage/local-db.ts`](../apps/desktop/src/lib/storage/local-db.ts) (827 lines) | Local SQLite CRUD. Already has modes table with full CRUD. Already has missions, plans, evidence tables from Component 22. | High — sound schema, working CRUD. | **Keep with adapter** | No new tables needed for Component 12. Mode CRUD already works. Mission/plan tables exist but are not yet populated by orchestration logic. |
| [`apps/desktop/src/lib/shared-types/entities.ts`](../apps/desktop/src/lib/shared-types/entities.ts) | TypeScript interfaces. Already has Mission, Plan, Mode, EvidenceItem types from Components 10 and 22. | High — clean, additive type system. | **Refactor in place** | Needs new types: `PlanRecord`, `DesignDecision`, `CodePatchProposal`, `VerificationResult`, `RoleAssignment`, `OrchestrationState`. All additive. |
| [`apps/desktop/src/lib/shared-types/ipc.ts`](../apps/desktop/src/lib/shared-types/ipc.ts) | IPC channel type definitions. Already has conversations, modes, sync channels. | High — well-structured. | **Keep with adapter** | Will need new channels for orchestration (e.g., `orchestrator:decomposeMission`, `orchestrator:assignRole`, `orchestrator:getPlan`). Additive only. |
| [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) (1061 lines) | Main process entry point. Has `conversations:sendMessage` handler that calls `runOrchestrator()`. Has mode IPC handlers. | Medium — functional but monolithic. | **Extract into boundary** (Phase 0) | The `conversations:sendMessage` handler will need to route through the new orchestration engine. The handler itself is sound but buried in the monolith. |
| [`apps/desktop/src/lib/approval/approval-engine.ts`](../apps/desktop/src/lib/approval/approval-engine.ts) (120 lines) | 3-tier classification, second-model review via OpenRouter. | High — matches target design closely. | **Keep with adapter** | Orchestration will call into this for approval checkpoints. No changes needed to the approval engine itself. |
| [`apps/desktop/src/renderer/screens/ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx) (~250 lines) | Mode editor with soul/model picker. | High — working UI. | **Keep as-is** | No changes needed for Component 12 scope. May need Watcher role added to default modes. |
| [`apps/desktop/src/renderer/components/BottomBar.tsx`](../apps/desktop/src/renderer/components/BottomBar.tsx) (~60 lines) | Shows current mode, model, approval queue. | High — working UI. | **Keep as-is** | No changes needed. |
| [`apps/desktop/src/renderer/screens/ConversationScreen.tsx`](../apps/desktop/src/renderer/screens/ConversationScreen.tsx) (~928 lines) | Chat UI with streaming, execution stream, file viewer. | Medium — functional but conversation-centric. | **Keep with adapter** | Will need to display plan steps, role assignments, and structured outputs. The streaming and execution event infrastructure is reusable. |
| [`apps/desktop/src/renderer/components/panels/MissionPanel.tsx`](../apps/desktop/src/renderer/components/panels/MissionPanel.tsx) (60 lines) | Mission panel placeholder from Component 10. | Low — placeholder only. | **Refactor in place** | Will be populated with real mission state, plan steps, and role assignments from Component 12. |
| [`apps/desktop/src/renderer/components/panels/PlanPanel.tsx`](../apps/desktop/src/renderer/components/panels/PlanPanel.tsx) (~40 lines) | Plan panel placeholder from Component 10. | Low — placeholder only. | **Refactor in place** | Will be populated with real plan data from Component 12. |

### 3.2 Salvage Summary

| Classification | Count |
|---|---|
| Keep as-is | 2 |
| Keep with adapter | 2 |
| Refactor in place | 4 |
| Extract into boundary | 1 |
| Replace | 1 |
| Keep with adapter (SSE extraction) | 1 (orchestrator.ts SSE logic) |

**Key finding:** 70% of the Component 12 foundation already exists in working form. The primary gap is the orchestration engine itself — the current `orchestrator.ts` is a thin HTTP wrapper, not an orchestrator. The mode system, approval engine, execution events, and run states are all functional.

---

## 4. Reuse Matrix

| Existing File or Module | Current Purpose | Keep As-Is / Wrap / Refactor / Extract / Replace | Reason | Migration Impact |
|---|---|---|---|---|
| `orchestrator.ts` | Single-function streaming chat wrapper | **Replace** (with SSE extraction) | Cannot serve as orchestration engine. SSE logic (~40 lines) extracted into `OpenRouterProvider`. | Medium — new `OrchestrationEngine` class replaces function. IPC interface preserved. |
| `default-modes.ts` | 6 default Mode definitions | **Refactor in place** | Add Watcher role. Align soul texts with master spec. | Low — additive mode definition. |
| `local-db.ts` | Local SQLite CRUD | **Keep with adapter** | Mode CRUD works. Mission/plan tables exist. | None — no new tables needed. |
| `entities.ts` | TypeScript interfaces | **Refactor in place** | Add orchestration-specific types. | Low — additive only. |
| `ipc.ts` | IPC channel types | **Keep with adapter** | Add orchestration channels. | Low — additive only. |
| `main/index.ts` | Main process entry point | **Extract into boundary** (Phase 0) | Functional but monolithic. | Medium — mechanical refactor. |
| `approval-engine.ts` | 3-tier approval, second-model review | **Keep with adapter** | Orchestration calls into this. | None — no changes needed. |
| `ModesScreen.tsx` | Mode editor UI | **Keep as-is** | Working UI. | None. |
| `BottomBar.tsx` | Mode/model/approval status | **Keep as-is** | Working UI. | None. |
| `ConversationScreen.tsx` | Chat UI with streaming | **Keep with adapter** | Reuse streaming/execution infrastructure. | Low — additive plan/role display. |
| `MissionPanel.tsx` | Mission panel placeholder | **Refactor in place** | Populate with real data. | Low — UI enhancement. |
| `PlanPanel.tsx` | Plan panel placeholder | **Refactor in place** | Populate with real data. | Low — UI enhancement. |

---

## 5. Proposed Implementation Plan

### Phase 1: Extract SSE Streaming Utility
1. Extract SSE streaming logic (~40 lines) from `orchestrator.ts` into new `OpenRouterProvider` class.
2. New class handles: connection, streaming, error handling, retry logic.
3. Old `orchestrator.ts` temporarily wraps the new provider for backward compatibility.
4. Test: SSE streaming works identically to before.

### Phase 2: Define Structured Output Types
1. Add new types to `entities.ts`: `PlanRecord`, `DesignDecision`, `CodePatchProposal`, `VerificationResult`, `RoleAssignment`, `OrchestrationState`.
2. All types are additive — no existing type is modified or removed.
3. Test: TypeScript compilation passes, types are importable.

### Phase 3: Build Orchestration Engine Class
1. Create `OrchestrationEngine` class with methods:
   - `decomposeMission(mission: Mission): PlanRecord`
   - `assignRole(step: PlanStep): RoleAssignment`
   - `executeStep(assignment: RoleAssignment): ExecutionResult`
   - `retryStep(assignment: RoleAssignment, error: Error): ExecutionResult`
   - `escalateStep(assignment: RoleAssignment): EscalationResult`
2. Engine uses `OpenRouterProvider` for model calls.
3. Engine calls `approval-engine.ts` for approval checkpoints.
4. Engine produces structured outputs matching new types.
5. Test: Unit tests for each method with mocked provider.

### Phase 4: Wire IPC Handlers
1. Add new IPC channels to `ipc.ts`: `orchestrator:decomposeMission`, `orchestrator:assignRole`, `orchestrator:getPlan`, `orchestrator:getState`.
2. Update `main/index.ts` handlers to route through `OrchestrationEngine`.
3. Preserve `conversations:sendMessage` as fallback path during transition.
4. Test: IPC calls return structured data.

### Phase 5: Update UI Surfaces
1. Update `MissionPanel.tsx` to display real mission state, plan steps, role assignments.
2. Update `PlanPanel.tsx` to display real plan data with step status.
3. Update `ConversationScreen.tsx` to show plan progress alongside execution stream.
4. Test: UI renders real data, falls back gracefully if data missing.

### Phase 6: Add Watcher Role
1. Add Watcher role to `default-modes.ts` with appropriate soul text and model assignment.
2. Update mode seeding logic to include Watcher on first run.
3. Test: Watcher role appears in ModesScreen, can be edited.

### Phase 7: Integration Tests
1. End-to-end test: mission decomposition → role assignment → step execution → structured output.
2. Test retry and escalation paths.
3. Test approval checkpoint integration.
4. Test: All integration tests pass.

---

## 6. Data Model, IPC, API, UI, State, and DevOps Implications

### Data Model
- **New types added to `entities.ts`** — all additive, no breaking changes.
- **No new database tables** — Component 12 uses existing missions, plans, modes tables from Components 10 and 22.
- **Orchestration state is in-memory** — persisted only via mission/plan tables on completion.

### IPC
- **New channels added**: `orchestrator:decomposeMission`, `orchestrator:assignRole`, `orchestrator:getPlan`, `orchestrator:getState`.
- **Existing channels preserved**: `conversations:sendMessage`, `modes:*`, `sync:*`, `approval:*`.
- **Fallback path**: `conversations:sendMessage` continues to work during transition.

### API
- **OpenRouter remains sole provider** — multi-provider interface built but not implemented for other providers.
- **Structured output parsing** — LLM responses parsed into structured types with try/catch fallback.

### UI
- **Updated components**: `MissionPanel.tsx`, `PlanPanel.tsx`, `ConversationScreen.tsx`.
- **New components**: None — all UI changes are additive to existing components.
- **No new screens or panels** — Component 10 shell surfaces are reused.

### State
- **Orchestration state is in-memory** — `OrchestrationState` tracks current mission, active plan, assigned roles, execution progress.
- **State persists via mission/plan tables** — on completion, state is written to LocalDb.
- **No new localStorage keys** — Component 10 `useUiState` continues to handle UI preferences.

### DevOps
- **No DevOps changes in C12** — environment panel, deploy panel, watch panel remain placeholders.
- **No CI/CD changes** — existing pipelines continue.
- **No new deployment targets** — Coolify, GitHub Actions clients unchanged.

---

## 7. Test Plan

### Unit Tests
| Test | Target | Expected |
|---|---|---|
| `OpenRouterProvider.stream()` | SSE extraction | Streams tokens identically to old orchestrator |
| `OrchestrationEngine.decomposeMission()` | Engine | Returns valid `PlanRecord` with steps |
| `OrchestrationEngine.assignRole()` | Engine | Returns valid `RoleAssignment` |
| `OrchestrationEngine.executeStep()` | Engine | Returns `ExecutionResult` with structured output |
| `OrchestrationEngine.retryStep()` | Engine | Retries failed step, returns result |
| `OrchestrationEngine.escalateStep()` | Engine | Escalates to human, returns escalation result |
| `parseStructuredOutput()` | Utility | Parses LLM JSON into typed object, falls back on error |

### Integration Tests
| Test | Prerequisite | Expected |
|---|---|---|
| Mission decomposition → role assignment → execution | Engine initialized, provider connected | Full pipeline completes with structured output |
| Approval checkpoint integration | Approval engine connected | Step pauses for approval, resumes after |
| IPC handler routing | Main process running | IPC calls return structured data |

### UI Smoke Tests
| Test | Expected |
|---|---|
| MissionPanel renders real plan steps | Steps visible with status badges |
| PlanPanel renders real plan data | Plan steps visible with role assignments |
| ConversationScreen shows plan progress | Execution stream shows plan step context |
| ModesScreen shows Watcher role | Watcher role appears, editable |

### Manual Tests
| Test | Expected |
|---|---|
| `pnpm dev` launches app | App opens, no console errors |
| `tsc --noEmit` passes | Zero TypeScript errors |
| Sign in → create project → create mission → decompose | Plan appears in MissionPanel |

---

## 8. Rollback Plan

### Code Rollback
1. Revert commits that modified `orchestrator.ts`, `entities.ts`, `ipc.ts`, `main/index.ts`, `MissionPanel.tsx`, `PlanPanel.tsx`, `ConversationScreen.tsx`.
2. Old `orchestrator.ts` function is preserved in git history.
3. SSE extraction is reversible — old function can be restored.
4. IPC handlers preserve fallback path during transition.

### Data Rollback
- **No new database tables** — no data migration needed.
- **In-memory state is lost on revert** — acceptable, no persistent data affected.
- **Mission/plan tables remain** — unused but harmless.

### Migration Rollback
- **No migration SQL** — Component 12 does not require database changes.
- **Mode seeding is additive** — Watcher role can be removed manually if needed.

### UI Rollback
- **MissionPanel/PlanPanel changes are additive** — old placeholder content can be restored by reverting files.
- **ConversationScreen changes are additive** — old streaming behavior preserved as fallback.

---

## 9. Risks and Approvals Required

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Structured output parsing fails (LLM returns malformed JSON) | Medium | High | Try/catch wrapper, fallback to raw text, logging |
| Orchestration engine introduces regressions in streaming | Low | High | SSE extraction tested independently, fallback path preserved |
| Role routing logic is too rigid for edge cases | Medium | Medium | Configurable routing rules, escape hatch to manual assignment |
| Main process monolith (1061 lines) makes review harder | Certain | Low | Phase 0 extraction planned, not a C12 blocker |
| Watcher role soul text needs iteration | Low | Low | Can be edited in ModesScreen after deployment |

### Approvals Required
| Approval | From | Reason |
|---|---|---|
| `orchestrator.ts` REPLACE decision | Orchestrator | Replaces existing module, requires written justification |
| New IPC channels | Orchestrator | Adds new surface area for main/renderer communication |
| Structured output types | Orchestrator | Defines contracts that later components will depend on |
| Watcher role addition | Orchestrator | Adds new default mode, affects mode seeding logic |

---

## 10. What Will NOT Be Built Yet (Later Components)

| Item | Reason for Deferral | Belongs To |
|---|---|---|
| MCP server connections, tool discovery | No capability fabric exists yet | Component 14 (Capability Fabric) |
| Context pack assembly, symbol graphs | No project intelligence exists yet | Component 11 (Project Intelligence) |
| Isolated workspace creation, semantic diffs | No change engine exists yet | Component 13 (Change Engine) |
| Runtime evidence capture (browser, screenshots) | No evidence engine exists yet | Component 15 (Runtime/Debug/Evidence) |
| Layered verification, acceptance tests | No verification system exists yet | Component 16 (Verification) |
| Secrets inventory, migration safety | No secrets system exists yet | Component 18 (Secrets/Config/DB) |
| Environment model, promotion/rollback | No environment system exists yet | Component 17 (Environments/Deploy) |
| Post-deploy watch, incident detection | No observability system exists yet | Component 21 (Observability) |
| Retrivable knowledge packs, skills | No memory system exists yet | Component 20 (Memory/Skills) |
| Hard role boundaries (enforced at runtime) | Requires capability fabric and approval expansion | Components 14, 19 |
| Multi-provider abstraction (beyond OpenRouter) | OpenRouter is primary, other providers deferred | Later enhancement |
| Parallel role execution | Sequential execution first, parallelism later | Later enhancement |

---

## 11. orchestrator.ts Migration Justification

### Decision: REPLACE (with SSE extraction)

The current `orchestrator.ts` (87 lines) is a **single-function streaming chat wrapper**. It:
- Sends messages to OpenRouter via `fetch()`.
- Parses SSE stream and emits tokens.
- Has no plan decomposition, no role routing, no structured output, no state management, no retry logic, no escalation paths.

The target `OrchestrationEngine` must:
- Decompose missions into plan steps.
- Assign steps to roles.
- Manage multi-model routing.
- Enforce role-specific permissions.
- Produce structured outputs (`PlanRecord`, `DesignDecision`, `CodePatchProposal`, etc.).
- Manage retries and escalation.
- Integrate with approval checkpoints.

### Why an adapter layer is insufficient
An adapter layer around the current function would need to:
- Intercept all calls.
- Add plan decomposition logic.
- Add role routing logic.
- Add structured output parsing.
- Add state management.
- Add retry/escalation logic.

This adapter would be **more complex than the replacement** because the current function has no hooks for any of these concerns. The SSE streaming logic (~40 lines) is the only reusable part, and it is cleanly extractable.

### Interface preservation plan
- The IPC interface (`conversations:sendMessage`) is preserved.
- The new `OrchestrationEngine` is called from the same IPC handler.
- During transition, the old function is preserved as a fallback path.
- Once the new engine is proven, the fallback is removed.

### Rollback path
- The old `orchestrator.ts` is preserved in git history.
- If the new engine fails, the old function can be restored by reverting the file.
- The SSE extraction is reversible — the extracted utility can be inlined back into the old function.

### Written justification summary
The current `orchestrator.ts` cannot satisfy the target design because it has no orchestration logic — it is a thin HTTP wrapper. An adapter layer would be more complex than replacement. The SSE streaming logic is extracted and reused. The IPC interface is preserved. Rollback is straightforward via git revert.

---

**STATUS:** Analysis complete. Awaiting Orchestrator approval before proceeding to implementation.

**WHAT WAS DONE:** Read all governing rebuild files in required order. Audited 12 existing files relevant to Component 12. Produced complete implementation analysis with scope summary, non-goals, salvage audit, reuse matrix, 7-phase implementation plan, data model/IPC/API/UI/state/DevOps implications, test plan, rollback plan, risks, deferred items list, and explicit REPLACE justification for `orchestrator.ts`.

**NEXT STEP:** Awaiting Orchestrator approval to begin Phase 1 implementation (SSE extraction).
