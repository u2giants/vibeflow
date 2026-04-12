/** Approval logger — tracks approval decisions for the current session. */

import type { ApprovalResult, ActionRequest } from './approval-engine';

export interface ApprovalLogEntry {
  id: string;
  actionId: string;
  actionDescription: string;
  actionType: string;
  tier: number;
  decision: string;
  reviewerModel: string | null;
  reviewerReason: string | null;
  requestingModeId: string;
  requestingModelId: string;
  conversationId: string;
  decidedAt: string;
}

// In-memory log for the current session (persisted to SQLite in a future milestone)
const approvalLog: ApprovalLogEntry[] = [];

export function logApprovalDecision(action: ActionRequest, result: ApprovalResult): void {
  approvalLog.push({
    id: crypto.randomUUID(),
    actionId: action.id,
    actionDescription: action.description,
    actionType: action.actionType,
    tier: result.tier,
    decision: result.decision,
    reviewerModel: result.reviewerModel,
    reviewerReason: result.reviewerReason,
    requestingModeId: action.requestingModeId,
    requestingModelId: action.requestingModelId,
    conversationId: action.conversationId,
    decidedAt: result.decidedAt,
  });
}

export function getRecentApprovals(limit: number = 10): ApprovalLogEntry[] {
  return approvalLog.slice(-limit).reverse();
}
