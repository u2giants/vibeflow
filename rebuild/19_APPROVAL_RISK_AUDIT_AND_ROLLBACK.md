# Component 19: Approval, Risk, Audit, and Rollback

## 1. Purpose

This component determines what the system is allowed to do, when it must ask, how actions are recorded, and how recovery works.

## 2. Responsibilities

The component shall:
- classify actions by risk,
- attach required evidence bundles,
- request second-model or human approval,
- persist action history,
- create checkpoints,
- prepare rollback paths,
- support incident-driven rollback execution.

## 3. Risk classes

At minimum:
- informational,
- low risk,
- medium risk,
- high risk,
- destructive,
- privileged production.

Risk scoring must consider:
- subsystem touched,
- environment touched,
- data risk,
- auth/security impact,
- blast radius,
- reversibility,
- evidence completeness,
- service mutation scope.

## 4. Approval classes

### Auto
Only for truly low-impact, reversible actions with strong evidence.

### Second-model review
For medium-risk actions or ambiguous cases.

### Human approval
For high-risk, destructive, or protected-environment actions.

### Two-step human approval
For privileged production or destructive data actions if policy demands.

## 5. Audit record requirements

Every audited action must store:
- who/what initiated it,
- mission id,
- plan step,
- role,
- capability used,
- parameters,
- environment,
- evidence summary,
- approval chain,
- result,
- checkpoint id,
- rollback linkage.

## 6. Checkpoints and rollback

The system shall create checkpoints before:
- medium or higher risk code changes,
- dependency changes,
- migrations,
- deploys,
- service configuration changes,
- self-modification.

Rollback must be presented not as a last resort but as a first-class recovery option.

## 7. Rollback model

Rollback metadata shall include:
- target state,
- what changes will be reversed,
- what cannot be reversed,
- environment,
- data caveats,
- estimated downtime or impact,
- required approvals.

## 8. Operator UX

The user must be able to answer:
- why is this action risky?
- what evidence supports it?
- who reviewed it?
- what happens if I approve it?
- how do I undo it?

## 9. Acceptance criteria

This component is complete only when:
- risk classes are real and enforced,
- terminal and service mutations are not blanket-approved,
- approvals are structured,
- rollback points are visible,
- the user can inspect a trustworthy audit chain for any important action.
