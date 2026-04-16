# Component 06: Runtime Execution, Debugging, and Evidence Capture

## 1. Purpose

This component lets the system run software, observe behavior, reproduce bugs, inspect failures, and capture concrete evidence.

AI systems fail because they imagine runtime behavior instead of observing it. This component closes that gap.

## 2. Responsibilities

The component shall:
- start and stop local or remote runtimes,
- capture console and server logs,
- capture browser behavior,
- collect network traces,
- inspect runtime variables where supported,
- capture database query effects where allowed,
- capture screenshots and DOM state,
- correlate evidence to missions and changesets.

## 3. Runtime scopes

Supported scopes:
- local development runtime,
- preview environment,
- staging environment,
- canary environment,
- production observation mode,
- remote host observation.

## 4. Evidence types

Required evidence types:
- stdout/stderr streams,
- structured app logs,
- stack traces,
- browser console logs,
- network request/response summaries,
- screenshot before/after pairs,
- DOM snapshots,
- storage/cookie state when relevant,
- database query summaries,
- performance timings,
- crash dumps or equivalent diagnostics where available.

## 5. Browser automation requirements

The system shall support browser-driven verification and debugging:
- login,
- navigation,
- form filling,
- file upload,
- button clicks,
- modal handling,
- screenshot capture,
- console inspection,
- network inspection,
- flow replay.

This is mandatory for modern web apps.

## 6. Before/after runtime capture

When investigating a bug or validating a change, the system should capture:
- expected behavior,
- actual behavior before the fix,
- actual behavior after the fix,
- evidence difference summary.

The UI should make these comparisons obvious.

## 7. Debug workflow

1. Reproduce issue.
2. Capture evidence.
3. Generate hypotheses.
4. Map hypotheses to code and service areas.
5. Make one constrained change set.
6. Re-run reproduction.
7. Compare evidence before and after.
8. Escalate or conclude.

## 8. Correlation requirements

Every evidence item must be linkable to:
- mission,
- plan step,
- role,
- workspace run,
- capability invocation,
- changeset,
- environment,
- deploy candidate where relevant.

## 9. Performance analysis

The component shall surface:
- response-time deltas,
- repeated request patterns,
- query count increases,
- heavy asset/bundle regressions,
- suspicious loops and N+1 patterns detected in runtime behavior.

## 10. Safety rules

Production execution modes must distinguish between:
- observation,
- low-risk synthetic check,
- destructive or mutating action.

The system must not freely mutate production just to "see what happens."

## 11. Acceptance criteria

This component is complete only when:
- the system can run the app and collect logs,
- browser automation exists,
- evidence can be captured before and after a fix,
- debugging is tied to real runtime evidence rather than text speculation,
- all captured artifacts are linked back to mission history.
