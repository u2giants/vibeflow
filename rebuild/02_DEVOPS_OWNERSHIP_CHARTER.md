# Component 02: DevOps Ownership Charter and A-to-Z Operational Coverage

## 1. Purpose

This component makes DevOps ownership explicit and non-negotiable. It exists so that no AI builder, architect, or coder can mistakenly interpret VibeFlow as merely a code-generation assistant.

VibeFlow is required to handle the full software delivery and operations lifecycle.

## 2. Mandatory statement

The product shall cover, orchestrate, supervise, or verify every stage from operator intent to deployed and monitored running software.

A design is non-compliant if it assumes that a human will manually bridge any major gap between code generation and safe operation.

## 3. Full DevOps scope

The system shall include explicit support for the following lifecycle zones:

### 3.1 Local development and workspace control
- repository clone and worktree awareness,
- branch and candidate management,
- dependency installation,
- local runtime launch,
- local environment validation,
- local evidence capture.

### 3.2 Source control and collaboration
- GitHub connectivity,
- branch, pull request, review, and merge workflows where configured,
- commit and candidate creation,
- deploy-linked source history,
- release tagging where appropriate.

### 3.3 Continuous integration
- CI run discovery,
- CI status surfacing,
- CI log retrieval,
- CI-required gates,
- re-run support where allowed,
- CI policy awareness.

### 3.4 Continuous delivery and deployment
- preview deployments,
- staging deployments,
- canary rollouts,
- production deployments,
- deployment health checks,
- deployment history,
- automated and manual rollback.

### 3.5 Runtime host and platform control
- Ubuntu host or comparable machine access when applicable,
- Coolify or equivalent control planes,
- Docker images, containers, compose or orchestration artifacts,
- runtime process inspection,
- port, health, and service readiness visibility.

### 3.6 Service integration control
- Supabase and hosted databases,
- Cloudflare, Railway, object storage, email providers, analytics services, queue systems, third-party APIs, and other hosted platforms as linked to the project,
- configuration completeness checks for each linked service,
- service dependency mapping and blast-radius awareness.

### 3.7 Secrets and configuration
- environment variable inventory,
- environment-specific config completeness,
- missing secret detection,
- unsafe config change detection,
- secret provenance and rotation workflows where supported.

### 3.8 Database and migration safety
- schema introspection,
- migration preview,
- destructive migration detection,
- rollout sequencing,
- backup/checkpoint expectations,
- rollback planning,
- data verification after migration.

### 3.9 Verification and release readiness
- lint, type, build, unit, integration, browser, and acceptance verification as applicable,
- impacted-surface verification rather than raw coverage theater,
- release readiness reporting,
- pre-deploy and post-deploy checks.

### 3.10 Observability and incident handling
- logs, traces, metrics, screenshots, console output, network evidence, health checks, and synthetic flows,
- incident detection,
- blast-radius analysis,
- suggested remediation,
- rollback recommendation,
- postmortem-ready evidence bundles.

## 4. DevOps responsibility model

The system must not merely expose these systems. It must reason about them.

For any meaningful change, the system shall determine:
- which environments are affected,
- which services are affected,
- which secrets or config values are required,
- which migrations are required,
- which verification steps are required,
- which deploy path is allowed,
- which post-deploy watch conditions matter,
- what rollback path exists.

## 5. Minimum deploy-ready artifact set

Before a change can be considered deployable, the system must be able to produce:
- the change set,
- the associated plan,
- verification evidence,
- environment readiness summary,
- service dependency summary,
- migration summary if applicable,
- secrets/config readiness summary,
- risk classification,
- approval status,
- rollback plan.

## 6. Environment model requirements

The system shall support an explicit environment model with at least:
- local,
- preview,
- staging,
- production.

Each environment must be represented with:
- deployed version or candidate,
- linked services,
- secrets/config status,
- health status,
- known drift or incidents,
- promotion and rollback capabilities.

## 7. Service topology requirements

The product shall maintain a living topology map that connects:
- repositories and services,
- APIs and databases,
- background jobs and queues,
- auth providers and edge/CDN services,
- deployment targets and runtime machines,
- observability sources and health checks.

The AI builder must assume that AI coding mistakes frequently come from incomplete system topology, not only from wrong code.

## 8. Approval and safety interaction

DevOps actions must integrate directly with the approval and risk engine.

Examples:
- viewing CI status may be low risk,
- re-running a job may be medium risk,
- deploying to preview may be medium or high risk depending on the project,
- migrating production databases is high risk,
- direct production host mutation is very high risk.

No DevOps surface may bypass approval and audit requirements.

## 9. MCP and capability interaction

Because many operational systems will be reached through MCP servers or connector adapters, the DevOps scope must be visible in the capability fabric.

The system shall present:
- what operational capabilities exist,
- which are healthy,
- which are authorized,
- which environment and service each capability touches,
- which operations are safe, risky, or blocked.

## 10. Post-deploy watch requirements

Every deployment-capable mission must define a watch window with:
- health signals to inspect,
- incident thresholds,
- rollback triggers,
- operator notification rules,
- evidence retention requirements.

A successful deploy is not enough. The system must verify the outcome after deploy.

## 11. Event logging and audit

Required event families include:
- `devops.environment_evaluated`
- `devops.service_dependency_mapped`
- `devops.ci_status_loaded`
- `devops.deploy_candidate_created`
- `devops.deploy_started`
- `devops.deploy_succeeded`
- `devops.deploy_failed`
- `devops.watch_window_started`
- `devops.rollback_recommended`
- `devops.rollback_executed`
- `devops.incident_opened`
- `devops.incident_resolved`

## 12. Anti-drift rules

The AI builder must never:
- stop the product boundary at code generation,
- assume deployment is “someone else’s job,”
- ship a feature that cannot reason about environment or service readiness,
- treat secrets, migrations, or runtime drift as out-of-band concerns,
- declare a mission complete without post-deploy verification capability.

## 13. Acceptance criteria

This component is complete only when an AI builder reading the spec cannot possibly mistake VibeFlow for a code-only assistant and instead understands that the system is responsible for DevOps and operational coverage from intent through monitored running software.
