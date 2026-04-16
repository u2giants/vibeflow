# Component 17: Environments, Deployments, and Service Control Plane

## 1. Purpose

This component manages where software runs and how changes move through environments and connected services.

The system must understand runtime reality, not just repository state.

## 2. Responsibilities

The component shall:
- model environments,
- model service topology,
- track version per environment,
- initiate deploys,
- support preview/staging/canary/production promotion,
- verify rollout health,
- support rollback,
- show environment-to-branch/tag relationships,
- show external services linked to each environment.

## 3. Environment model

Every project shall define environment records such as:
- local,
- preview,
- staging,
- canary,
- production.

Each environment record must include:
- host/platform,
- deploy mechanism,
- required secrets,
- linked services,
- health endpoints,
- protections,
- rollback method,
- mutability rules.

## 4. Service control plane model

The service control plane shall model:
- app runtime,
- background workers,
- database,
- object storage,
- auth provider,
- queue,
- cron/scheduled jobs,
- CDN / DNS,
- email provider,
- analytics,
- third-party APIs.

For each service the system must know:
- what it is,
- where it lives,
- which environments use it,
- who can mutate it,
- whether mutation is reversible.

## 5. Deployment workflow

A standard deployment workflow shall be:
1. candidate selected,
2. environment compatibility checked,
3. secrets/config completeness checked,
4. approval confirmed,
5. deploy initiated,
6. rollout progress observed,
7. health checks run,
8. canary comparison or smoke flow run,
9. deploy verdict recorded,
10. rollback offered if regression appears.

## 6. Preview environments

Preview environments should be easy to create and destroy. They are the safest default target for broad AI-generated changes.

## 7. Production protection

Protected environments must require:
- stronger approvals,
- stronger evidence,
- explicit rollback readiness,
- clear indication of service dependencies,
- incident watch activation immediately after deploy.

## 8. Environment drift detection

The system shall detect and surface:
- missing secrets in one environment,
- mismatched service versions,
- config drift,
- untracked manual changes,
- schema mismatch,
- provider auth drift.

## 9. Acceptance criteria

This component is complete only when:
- environments are explicit objects,
- deploys are linked to candidates and evidence,
- runtime/service topology is visible,
- production deploys are guarded,
- drift and rollback state are visible before action.
