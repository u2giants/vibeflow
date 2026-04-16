# Component 12: Agent Orchestration and Mode System

## 1. Purpose

This component coordinates reasoning roles, model selection, task routing, and execution state. It exists to prevent "one big prompt" behavior and to make the system legible.

## 2. Design premise

The system may present a single unified experience to the operator, but internally it shall distinguish roles with different jobs, permissions, and success criteria.

## 3. Required roles

### Orchestrator
Owns mission intake, plan synthesis, routing, context requirements, approval checkpoints, and summary generation.

### Architect
Owns structure, dependency boundaries, pattern choice, contract analysis, and major change design.

### Coder
Owns implementation changes inside approved scope.

### Reviewer
Owns second-model review, policy checking, contract consistency checking, and skepticism.

### Debugger
Owns investigation of failing tests, broken flows, runtime errors, logs, traces, and regression analysis.

### DevOps
Owns environment, deploy, hosting, health check, runtime state, and infrastructure-affecting actions.

### Watcher / Incident responder
Owns post-deploy anomaly detection, rollback recommendation, and remediation planning.

These roles may be served by one or more underlying models, but the role abstraction is mandatory.

## 4. Responsibilities

This component shall:
- create plan steps,
- assign each step to the appropriate role,
- decide when a second model is required,
- manage model/provider selection,
- enforce role-specific permissions,
- manage retries and escalation,
- produce human-readable summaries of internal decisions.

## 5. Planning contract

Before code is written, the orchestrator must produce:
- mission summary,
- explicit assumptions,
- goals,
- non-goals,
- affected subsystems,
- required context,
- required capabilities,
- risk classes,
- required evidence,
- step order,
- approval boundaries.

The plan must be structured data, not just prose.

## 6. Routing rules

Examples:
- UI wording change -> Coder with low-risk verification.
- auth redesign -> Architect, Reviewer, Coder, Verification, Approval.
- failing deploy -> DevOps + Debugger.
- unexplained production anomaly -> Watcher + Debugger + DevOps.
- schema change -> Architect + Coder + Migration Safety + Approval.

## 7. Provider and model selection

The system shall support multiple model providers and model classes. Selection must consider:
- reasoning strength,
- code-editing strength,
- review strength,
- cost,
- speed,
- context window,
- tool-use reliability.

Selection decisions must be recorded as evidence.

## 8. Role boundaries

Each role shall expose:
- allowed capabilities,
- required context classes,
- required output schema,
- escalation paths,
- forbidden actions.

Example: the Coder role must not directly approve its own high-risk deploy.

## 9. Structured outputs

Every role output must be machine-usable. Examples:
- PlanRecord
- DesignDecision
- CodePatchProposal
- RiskAssessment
- ReviewFinding
- DebugHypothesis
- DeployRecommendation
- IncidentAssessment

Free-form explanation may exist, but only alongside structured output.

## 10. Retry and escalation policy

When a role fails:
1. retry with same context only if failure is clearly transient,
2. expand or refresh context if evidence suggests missing information,
3. escalate to another role if the problem class changed,
4. request human input only when business ambiguity or approval is truly required.

The system must not loop endlessly.

## 11. Review model policy

Second-model review is required for:
- medium and high-risk changes,
- auth and permissions logic,
- destructive or schema-affecting changes,
- deployment to protected environments,
- code touching fragile areas tagged by memory packs,
- self-modification of the platform itself.

## 12. Operator controls

The operator shall be able to:
- choose role posture per mission,
- lock role/provider combinations,
- force review on selected actions,
- disable specific role autonomy,
- inspect role outputs and tool usage,
- compare role opinions when they disagree.

## 13. Failure modes

- role confusion,
- duplicated work across roles,
- missing handoff data,
- contradictory conclusions,
- model hallucinated tool results,
- over-eager escalation,
- silent context mismatch.

The system must log and surface these cases.

## 14. Acceptance criteria

This component is complete only when:
- missions are decomposed into explicit role-owned steps,
- roles have separate permissions and outputs,
- second-model review can be invoked automatically,
- operator can inspect routing decisions,
- the system no longer behaves like a single giant chat prompt.
