# @vibeflow/approval

## What This Package Does

This package implements the three-tier approval system: auto-allow, second-model review, and human approval. It classifies every proposed action into a tier, executes the appropriate review flow, and returns an approval decision with full audit logging.

## What It Exports

- `ApprovalEngine` — the main entry point; classifies an action and runs the appropriate tier
- `TierClassifier` — determines which tier (1, 2, or 3) an action belongs to
- `SecondModelReviewer` — sends a Tier 2 action to a fast cheap model for review
- `HumanApprovalQueue` — manages pending Tier 3 approvals waiting for human input
- `ApprovalAuditLogger` — logs every approval decision with full provenance
- `ApprovalPolicyManager` — reads and applies per-Mode approval policy overrides

## Who Depends On It

- `@vibeflow/core-orchestrator`
- `apps/desktop` renderer (approval card UI, approval queue in bottom panel)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/providers` (for second-model review calls)
- `@vibeflow/storage` (for audit log persistence)

## Notes

- The second-model reviewer uses a fast, cheap model (e.g., `google/gemini-flash-1.5`)
- Second-model review decisions are logged with the reviewer model name and reasoning
- Human approval cards are shown in the renderer via IPC events
- See `/docs/approval-policy.md` for the full tier definitions and examples
