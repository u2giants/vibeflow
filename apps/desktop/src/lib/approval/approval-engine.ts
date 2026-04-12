/** Approval engine — classifies actions into tiers and runs second-model review. */

import type { Mode } from '../shared-types';

export type ApprovalTier = 1 | 2 | 3;

export type ActionType =
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'terminal:run'
  | 'git:commit'
  | 'git:push-main'
  | 'git:push-branch'
  | 'deploy:trigger'
  | 'deploy:restart'
  | 'deploy:stop'
  | 'ssh:connect';

export interface ActionRequest {
  id: string;
  description: string;        // Plain English: "Write changes to src/App.tsx"
  reason: string;             // Why: "The Coder Mode wants to implement the login feature"
  affectedResources: string[]; // Files, systems, URLs affected
  rollbackDifficulty: 'easy' | 'difficult' | 'impossible';
  requestingModeId: string;
  requestingModelId: string;
  conversationId: string;
  actionType: ActionType;
  payload: unknown;           // The actual action data
  createdAt: string;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'escalated';

export interface ApprovalResult {
  actionId: string;
  decision: ApprovalDecision;
  tier: ApprovalTier;
  reviewerModel: string | null;   // null for Tier 1 and human Tier 3
  reviewerReason: string | null;
  decidedAt: string;
}

// Classify an action into a tier
export function classifyAction(actionType: ActionType): ApprovalTier {
  const tier1: ActionType[] = ['file:read', 'terminal:run'];
  const tier3: ActionType[] = ['file:delete', 'git:push-main', 'deploy:trigger', 'deploy:restart', 'deploy:stop'];

  if (tier1.includes(actionType)) return 1;
  if (tier3.includes(actionType)) return 3;
  return 2; // Everything else is Tier 2
}

// Run second-model review for Tier 2 actions
export async function runSecondModelReview(
  action: ActionRequest,
  apiKey: string
): Promise<{ decision: 'approve' | 'escalate_to_human' | 'reject'; reason: string }> {
  const prompt = `You are a security reviewer for an AI coding assistant. Review this proposed action and decide if it should be approved automatically.

ACTION: ${action.description}
REASON: ${action.reason}
AFFECTED: ${action.affectedResources.join(', ')}
ROLLBACK: ${action.rollbackDifficulty}
REQUESTED BY: ${action.requestingModeId} mode

Respond with ONLY a JSON object: {"decision": "approve" | "escalate_to_human" | "reject", "reason": "brief explanation"}

Rules:
- approve: routine, safe, reversible actions
- escalate_to_human: unusual, risky, or irreversible actions
- reject: clearly dangerous or out-of-scope actions`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      // If second-model review fails, escalate to human
      return { decision: 'escalate_to_human', reason: 'Second-model review unavailable' };
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      return {
        decision: parsed.decision ?? 'escalate_to_human',
        reason: parsed.reason ?? 'No reason provided',
      };
    } catch {
      return { decision: 'escalate_to_human', reason: 'Could not parse reviewer response' };
    }
  } catch {
    return { decision: 'escalate_to_human', reason: 'Second-model review request failed' };
  }
}
