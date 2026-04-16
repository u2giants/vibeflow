# Component 13: Change Engine and Code Operations

## 1. Purpose

This component turns approved plans into actual code and configuration changes. It is responsible for patch generation, file operations, code reasoning support, semantic change grouping, and safe application of edits inside isolated workspaces.

## 2. Responsibilities

The change engine shall:
- create isolated execution workspaces,
- read and write files,
- generate patches,
- apply edits deterministically,
- preserve formatting and project conventions where possible,
- classify and group changes semantically,
- run immediate validity checks,
- maintain checkpoints,
- prepare change sets for review and deploy.

## 3. Isolated workspace requirement

All non-trivial code changes must occur in an isolated workspace:
- dedicated branch and/or worktree,
- deterministic dependency environment,
- scoped filesystem access,
- captured command history,
- checkpointed state.

The system must never make uncontrolled edits directly in the primary workspace as the normal path.

## 4. Supported edit modes

### Surgical edit
Small replacement in known file/region.

### Multi-file patch
Coordinated change across known files.

### Generation with insertion
New files or modules generated into planned locations.

### Refactor with graph-aware update
Symbol rename, extraction, move, or contract change with dependent updates.

### Config mutation
Structured edits to config or manifest files.

### Migration generation
Creation or modification of schema/migration artifacts, always under migration safety rules.

## 5. Semantic grouping requirement

After edits, the engine must group changes by meaning, such as:
- UI layout change,
- API contract change,
- auth behavior change,
- data model change,
- dependency addition,
- deployment config change.

The user must not be forced to reason only through file order or line order.

## 6. Immediate validity pipeline

After each meaningful patch application, the engine shall run the smallest effective validation set:
- parse / syntax validity,
- typecheck for affected graph when available,
- lint for affected files,
- dependency integrity checks,
- schema validation if relevant.

The goal is to catch breakage early rather than after a giant batch.

## 7. Duplicate and drift detection

The engine shall detect:
- duplicate helper logic,
- duplicated types or schemas,
- near-duplicate UI fragments,
- reimplementation of existing utilities,
- generated code that conflicts with existing patterns.

It must prefer reuse over duplication when supported by evidence.

## 8. Existing-pattern reuse

Before introducing a new abstraction, the engine shall search the project intelligence layer for:
- similar functions,
- similar components,
- existing error handling style,
- established fetch/client helpers,
- preferred validation and schema libraries,
- existing design system components.

## 9. Required data structures

- WorkspaceRun
- PatchProposal
- FileEdit
- SemanticChangeGroup
- Checkpoint
- ChangeSet
- DuplicateWarning
- PatternReuseSuggestion

## 10. Required user-facing outputs

For each changeset, the engine must expose:
- summary of what changed,
- why it changed,
- affected files,
- affected public contracts,
- blast radius,
- verification run state,
- rollback checkpoint,
- raw diff.

## 11. Raw diff rules

Raw diffs remain available, but shall not be the only review view. The semantic change view is primary.

## 12. Commit and branch policy

Git is underneath, but the engine must still manage:
- branch/worktree naming,
- commit generation,
- candidate creation,
- merge readiness,
- protected-branch safeguards,
- rollback references.

The user should see tasks and candidates first, with Git details available on demand.

## 13. Dangerous edit safeguards

The engine must flag or block:
- mass deletion,
- edits touching protected paths,
- generated code replacing hand-maintained code,
- silent dependency upgrades,
- contract-breaking refactors without dependent updates,
- auth changes without verification requirements,
- migrations without safety record.

## 14. Acceptance criteria

This component is complete only when:
- changes happen in isolated workspaces,
- semantic grouping exists,
- immediate validity checks run automatically,
- duplicate detection and reuse suggestions exist,
- the user can inspect both high-level meaning and raw diffs,
- rollback checkpoints are created before risky modifications.
