# Component 10: Product Shell and AI-Native Workspace

## 1. Purpose

This component defines the visible product shell and the primary operator experience. It is responsible for how the system is navigated, how missions are started, how state is surfaced, and how all other components are presented.

This is not an editor shell that happens to host an AI. It is the operating console for an AI-directed software factory.

## 2. Responsibilities

The shell shall:

- host the primary mission-centric interface,
- maintain the current project and environment context,
- render all first-class panels,
- support drill-down into files, diffs, logs, and provider details,
- persist layout and user preferences,
- expose actions for planning, execution, verification, deploy, rollback, and handoff,
- display the current execution state clearly,
- avoid overwhelming the operator with programmer-centric chrome.

## 3. Primary navigation model

The primary navigation model shall be by:
- project,
- mission,
- plan,
- environment,
- deployment,
- incident,
- memory pack,
- capability.

The primary navigation model shall not be by:
- open tabs,
- arbitrary files,
- raw branch state,
- extension sidebars,
- launch configuration files.

## 4. Required top-level regions

### Project header
Shows:
- active project,
- linked repositories,
- active environment,
- model/mode posture,
- current mission status,
- last deploy status,
- pending approval count,
- unhealthy capability count.

### Left rail
Must contain:
- Projects
- Missions
- Environments
- Deploys
- Incidents
- Memory Packs
- Capabilities
- Audit / Rollback

### Main content frame
Contains the active mission workspace with multi-panel layout.

### Right evidence rail
Shows:
- live checks,
- active evidence items,
- recent tool calls,
- risk alerts,
- context omissions,
- post-deploy watch state.

## 5. Required panels inside a mission workspace

### Mission panel
Contains:
- mission title,
- operator request,
- clarified constraints,
- status,
- owner,
- timestamps,
- linked plan,
- linked approvals.

### Plan panel
Contains:
- decomposed steps,
- blocked steps,
- required capabilities,
- risk labels,
- required evidence,
- expected outputs,
- current active step.

### Context panel
Contains:
- loaded files,
- loaded symbols,
- loaded memory packs,
- environments in scope,
- services in scope,
- token/context usage,
- stale context warnings,
- suggested missing context.

### Change panel
Contains:
- logical change groups,
- affected files,
- semantic summaries,
- blast radius view,
- raw diff drill-down,
- explanation tied to evidence.

### Evidence panel
Contains:
- type/lint/build results,
- tests,
- browser verification,
- screenshots,
- traces,
- logs,
- policy checks,
- performance deltas,
- schema safety checks.

### Environment panel
Contains:
- local,
- preview,
- staging,
- canary,
- production,
- current version in each,
- secrets completeness,
- service health,
- branch/tag mapping.

### Capabilities panel
Contains:
- MCP servers,
- direct connectors,
- tool health,
- tool permissions,
- recent failures,
- discovery state.

### Watch panel
Contains:
- live post-deploy checks,
- metrics,
- regression alerts,
- incident recommendations.

### Audit / rollback panel
Contains:
- checkpoints,
- tool call history,
- approval records,
- deploy history,
- rollback options.

## 6. UX rules

1. The shell must lead with intent and status, not code.
2. Every panel must have a collapsed summary state and an expanded investigative state.
3. Raw technical data must always be reachable in one or two clicks.
4. The UI must never force the operator to understand Git internals to move work forward.
5. The UI must never hide that a real tool action occurred.
6. The shell must support "show me exactly what happened" at any time.
7. The shell must support "hide the noise and summarize" at any time.
8. The shell must preserve enough detail that a professional engineer can step in.

## 7. Required interaction patterns

### Start mission
1. Operator enters a request.
2. Shell asks only for missing business-critical clarification, not programmer trivia.
3. Shell creates a mission record and routes it to planning.

### Review plan
1. Plan appears as structured steps, not a paragraph.
2. User can edit assumptions or constraints.
3. User can lock "do not change" areas before execution.

### Review change
1. Change appears grouped by concept, not only by file.
2. User can inspect raw diffs, files, or generated explanation.
3. Risk flags are shown next to each change group.

### Verify
1. Verification status updates live.
2. Failing evidence can be opened directly from the failed check.
3. The system distinguishes between pre-merge and pre-deploy evidence.

### Deploy
1. Deploy targets are shown as explicit environments.
2. Approvals and blockers are visible before action.
3. Rollback readiness is shown before deploy approval.

## 8. Panels that replace traditional IDE assumptions

Instead of "Explorer", the shell uses **Project Topology**.
Instead of "Source Control", the shell uses **Change / Candidate / Deploy History**.
Instead of "Extensions", the shell uses **Capabilities**.
Instead of "Run and Debug", the shell uses **Execution / Verification / Watch**.
Instead of "Problems", the shell uses **Evidence and Risk**.

## 9. Accessibility and legibility requirements

- The shell must remain legible during long missions.
- Panel titles must use plain-English nouns.
- Actions must be phrased by outcome ("Create preview deploy", "Rollback production") rather than low-level jargon.
- Dense raw output views must support summary overlays.
- Important status should never depend on color alone.

## 10. Persistent UI state

The shell shall persist:
- panel layout,
- panel pin/collapse state,
- preferred drill-down depth,
- last active project,
- last active environment,
- visible columns in topology and evidence tables,
- raw vs summarized default mode.

## 11. Error handling requirements

The shell must gracefully handle:
- lost model connectivity,
- failed tool invocation,
- stale project indexing,
- provider auth loss,
- MCP health failures,
- deploy status uncertainty,
- sync conflicts.

Every error state must answer:
- what failed,
- what was affected,
- what the operator can do next,
- whether work is safe to continue.

## 12. Implementation rules

- Build the shell around explicit domain objects, not ad hoc chat messages.
- The shell must be driven by structured state stores.
- Every visible status must be backed by machine-readable events.
- Avoid hard-coding panel content to a single model/provider.
- Do not treat the code editor as the root component.
- Do not introduce generic IDE concepts unless they serve the AI-native workflow.

## 13. Acceptance criteria

This component is complete only when:
- a mission can be created and tracked end-to-end through the shell,
- all primary panels exist with placeholder but real state bindings,
- raw technical drill-downs exist,
- the system can display live risk/evidence/capability status,
- the shell remains useful even if the code editor is hidden.
