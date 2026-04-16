# Component 07: Verification and Acceptance System

## 1. Purpose

This component decides whether a change is actually good enough. It coordinates static analysis, targeted tests, browser acceptance checks, policy validation, and deploy gating.

## 2. Responsibilities

The verification system shall:
- run continuous validity checks,
- select impacted tests,
- run critical path acceptance flows,
- compare before/after evidence,
- enforce risk-specific verification bundles,
- produce a verification verdict for candidates and deploys.

## 3. Verification layers

### Layer A: Instant validity
- parse,
- syntax,
- typecheck,
- lint,
- configuration integrity.

### Layer B: Impacted technical checks
- unit tests touching changed graph,
- integration tests touching changed interfaces,
- schema checks,
- generated artifact checks.

### Layer C: Acceptance flows
- browser-driven user journeys,
- API smoke flows,
- auth flows,
- upload/download flows,
- payment or checkout flows if present,
- background job trigger verification where feasible.

### Layer D: Policy and safety checks
- risk policy,
- secrets leakage,
- dependency vulnerability check,
- migration safety record present,
- protected path policy,
- required review present.

### Layer E: Deploy-specific checks
- health checks,
- rollout readiness,
- canary comparison,
- rollback readiness,
- environment secret completeness.

## 4. Verification bundles by risk class

Low-risk UI copy change may require:
- syntax,
- lint/type,
- screenshot diff,
- relevant acceptance flow.

Medium-risk behavior change may require:
- impacted tests,
- browser flow,
- second-model review.

High-risk auth/data/deploy change may require:
- full impacted verification,
- policy checks,
- explicit approval,
- rollback confirmation,
- environment-specific checks.

## 5. Acceptance criteria generation

For each mission, the system shall derive explicit acceptance criteria:
- intended behavior,
- non-goals,
- paths that must still work,
- screenshots or states to compare,
- performance/regression thresholds,
- conditions that would require rollback.

This acceptance record is mandatory before risky work proceeds.

## 6. Coverage philosophy

Coverage percentage is a secondary signal. The primary question is: did the system verify the critical paths touched by this change?

The verification UI should emphasize:
- path coverage,
- contract coverage,
- regression exposure,
- unverified high-risk areas.

## 7. Verification result model

Every verification run shall emit:
- checks executed,
- artifacts produced,
- pass/fail status,
- flake suspicion,
- missing required checks,
- environment,
- linked candidate,
- risk impact.

## 8. Fail-fast and stop rules

The system shall stop further promotion when:
- required checks fail,
- required evidence is missing,
- policy violation exists,
- environment secrets are incomplete,
- rollback path cannot be prepared.

## 9. Acceptance criteria

This component is complete only when:
- verification is layered,
- risk-based bundles exist,
- browser acceptance checks are first-class,
- deploy promotion is gated by explicit evidence,
- the system can explain why a candidate is or is not safe to promote.
