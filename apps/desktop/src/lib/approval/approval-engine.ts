/**
 * Approval engine — classifies actions into tiers and runs second-model review.
 *
 * Component 19: Expanded with multi-dimensional risk assessment (assessRisk)
 * while preserving backward compatibility via classifyAction() wrapper.
 */

import type { Mode, RiskClass, RiskAssessment, RiskDimension } from '../shared-types';

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
  | 'ssh:connect'
  // Component 19: expanded action types
  | 'migration:run'
  | 'migration:rollback'
  | 'config:change'
  | 'secret:rotate'
  | 'service:restart'
  | 'service:stop'
  | 'deploy:rollback'
  | 'incident:acknowledge'
  | 'incident:remediate'
  // Component 17: environment and deploy workflow actions
  | 'deploy:promote'
  | 'deploy:canary'
  | 'env:create'
  | 'env:destroy'
  | 'env:drift-detect'
  | 'env:promote'
  // Component 21: watch and self-healing actions
  | 'watch:start'
  | 'watch:stop'
  | 'self-heal:restart'
  | 'self-heal:rerun-check'
  | 'self-heal:disable-probe'
  // Component 20: memory and decision actions
  | 'memory:write'
  | 'memory:retire'
  | 'memory:summarize'
  | 'skill:invoke'
  | 'decision:record';

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

export interface ClassifyActionOptions {
  isSelfMaintenance?: boolean;
  filePath?: string;
}

// ── Component 19: Risk Assessment Engine ─────────────────────────────

/** Input parameters for risk assessment. */
export interface AssessRiskInput {
  actionType: ActionType;
  environment?: string;
  dataRisk?: 'none' | 'read' | 'write' | 'delete';
  blastRadius?: 'low' | 'medium' | 'high' | 'critical';
  evidenceCompleteness?: 'complete' | 'partial' | 'missing';
  reversibility?: 'reversible' | 'partially-reversible' | 'irreversible';
  isSelfMaintenance?: boolean;
}

/** Risk class thresholds (overallScore boundaries). */
const RISK_THRESHOLDS: Record<RiskClass, { min: number; max: number }> = {
  'informational': { min: 0, max: 10 },
  'low': { min: 11, max: 30 },
  'medium': { min: 31, max: 50 },
  'high': { min: 51, max: 70 },
  'destructive': { min: 71, max: 90 },
  'privileged-production': { min: 91, max: 100 },
};

/**
 * Map a risk class to the legacy approval tier for backward compatibility.
 * - informational, low → Tier 1 (auto)
 * - medium → Tier 2 (second-model)
 * - high, destructive, privileged-production → Tier 3 (human)
 */
export function mapRiskClassToApprovalTier(riskClass: RiskClass): ApprovalTier {
  switch (riskClass) {
    case 'informational':
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
    case 'destructive':
    case 'privileged-production':
      return 3;
  }
}

/**
 * Assess risk for an action using multi-dimensional scoring.
 * Returns a RiskAssessment with risk class, overall score, and dimension breakdown.
 */
export function assessRisk(input: AssessRiskInput): RiskAssessment {
  const dimensions: RiskDimension[] = [];

  // 1. Subsystem dimension (what type of action)
  const subsystemScore = getSubsystemScore(input.actionType);
  dimensions.push(subsystemScore);

  // 2. Environment dimension
  const envScore = getEnvironmentScore(input.environment);
  dimensions.push(envScore);

  // 3. Data risk dimension
  const dataScore = getDataRiskScore(input.dataRisk);
  dimensions.push(dataScore);

  // 4. Blast radius dimension
  const blastScore = getBlastRadiusScore(input.blastRadius);
  dimensions.push(blastScore);

  // 5. Reversibility dimension
  const revScore = getReversibilityScore(input.reversibility);
  dimensions.push(revScore);

  // 6. Evidence completeness dimension
  const evidenceScore = getEvidenceScore(input.evidenceCompleteness);
  dimensions.push(evidenceScore);

  // Calculate weighted overall score (weights sum to 1.0)
  // Subsystem dominates to preserve backward compatibility with existing 3-tier behavior
  const weights: Record<string, number> = {
    subsystem: 0.70,
    environment: 0.05,
    dataRisk: 0.05,
    blastRadius: 0.05,
    reversibility: 0.05,
    evidence: 0.10,
  };

  let overallScore = 0;
  for (const dim of dimensions) {
    const weight = weights[dim.dimension] ?? 0.1;
    overallScore += (dim.score / dim.maxScore) * 100 * weight;
  }

  // Self-maintenance override: force higher risk for file mutations
  if (input.isSelfMaintenance &&
      (input.actionType === 'file:write' || input.actionType === 'file:delete')) {
    overallScore = Math.max(overallScore, 60); // at least 'high'
  }

  // Determine risk class from overall score
  let riskClass: RiskClass = 'informational';
  for (const [cls, thresholds] of Object.entries(RISK_THRESHOLDS)) {
    if (overallScore >= thresholds.min && overallScore <= thresholds.max) {
      riskClass = cls as RiskClass;
      break;
    }
  }

  // Determine reversibility label
  let reversibility: RiskAssessment['reversibility'] = 'reversible';
  if (input.reversibility === 'irreversible') {
    reversibility = 'irreversible';
  } else if (input.reversibility === 'partially-reversible') {
    reversibility = 'partially-reversible';
  } else if (input.actionType === 'file:delete' || input.actionType === 'deploy:stop') {
    reversibility = 'partially-reversible';
  }

  // Determine evidence completeness
  // Default to 'partial' for backward compatibility — 'missing' would inflate risk too much
  const evidenceCompleteness = input.evidenceCompleteness ?? 'partial';

  return {
    riskClass,
    overallScore: Math.round(overallScore),
    dimensions,
    evidenceCompleteness,
    reversibility,
  };
}

function getSubsystemScore(actionType: ActionType): RiskDimension {
  // Base scores for different action types
  const scores: Record<string, { score: number; maxScore: number; explanation: string }> = {
    'file:read': { score: 5, maxScore: 100, explanation: 'Read-only file access' },
    'file:write': { score: 30, maxScore: 100, explanation: 'File modification' },
    'file:delete': { score: 70, maxScore: 100, explanation: 'File deletion' },
    'terminal:run': { score: 25, maxScore: 100, explanation: 'Terminal command execution' },
    'git:commit': { score: 20, maxScore: 100, explanation: 'Git commit' },
    'git:push-main': { score: 60, maxScore: 100, explanation: 'Push to main branch' },
    'git:push-branch': { score: 20, maxScore: 100, explanation: 'Push to feature branch' },
    'deploy:trigger': { score: 55, maxScore: 100, explanation: 'Deploy trigger' },
    'deploy:restart': { score: 50, maxScore: 100, explanation: 'Service restart' },
    'deploy:stop': { score: 75, maxScore: 100, explanation: 'Service stop' },
    'ssh:connect': { score: 35, maxScore: 100, explanation: 'SSH connection' },
    // Component 19: new action types
    'migration:run': { score: 65, maxScore: 100, explanation: 'Database migration' },
    'migration:rollback': { score: 55, maxScore: 100, explanation: 'Migration rollback' },
    'config:change': { score: 40, maxScore: 100, explanation: 'Configuration change' },
    'secret:rotate': { score: 50, maxScore: 100, explanation: 'Secret rotation' },
    'service:restart': { score: 45, maxScore: 100, explanation: 'Service restart' },
    'service:stop': { score: 70, maxScore: 100, explanation: 'Service stop' },
    'deploy:rollback': { score: 60, maxScore: 100, explanation: 'Deploy rollback' },
    'incident:acknowledge': { score: 10, maxScore: 100, explanation: 'Incident acknowledgment' },
    'incident:remediate': { score: 55, maxScore: 100, explanation: 'Incident remediation' },
  };

  const s = scores[actionType] ?? { score: 30, maxScore: 100, explanation: `Unknown action: ${actionType}` };
  return { dimension: 'subsystem', score: s.score, maxScore: s.maxScore, explanation: s.explanation };
}

function getEnvironmentScore(environment?: string): RiskDimension {
  if (!environment) {
    return { dimension: 'environment', score: 10, maxScore: 100, explanation: 'No environment specified' };
  }
  const scores: Record<string, { score: number; explanation: string }> = {
    'local': { score: 10, explanation: 'Local environment' },
    'preview': { score: 20, explanation: 'Preview environment' },
    'staging': { score: 40, explanation: 'Staging environment' },
    'canary': { score: 50, explanation: 'Canary environment' },
    'production': { score: 80, explanation: 'Production environment' },
  };
  const s = scores[environment] ?? { score: 30, explanation: `Unknown environment: ${environment}` };
  return { dimension: 'environment', score: s.score, maxScore: 100, explanation: s.explanation };
}

function getDataRiskScore(dataRisk?: 'none' | 'read' | 'write' | 'delete'): RiskDimension {
  const scores: Record<string, { score: number; explanation: string }> = {
    'none': { score: 0, explanation: 'No data interaction' },
    'read': { score: 10, explanation: 'Read-only data access' },
    'write': { score: 50, explanation: 'Data modification' },
    'delete': { score: 80, explanation: 'Data deletion' },
  };
  const s = scores[dataRisk ?? 'none'];
  return { dimension: 'dataRisk', score: s.score, maxScore: 100, explanation: s.explanation };
}

function getBlastRadiusScore(blastRadius?: 'low' | 'medium' | 'high' | 'critical'): RiskDimension {
  const scores: Record<string, { score: number; explanation: string }> = {
    'low': { score: 10, explanation: 'Low blast radius' },
    'medium': { score: 40, explanation: 'Medium blast radius' },
    'high': { score: 70, explanation: 'High blast radius' },
    'critical': { score: 90, explanation: 'Critical blast radius' },
  };
  const s = scores[blastRadius ?? 'low'];
  return { dimension: 'blastRadius', score: s.score, maxScore: 100, explanation: s.explanation };
}

function getReversibilityScore(reversibility?: 'reversible' | 'partially-reversible' | 'irreversible'): RiskDimension {
  const scores: Record<string, { score: number; explanation: string }> = {
    'reversible': { score: 10, explanation: 'Fully reversible' },
    'partially-reversible': { score: 50, explanation: 'Partially reversible' },
    'irreversible': { score: 90, explanation: 'Irreversible' },
  };
  const s = scores[reversibility ?? 'reversible'];
  return { dimension: 'reversibility', score: s.score, maxScore: 100, explanation: s.explanation };
}

function getEvidenceScore(evidenceCompleteness?: 'complete' | 'partial' | 'missing'): RiskDimension {
  const scores: Record<string, { score: number; explanation: string }> = {
    'complete': { score: 10, explanation: 'Complete evidence' },
    'partial': { score: 50, explanation: 'Partial evidence' },
    'missing': { score: 90, explanation: 'Missing evidence' },
  };
  const s = scores[evidenceCompleteness ?? 'missing'];
  return { dimension: 'evidence', score: s.score, maxScore: 100, explanation: s.explanation };
}

// ── Backward Compatibility: classifyAction wrapper ───────────────────

/**
 * Classify an action into a legacy approval tier.
 * This is a thin wrapper around assessRisk() for backward compatibility.
 */
export function classifyAction(actionType: ActionType, options?: ClassifyActionOptions): ApprovalTier {
  const riskAssessment = assessRisk({
    actionType,
    isSelfMaintenance: options?.isSelfMaintenance,
  });
  return mapRiskClassToApprovalTier(riskAssessment.riskClass);
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
