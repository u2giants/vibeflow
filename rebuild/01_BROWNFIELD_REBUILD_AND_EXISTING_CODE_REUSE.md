# Component 15: Brownfield Rebuild, Migration Governance, and Existing Code Reuse

## 1. Purpose

This component defines how the rebuilt VibeFlow system must be constructed on top of the existing VibeFlow repository without throwing away useful assets. It tells the AI builder that the current codebase is a source of value, not disposable scaffolding.

This spec exists to prevent the most common brownfield AI failure mode: rewriting large areas of code because a fresh design looks cleaner in the abstract.

## 2. Mandatory stance

The AI builder shall treat the existing VibeFlow repository as a brownfield asset base. It shall begin from the assumption that substantial parts of the current system should be preserved, adapted, or refactored in place.

The AI builder shall not perform a ground-up rewrite unless forced by clear technical evidence.

## 3. Objectives

The brownfield strategy has five goals:
1. preserve working code and reduce wasted effort,
2. retain product learning already embedded in the repo,
3. minimize migration risk,
4. keep the system continuously runnable during transition,
5. make it easy to audit which old parts became which new parts.

## 4. Brownfield operating model

Every major implementation step shall begin with a **salvage audit**. The salvage audit is required before any subsystem rewrite, large refactor, storage migration, navigation replacement, or connector replacement.

### Required salvage audit outputs

For the target subsystem, the AI builder must produce:
- a file inventory of relevant existing modules,
- a responsibility map of what each module currently does,
- a quality assessment of those modules,
- a classification decision for each module,
- a compatibility and migration strategy,
- a test strategy,
- a rollback strategy.

### Classification categories

Every relevant existing module must be labeled as one of:
- **Keep as-is**: already matches the target design closely enough.
- **Keep with adapter**: keep the implementation but add a new interface boundary around it.
- **Refactor in place**: preserve the module identity while improving structure internally.
- **Extract into boundary**: lift a slice of the code into a clearer service, domain, or package.
- **Replace**: retire the implementation only because responsible evolution is not practical.

## 5. Reuse matrix

Before any major component implementation starts, the AI builder must write a **reuse matrix** with at least these columns:
- current file or module,
- current responsibility,
- target component alignment,
- observed strengths,
- observed weaknesses,
- keep / adapt / refactor / extract / replace decision,
- migration notes,
- tests required,
- rollback notes.

The reuse matrix is a gating artifact. Coding shall not begin until it exists.

## 6. Rewrite prohibition rules

A rewrite of a meaningful subsystem is forbidden unless the AI builder provides all of the following:

1. a written explanation of why the existing implementation cannot meet the target design,
2. proof that an adapter or in-place refactor is insufficient,
3. an interface preservation plan,
4. a data migration plan if persistence is involved,
5. a compatibility bridge if old and new code must coexist temporarily,
6. a verification plan,
7. a rollback plan.

The phrase “cleaner architecture” is not sufficient justification by itself.

## 7. Transition strategy requirements

Where possible, the system shall evolve via strangler-pattern transitions rather than cutover rewrites.

Preferred transition sequence:
1. wrap the old boundary,
2. define the new contract,
3. move one responsibility at a time,
4. preserve behavior under tests,
5. route traffic to the new path gradually,
6. remove the old code only after the new path is proven.

## 8. Areas of likely salvage in the existing VibeFlow codebase

The exact salvage audit must be done against the current repo at implementation time, but the AI builder should assume the following areas are likely candidates for reuse or adaptation:
- Electron shell and preload security boundary,
- conversation and model-streaming surfaces,
- project persistence and local cache patterns,
- mode system concepts,
- approval workflow primitives,
- DevOps control surfaces and environment views,
- MCP configuration screens and persistence,
- sync and device ownership ideas,
- handoff and idiosyncrasy capture patterns,
- settings, model registry, and operator preferences.

These assumptions do not override the required salvage audit; they simply prevent the AI from assuming that nothing useful exists.

## 9. Required migration artifacts

Every subsystem migration must leave behind:
- the reuse matrix,
- an old-to-new module mapping,
- interface contracts,
- data migration notes if applicable,
- test additions or updates,
- operator-visible behavior changes,
- unresolved risks.

## 10. Data and persistence migration rules

If the subsystem touches persistence, the AI builder must additionally specify:
- current schema or storage model,
- target schema or storage model,
- forward migration steps,
- rollback steps,
- whether online coexistence is needed,
- whether backfill is needed,
- how migration success will be proven.

No silent persistence rewrite is allowed.

## 11. UI migration rules

If the subsystem touches UI, the AI builder must prefer incremental screen evolution over replacing the whole shell at once.

The builder shall:
- preserve operator orientation where reasonable,
- keep old and new surfaces discoverable during staged migration,
- avoid removing working operational views before the replacement exists,
- document any intentionally removed screen or panel.

## 12. Test requirements for brownfield work

Brownfield work requires stronger tests than greenfield work because it is more likely to break hidden assumptions.

Every meaningful migration shall include:
- regression tests for preserved behavior,
- compatibility tests for old-to-new contracts,
- migration tests if data shape changes,
- UI smoke tests for screen continuity where relevant,
- rollback tests for dangerous migrations.

## 13. Event logging and audit

The system shall log brownfield migration decisions as first-class audit events. Required event types include:
- `brownfield.salvage_audit_created`
- `brownfield.reuse_matrix_approved`
- `brownfield.module_classified`
- `brownfield.rewrite_justification_recorded`
- `brownfield.migration_started`
- `brownfield.migration_verified`
- `brownfield.rollback_executed`

## 14. Anti-drift rules

The AI builder must never:
- replace a working subsystem merely because a fresh implementation seems cleaner,
- erase useful domain concepts that already exist in code,
- duplicate existing runtime logic in a new abstraction without a migration plan,
- change persistent data shape without explicit migration notes,
- claim “legacy” as a reason for replacement without evidence.

## 15. Acceptance criteria

This component is complete only when the builder can approach any target subsystem in the current VibeFlow repo and produce a bounded, auditable, low-waste migration plan that maximizes reuse and minimizes destructive rewrites.
