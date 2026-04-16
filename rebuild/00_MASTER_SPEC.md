# VibeFlow Reboot Master Specification
Version: 0.1  
Status: Normative design specification for the rebuilt system  
Audience: AI coding agents, technical implementers, product owner  
Purpose: Define the target system so precisely that implementation does not drift into a generic IDE, a generic chat app, or a generic agent framework.

## 0. Mandatory build order directive

The AI builder must not begin implementation from any runtime component until it has first read and acknowledged all of the following in order:

1. this master spec,
2. the brownfield rebuild and existing code reuse spec,
3. the DevOps ownership charter,
4. the AI builder handoff and implementation sequencing protocol.

These four documents are constitutional. They override component-level convenience and they exist specifically to prevent accidental greenfield rewrites, shallow code-only implementations, and architecture drift.

## 1. Product definition

VibeFlow is not a code editor with AI added. VibeFlow is a supervised software-building operating system for non-programmers who still want full visibility into what the machine is doing.

The product accepts natural-language intent from an operator and turns that intent into planned code changes, tool actions, verification steps, deployment actions, and post-deploy monitoring. It exposes the full chain of evidence needed to trust the machine, without forcing the operator to behave like a programmer.

The product must support the entire lifecycle:

1. Understand the operator's request.
2. Build a project-aware plan.
3. Gather code, system, service, and environment context.
4. Make code and configuration changes.
5. Run verification.
6. Deploy to the correct environment.
7. Watch the result.
8. Explain what happened in plain English.
9. Roll back safely when required.

The product must be optimized around the failure patterns of AI coding systems rather than the workflow of human programmers.

## 2. Product goal

The system shall let a user say things such as:

- "Make the product cards larger on mobile."
- "Add Google login."
- "Fix the file upload bug."
- "Deploy the bug fix to production."
- "Why is checkout failing today?"
- "Rollback the last deploy and tell me what broke."

The system shall then do the technical work needed to execute that request, while surfacing risk, evidence, and required approvals.

## 3. Product users

### Primary user
A non-programmer operator who:
- can describe business intent clearly,
- does not want to manually write code, use terminal commands, or manage deployment pipelines,
- still wants to see enough detail that a professional engineer could step in and understand the state of the system.

### Secondary user
A technical helper who may occasionally inspect:
- code diffs,
- deployment history,
- logs,
- model/tool decisions,
- environment and service topology,
- audit trails.

### Explicit anti-user
A user who wants a traditional IDE optimized for hand-coding, plugin sprawl, deep manual text editing, or endless terminal-centric workflows.

## 4. Non-negotiable product principles

1. **AI-first, not human-editor-first.**  
   The system must start from missions, plans, evidence, verification, and environments. Files and text editors are secondary support tools.

2. **Transparency without programmer burden.**  
   The user must be able to inspect everything, but should not be forced into low-level mechanics unless they choose to inspect them.

3. **Evidence beats confidence.**  
   The system must never rely on a model's self-rated confidence as the main trust signal. Trust must be based on evidence: passing checks, matched contracts, screenshots, logs, traces, and explicit policy compliance.

4. **The whole software system is in scope.**  
   The codebase alone is not enough. The machine must understand runtime environments, secrets, services, deployments, logs, and connected systems.

5. **Risk must be explicit.**  
   Every action must be classified by risk. Destructive operations must require stronger approval and stronger evidence.

6. **Git is an implementation detail, not the product's main mental model.**  
   Users think in tasks, candidates, deployments, and rollback points. Git remains underneath.

7. **MCP is a first-class capability surface.**  
   The user may need to configure and understand MCP endpoints because MCP is the bridge to external systems. VibeFlow must make MCP understandable and manageable, not invisible.

8. **Context must be deliberate and inspectable.**  
   The system must show what context was loaded, why it was loaded, what was omitted, what was stale, and what evidence supported the plan.

9. **Memory must be selective, not always hot.**  
   Prior decisions, known fixes, architecture rules, and codebase idiosyncrasies must live in a retrievable knowledge layer or "skill-like" pack, not permanently occupy the active context window.

10. **The machine must operate within constrained workflows.**  
    The product must not be a free-form "ask an LLM and hope" shell. It must be a constrained software factory with approval gates, verification, audit logs, and recovery paths.

11. **Brownfield-first evolution is mandatory.**  
    The existing VibeFlow codebase is a strategic asset. The AI builder must preserve, audit, classify, adapt, and extend existing code before considering replacement. Rewrite is the exception and requires explicit written justification, migration steps, test coverage, and rollback planning.

12. **DevOps ownership is full-stack and end-to-end.**  
    The product must not stop at code generation. It is required to cover the full delivery and operations lifecycle: local workspace state, git/worktrees, CI, CD, build, package, runtime configuration, secrets, databases, migrations, deploy platforms, infrastructure adapters, post-deploy monitoring, incident response, and rollback.

## 5. What VibeFlow must not become

The rebuilt system must not drift into any of the following:

- A clone of VS Code with an AI sidebar.
- A generic chat agent that edits files without world knowledge.
- A terminal wrapper where the AI runs arbitrary commands as a first move.
- A "confidence theater" interface full of fake percentages.
- A plugin bazaar that becomes impossible for AI or users to reason about.
- A developer-only product that assumes fluency in Git, shells, package managers, or hosting internals.
- A black box that hides tool calls, service access, or deploy activity.

## 6. What to keep from programmer tooling and what to remove

### Keep, but demote from the center
- file tree explorer,
- text editor,
- raw diffs,
- terminal view,
- Git history,
- logs,
- service configuration details.

These remain available for inspection, but they are not the primary navigation model.

### Remove or heavily de-emphasize
- tabs as the main working metaphor,
- extension sprawl,
- manual launch configuration files as a first-class UX element,
- manual branch/rebase/cherry-pick workflows as primary surfaces,
- raw terminal output as the default explanation layer,
- status bar clutter meant for programmers,
- file navigation as the main way to understand the system,
- "open folder and start coding" as the product's foundational assumption.

### Add as first-class surfaces
- mission / intent panel,
- plan panel,
- context and evidence panel,
- semantic change panel,
- verification panel,
- environments and deploy panel,
- post-deploy watch panel,
- MCP and capabilities panel,
- topology map,
- rollback and audit history,
- context window / context quality dashboard.

## 7. High-level system architecture

The system shall be composed of the following major components. The first three are governance components and must be read before any runtime component is implemented:

1. Brownfield rebuild, migration governance, and existing code reuse.
2. DevOps ownership charter and A-to-Z operational coverage.
3. AI builder handoff protocol and implementation sequencing.
4. Product shell and AI-native workspace.
5. Project intelligence and context system.
6. Agent orchestration and mode system.
7. Change engine and code operations.
8. Capability fabric, MCP, and tool connectors.
9. Runtime execution, debugging, and evidence capture.
10. Verification and acceptance system.
11. Environments, deployments, and service control plane.
12. Secrets, configuration, database, and migration safety.
13. Approval, risk, audit, and rollback.
14. Memory, skills, and decision knowledge.
15. Observability, incident response, and self-healing.
16. Sync, collaboration, and persistent state.

Each component has its own detailed specification in the component pack. The pack must be fed in that governance-first order.

## 8. Brownfield rebuild and existing code reuse directive

The rebuilt system shall be developed as a brownfield evolution of the existing VibeFlow codebase wherever practical. The current repository, package boundaries, UI surfaces, storage patterns, Electron shell, connector code, approval workflows, and operational logic shall be treated as reusable assets unless proven otherwise.

The AI builder shall not assume that a cleaner rewrite is preferable. The default stance is:

1. inspect the existing implementation,
2. classify what exists,
3. preserve what is sound,
4. adapt what is close,
5. refactor in place where possible,
6. replace only where the existing code cannot responsibly serve the target design.

### Brownfield implementation requirements

Before implementing any major component, the AI builder must produce a **reuse matrix** that lists:
- current modules and files that appear relevant,
- what each one does today,
- whether it should be kept as-is, wrapped with an adapter, refactored in place, extracted into a clearer boundary, or replaced,
- why each decision was made,
- what tests will prove the migration is safe,
- what rollback path exists if the migration fails.

### Rewrite prohibition rules

A major rewrite is forbidden unless the builder documents all of the following:
- why the current code cannot satisfy the target requirement,
- why an adapter layer is insufficient,
- what interfaces must remain stable during transition,
- how old and new code will coexist during migration,
- what data migration is required,
- how the change will be validated,
- how rollback will work.

### Reuse priorities

The AI builder shall prefer reuse in this order:
1. existing VibeFlow runtime code,
2. existing VibeFlow domain models and persistence models,
3. existing UI shells and navigation surfaces,
4. existing operational connectors,
5. existing test harnesses and scripts,
6. new implementation only when existing assets cannot be safely evolved.

## 9. DevOps ownership charter

The rebuilt system is required to handle DevOps A-to-Z. This is not optional and must be visible throughout the architecture. No component design is acceptable if it stops at code generation and assumes a human will manually bridge the gap to delivery or operations.

### Mandatory DevOps scope

The system shall own, orchestrate, or explicitly supervise the following lifecycle areas:
- local project clone, worktree, and workspace state,
- GitHub as code collaboration and source control surface,
- CI execution and status visibility,
- CD and deploy orchestration,
- preview, staging, canary, and production environments,
- Ubuntu host or equivalent runtime machine access where relevant,
- Coolify or comparable deployment control planes,
- Docker, containers, compose files, images, and runtime packaging,
- secrets injection and configuration completeness,
- database introspection, migrations, safety checks, and rollback,
- service integrations such as Supabase, Cloudflare, Railway, hosted databases, queues, object storage, analytics, and email providers,
- logs, traces, metrics, health checks, and synthetic verification,
- incident detection, remediation planning, rollback, and postmortem evidence.

### DevOps acceptance rule

A feature is not considered complete merely because code compiles or tests pass locally. A change is complete only when the system can determine:
- where the change must be deployed,
- what services and secrets it depends on,
- what migration or runtime risk it introduces,
- how it will be verified before and after deploy,
- how it will be rolled back if needed.

## 10. Core object model

The implementation shall revolve around explicit system objects. These are not optional abstractions.

### Workspace
A top-level container representing one operator's session space. A workspace contains projects, preferences, linked capabilities, model settings, and local state.

### Project
A software system under management. A project includes:
- linked repositories,
- branch and worktree state,
- environments,
- service topology,
- secrets references,
- architectural memory,
- approval policies,
- idiosyncrasies,
- verification presets.

### Mission
A natural-language user request that starts work. A mission is not equal to one prompt message. A mission may produce multiple tasks, plans, changesets, deployments, and incidents.

### Plan
A structured decomposition of a mission into ordered steps with:
- assumptions,
- target areas,
- required context,
- required capabilities,
- risk tags,
- verification requirements,
- expected outputs.

### Context Pack
An inspectable bundle of project-relevant data loaded into the active reasoning loop:
- files,
- symbols,
- architectural summaries,
- topology nodes,
- recent deploy state,
- logs,
- prior decisions,
- memory pack results,
- user constraints.

### Capability
An invokable external or internal ability. Capabilities include:
- file operations,
- git operations,
- terminal actions,
- MCP tools,
- API connectors,
- browser automation,
- deployment APIs,
- secrets manager access,
- database introspection,
- runtime log queries.

### Change Set
A logical unit of code/configuration changes with:
- affected files,
- rationale,
- evidence,
- blast radius,
- verification outcomes,
- rollback linkage.

### Evidence Item
Any artifact that supports or refutes correctness:
- typecheck result,
- test result,
- screenshot,
- network trace,
- console log,
- server log,
- diff analysis,
- schema diff,
- deploy health check,
- policy check.

### Approval Request
A structured request for human or second-model authorization:
- action class,
- risk score,
- proposed operation,
- evidence summary,
- alternatives,
- rollback plan.

### Deploy Candidate
A versioned candidate ready for preview, staging, canary, or production release.

### Incident
A post-change problem or anomaly with:
- severity,
- suspected cause,
- linked deploy/change set,
- evidence,
- proposed remediation,
- rollback availability.

## 9. End-to-end lifecycle

The default mission lifecycle shall be:

1. User states intent.
2. System parses intent into a mission record.
3. System generates a structured plan.
4. System assembles a context pack and exposes the context dashboard.
5. System identifies affected code, environments, services, and data.
6. System classifies risk.
7. System requests approval if required.
8. System performs changes inside an isolated execution workspace.
9. System runs continuous validity checks.
10. System runs targeted verification and acceptance tests.
11. System creates a semantic changeset view with evidence-backed explanation.
12. System promotes the change to preview or staging.
13. System runs deployment-specific verification.
14. System requests higher approval for protected environments.
15. System deploys.
16. System watches live telemetry.
17. System reports results in plain English.
18. System offers rollback or remediation if anomalies appear.

This lifecycle may branch, but the system shall not skip evidence, classification, or audit.

## 10. Core user interface model

The workspace shall be organized around panels, not primarily around files.

### Required primary panels
1. **Mission panel** — current request, status, constraints, approvals.
2. **Plan panel** — the decomposed execution plan with assumptions and next step.
3. **Context panel** — active context pack, loaded files/symbols, services in scope, token budget, omitted context, stale context warnings.
4. **Change panel** — semantic diff grouped by meaning rather than raw text order.
5. **Evidence panel** — tests, screenshots, traces, logs, policy checks, performance comparisons.
6. **Environment panel** — local, preview, staging, production state; mapping of branches to environments.
7. **Capabilities panel** — MCP connections, tool health, permissions, available actions.
8. **Watch panel** — live telemetry and deploy outcomes.
9. **Audit / rollback panel** — action history, checkpoints, rollback points.

### Secondary drill-down surfaces
- file tree,
- raw code editor,
- raw terminal output,
- raw Git details,
- raw provider/API payloads.

These are subordinate views.

## 11. Context window and context quality policy

The system shall include a visible context dashboard because the user wants transparency and the AI builder needs discipline.

The dashboard shall show:
- active reasoning budget,
- current context pack size,
- files included,
- symbols included,
- memory pack results loaded,
- logs/traces loaded,
- what was intentionally excluded,
- stale items,
- missing recommended items,
- evidence freshness.

The dashboard shall not merely display token counts. It shall explain context quality.

## 12. MCP and capability philosophy

MCP is not a hidden internal detail in this product. It is the operator-configurable bridge to real services. The system shall therefore expose:

- MCP server registry,
- server purpose,
- command and arguments,
- auth model,
- scope,
- health state,
- discovered tools,
- tool schemas,
- permissions,
- recent usage,
- failure history.

The UI shall explain MCP in plain language: "This server lets the system talk to X and do Y."

## 13. Memory and "skill-like" retrieval philosophy

The system shall support retrievable knowledge packs for:
- prior fixes,
- design decisions,
- architecture rules,
- project idiosyncrasies,
- preferred patterns,
- service map notes,
- release rules,
- known fragile areas.

These packs shall be:
- indexed,
- tagged,
- selectively loaded,
- attributable,
- versioned,
- reviewable.

They must not always sit in active context. They are invoked when relevant.

## 14. Global implementation constraints

1. Every dangerous action must be routed through the risk and approval engine.
2. Every tool action must be logged with arguments, result, timing, and actor.
3. Every change must be linked to evidence.
4. Every deploy must be linked to a rollback path.
5. Every environment must declare secrets dependencies and service dependencies.
6. Every migration must produce a safety classification.
7. Every model interaction must store the context provenance.
8. Every mission must produce a structured state record, not just chat text.
9. Every component must publish machine-readable contracts for the other components.
10. No component may assume the user is a programmer.

## 15. Recommended implementation order

To prevent AI coding agents from making sprawling mistakes, implementation shall occur in this order:

1. Product shell and object model.
2. Project intelligence and context system.
3. Change engine and isolated workspace operations.
4. Capability fabric and MCP/tool registry.
5. Verification and evidence capture.
6. Approval and rollback.
7. Environment/deploy control plane.
8. Secrets/config/migration safety.
9. Memory packs and decision knowledge.
10. Observability and self-healing.
11. Sync/collaboration.

Each step shall be considered complete only after:
- contracts are written,
- tests are added,
- event logging is implemented,
- UI surfaces exist,
- failure modes are handled,
- the next component can depend on it without guessing.

## 16. How to feed this spec to an AI coder

The preferred procedure is:

1. Provide this master spec first.
2. Provide exactly one component spec.
3. Require the AI to restate the component boundaries before writing code.
4. Require the AI to list contracts, persistent objects, UI surfaces, and failure modes before implementation.
5. Require the AI to show what parts of the master spec it is satisfying.
6. Forbid the AI from "helpfully" inventing adjacent systems not covered by the current component.
7. After implementation, require a gap analysis against both the master spec and that component spec.
8. Only then provide the next component spec.

This chunking protocol is mandatory for controlling scope drift.

## 17. Definition of success

The rebuilt VibeFlow succeeds when:
- a non-programmer can run serious software projects through it,
- a technical helper can inspect every important technical detail,
- AI mistakes are caught by system design rather than wishful prompting,
- deployments are safer because evidence, approvals, and rollback are built in,
- the system remains legible to future AI builders because the architecture is explicit,
- the product feels like mission control for software creation rather than a text editor.
