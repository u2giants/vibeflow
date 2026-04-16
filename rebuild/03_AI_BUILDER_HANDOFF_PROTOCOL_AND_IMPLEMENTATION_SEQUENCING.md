# Component 03: AI Builder Handoff Protocol and Implementation Sequencing

## 1. Purpose

This component is not product runtime; it is the delivery protocol for building the system with AI coding agents safely.

## 2. Rules for using AI to build VibeFlow

1. Provide the master spec first.
2. Provide the brownfield reuse spec second.
3. Provide the DevOps ownership charter third.
4. Provide one runtime component spec at a time after those foundational governance specs.
5. Require the AI to restate:
   - scope,
   - non-goals,
   - required data model,
   - required UI surfaces,
   - required tests,
   - required event logs.
6. Forbid unrequested adjacent feature expansion.
7. Require a contract-first implementation plan before code.
8. Require the AI to list assumptions and unknowns.
9. Require a post-implementation compliance check against the spec.
10. Require a salvage audit and reuse matrix before every major subsystem implementation.
11. Forbid major rewrites without written justification, migration steps, test plan, and rollback plan.
12. Require explicit DevOps readiness analysis for any feature that changes runtime behavior, services, configuration, or deploy behavior.

## 3. Definition of done for each component

A component is not done until the AI delivers:
- salvage audit and reuse matrix (for brownfield work),
- domain model,
- persistence model,
- UI surfaces,
- service interfaces,
- tests,
- telemetry/events,
- failure handling,
- gap list.

## 4. Suggested coding order

1. Shared domain model and app shell.
2. Project intelligence and context.
3. Change engine.
4. Capability fabric and MCP.
5. Runtime evidence and verification.
6. Approval and rollback.
7. Environments and deploy control plane.
8. Secrets/config/migrations.
9. Memory packs.
10. Observability and incidents.
11. Sync and handoff.

## 5. Anti-drift checklist for every implementation step

The AI must answer:
- Did I reuse or adapt existing VibeFlow code before inventing new structure?
- Did I build for missions rather than files?
- Did I preserve transparency without requiring programmer workflows?
- Did I make MCP/capabilities first-class?
- Did I attach evidence rather than confidence theater?
- Did I classify risk and approvals?
- Did I keep Git beneath the product surface?
- Did I avoid turning the shell back into VS Code?

## 6. Brownfield and DevOps gating questions

Before coding starts, the AI must answer:
- What existing code in the current VibeFlow repo is relevant to this subsystem?
- Which parts are being kept, adapted, refactored, extracted, or replaced?
- Why is any replacement necessary?
- What operational or deployment responsibilities does this subsystem carry?
- How will the subsystem integrate with environments, services, secrets, verification, and rollback where relevant?

## 7. Acceptance criteria

This protocol is complete only when the builder can hand one component to an AI coder and get a bounded implementation that does not invent the wrong product, does not rewrite useful existing VibeFlow code casually, and does not stop short of DevOps responsibility where the feature requires it.
