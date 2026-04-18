/**
 * Approval IPC handlers: approval:*
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import keytar from 'keytar';
import { localDb, KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY } from './state';
import { getCurrentUserId } from './helpers';
import { classifyAction, runSecondModelReview, type ApprovalResult, type ApprovalTier } from '../../lib/approval/approval-engine';
import { logApprovalDecision, getRecentApprovals } from '../../lib/approval/approval-logger';
import type { ActionRequest, HumanDecisionArgs } from '../../lib/shared-types';

// Pending human approvals queue
const pendingHumanApprovals = new Map<string, {
  action: ActionRequest;
  resolve: (result: ApprovalResult) => void;
}>();

export function registerApprovalHandlers(): void {
  ipcMain.handle('approval:requestAction', async (event, action: ActionRequest): Promise<ApprovalResult> => {
    // Check if this conversation belongs to a self-maintenance project
    const conv = localDb?.getConversation(action.conversationId);
    const userId = await getCurrentUserId();
    const project = conv ? localDb?.listProjects(userId).find(p => p.id === conv.projectId) : null;
    const isSelfMaintenance = project?.isSelfMaintenance ?? false;

    const tier = classifyAction(action.actionType, { isSelfMaintenance });

    if (tier === 1) {
      // Auto-allow
      const result: ApprovalResult = {
        actionId: action.id,
        decision: 'approved',
        tier: 1,
        reviewerModel: null,
        reviewerReason: 'Auto-approved (safe action)',
        decidedAt: new Date().toISOString(),
      };
      logApprovalDecision(action, result);
      return result;
    }

    if (tier === 2) {
      // Second-model review
      const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
      if (!apiKey) {
        // No API key — escalate to human
        return requestHumanApproval(event, action, 2);
      }

      const review = await runSecondModelReview(action, apiKey);

      if (review.decision === 'approve') {
        const result: ApprovalResult = {
          actionId: action.id,
          decision: 'approved',
          tier: 2,
          reviewerModel: 'google/gemini-flash-1.5',
          reviewerReason: review.reason,
          decidedAt: new Date().toISOString(),
        };
        logApprovalDecision(action, result);
        // Notify renderer of the auto-approval for execution stream
        event.sender.send('approval:pendingApproval', { type: 'auto-approved', action, result });
        return result;
      }

      if (review.decision === 'reject') {
        const result: ApprovalResult = {
          actionId: action.id,
          decision: 'rejected',
          tier: 2,
          reviewerModel: 'google/gemini-flash-1.5',
          reviewerReason: review.reason,
          decidedAt: new Date().toISOString(),
        };
        logApprovalDecision(action, result);
        return result;
      }

      // escalate_to_human
      return requestHumanApproval(event, action, 2);
    }

    // Tier 3 — human approval required
    return requestHumanApproval(event, action, 3);
  });

  ipcMain.handle('approval:humanDecision', async (_event, args: HumanDecisionArgs): Promise<void> => {
    const pending = pendingHumanApprovals.get(args.actionId);
    if (!pending) return;

    pendingHumanApprovals.delete(args.actionId);

    const result: ApprovalResult = {
      actionId: args.actionId,
      decision: args.decision,
      tier: 3,
      reviewerModel: null,
      reviewerReason: args.note,
      decidedAt: new Date().toISOString(),
    };

    logApprovalDecision(pending.action, result);
    pending.resolve(result);
  });

  ipcMain.handle('approval:getQueue', () => {
    return Array.from(pendingHumanApprovals.values()).map(p => p.action);
  });

  ipcMain.handle('approval:getLog', () => getRecentApprovals(20));
}

function requestHumanApproval(event: IpcMainInvokeEvent, action: ActionRequest, tier: ApprovalTier): Promise<ApprovalResult> {
  return new Promise((resolve) => {
    pendingHumanApprovals.set(action.id, { action, resolve });
    // Send to renderer to show approval card
    event.sender.send('approval:pendingApproval', { type: 'human-required', action, tier });
  });
}
