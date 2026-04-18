/**
 * OrchestrationEngine — decomposes missions into plans, assigns roles,
 * executes steps, and manages retries/escalation.
 *
 * Component 12, Phase 3.
 *
 * This class is the brain of the multi-agent system. It:
 * - Decomposes a mission into structured plan steps via LLM
 * - Assigns each step to the appropriate role
 * - Executes steps using OpenRouterProvider for model calls
 * - Manages retry and escalation paths
 * - Produces structured outputs (PlanRecord, RoleAssignment, etc.)
 * - Calls the approval engine for approval checkpoints
 */

import type {
  Mission,
  Mode,
  PlanRecord,
  PlanStepRecord,
  RoleAssignment,
  OrchestrationState,
} from '../shared-types';
import { OpenRouterProvider, type OpenRouterStreamCallbacks } from '../providers/openrouter-provider';

// ── Internal types ─────────────────────────────────────────────────────

interface StepExecutionResult {
  success: boolean;
  output: string | null;
  error: string | null;
}

interface EscalationResult {
  escalated: boolean;
  reason: string;
  targetRole: string | null;
}

// ── Role routing map ───────────────────────────────────────────────────

/** Maps risk/task keywords to role slugs. */
const ROLE_ROUTING: Record<string, string> = {
  'architecture': 'architect',
  'design': 'architect',
  'structure': 'architect',
  'pattern': 'architect',
  'contract': 'architect',
  'implement': 'coder',
  'code': 'coder',
  'feature': 'coder',
  'fix': 'coder',
  'bug': 'debugger',
  'error': 'debugger',
  'debug': 'debugger',
  'investigate': 'debugger',
  'deploy': 'devops',
  'environment': 'devops',
  'infrastructure': 'devops',
  'review': 'reviewer',
  'quality': 'reviewer',
  'security': 'reviewer',
  'watch': 'watcher',
  'monitor': 'watcher',
  'incident': 'watcher',
};

/** Default role for unclassified steps. */
const DEFAULT_ROLE = 'orchestrator';

// ── Structured output parsing ──────────────────────────────────────────

/**
 * Parse a JSON block from an LLM response.
 * LLMs may return malformed JSON or wrap it in markdown code blocks.
 * Falls back to returning raw text with logging.
 */
function parseStructuredOutput<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    }
    // Find the first JSON object or array
    const jsonStart = cleaned.indexOf('{');
    if (jsonStart === -1) {
      console.warn('[OrchestrationEngine] No JSON object found in response, using fallback');
      return fallback;
    }
    const jsonStr = cleaned.slice(jsonStart);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.warn('[OrchestrationEngine] JSON parse failed, using fallback:', err);
    return fallback;
  }
}

// ── Prompts ────────────────────────────────────────────────────────────

const DECOMPOSE_PROMPT = `You are a mission planner. Decompose the following mission into a structured plan.

Return ONLY a JSON object with this exact shape (no markdown, no explanation):
{
  "missionSummary": "string",
  "assumptions": ["string"],
  "goals": ["string"],
  "nonGoals": ["string"],
  "affectedSubsystems": ["string"],
  "requiredContext": ["string"],
  "requiredCapabilities": ["string"],
  "riskClasses": ["string"],
  "requiredEvidence": ["string"],
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "title": "string",
      "description": "string",
      "riskLabel": "low|medium|high|null",
      "requiresApproval": false,
      "requiredEvidence": [],
      "expectedOutput": "string|null"
    }
  ],
  "approvalBoundaries": ["string"]
}

Mission: {{missionTitle}}
Operator Request: {{operatorRequest}}
{{projectContext}}`;

const ASSIGN_ROLE_PROMPT = `You are a role assignment engine. Given a step description, assign the most appropriate role.

Return ONLY a JSON object:
{
  "roleSlug": "string",
  "reasoning": "string"
}

Available roles: orchestrator, architect, coder, debugger, devops, reviewer, watcher

Step: {{stepTitle}}
Description: {{stepDescription}}
`;

// ── OrchestrationEngine ────────────────────────────────────────────────

export class OrchestrationEngine {
  private provider: OpenRouterProvider;
  private modes: Mode[];
  private state: OrchestrationState;
  private onStateChange?: (state: OrchestrationState) => void;

  constructor(
    apiKey: string,
    modes: Mode[],
    onStateChange?: (state: OrchestrationState) => void
  ) {
    this.provider = new OpenRouterProvider(apiKey);
    this.modes = modes;
    this.onStateChange = onStateChange;
    this.state = this.createInitialState();
  }

  /** Update the API key at runtime. */
  setApiKey(key: string): void {
    this.provider.setApiKey(key);
  }

  /** Get the current orchestration state. */
  getState(): OrchestrationState {
    return { ...this.state };
  }

  /**
   * Decompose a mission into a structured plan.
   * Calls the LLM with the decompose prompt and parses the response.
   */
  async decomposeMission(mission: Mission, projectContext?: string): Promise<PlanRecord> {
    this.updateState({
      status: 'planning',
      missionId: mission.id,
      error: null,
    });

    const orchestratorMode = this.modes.find(m => m.slug === 'orchestrator');
    if (!orchestratorMode) {
      throw new Error('Orchestrator mode not found');
    }

    const contextBlock = projectContext
      ? `\n\nProject Context:\n${projectContext}`
      : '';

    const prompt = DECOMPOSE_PROMPT
      .replace('{{missionTitle}}', mission.title)
      .replace('{{operatorRequest}}', mission.operatorRequest)
      .replace('{{projectContext}}', contextBlock);

    const fallbackPlan: PlanRecord = {
      missionId: mission.id,
      missionSummary: mission.operatorRequest,
      assumptions: [],
      goals: [mission.title],
      nonGoals: [],
      affectedSubsystems: [],
      requiredContext: [],
      requiredCapabilities: [],
      riskClasses: [],
      requiredEvidence: [],
      steps: [{
        id: 'step-1',
        order: 1,
        title: 'Execute mission',
        description: mission.operatorRequest,
        assignedRole: null,
        status: 'pending',
        riskLabel: null,
        requiresApproval: false,
        requiredEvidence: [],
        expectedOutput: null,
        actualOutput: null,
        error: null,
        retryCount: 0,
        maxRetries: 2,
      }],
      approvalBoundaries: [],
      createdAt: new Date().toISOString(),
    };

    let fullContent = '';
    await this.provider.stream(
      {
        model: orchestratorMode.modelId,
        systemPrompt: 'You are a mission planner. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxRetries: 1,
      },
      {
        onToken: () => {}, // Silent decomposition
        onDone: (content) => { fullContent = content; },
        onError: (error) => {
          console.warn('[OrchestrationEngine] Decompose stream error:', error);
        },
      }
    );

    const plan = parseStructuredOutput<PlanRecord>(fullContent, fallbackPlan);

    // Ensure all required fields exist
    const completePlan: PlanRecord = {
      missionId: plan.missionId ?? mission.id,
      missionSummary: plan.missionSummary ?? mission.operatorRequest,
      assumptions: plan.assumptions ?? [],
      goals: plan.goals ?? [],
      nonGoals: plan.nonGoals ?? [],
      affectedSubsystems: plan.affectedSubsystems ?? [],
      requiredContext: plan.requiredContext ?? [],
      requiredCapabilities: plan.requiredCapabilities ?? [],
      riskClasses: plan.riskClasses ?? [],
      requiredEvidence: plan.requiredEvidence ?? [],
      steps: (plan.steps ?? []).map((s, i) => ({
        id: s.id ?? `step-${i + 1}`,
        order: s.order ?? i + 1,
        title: s.title ?? `Step ${i + 1}`,
        description: s.description ?? '',
        assignedRole: null,
        status: 'pending' as const,
        riskLabel: s.riskLabel ?? null,
        requiresApproval: s.requiresApproval ?? false,
        requiredEvidence: s.requiredEvidence ?? [],
        expectedOutput: s.expectedOutput ?? null,
        actualOutput: null,
        error: null,
        retryCount: 0,
        maxRetries: 2,
      })),
      approvalBoundaries: plan.approvalBoundaries ?? [],
      createdAt: plan.createdAt ?? new Date().toISOString(),
    };

    this.updateState({
      currentPlan: completePlan,
      status: 'planning',
    });

    return completePlan;
  }

  /**
   * Assign a role to a plan step.
   * Uses keyword-based routing first, then LLM for ambiguous cases.
   */
  async assignRole(missionId: string, stepId: string): Promise<RoleAssignment> {
    const plan = this.state.currentPlan;
    if (!plan || plan.missionId !== missionId) {
      throw new Error(`No plan found for mission ${missionId}`);
    }

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`No step found with id ${stepId}`);
    }

    // Keyword-based routing first
    let roleSlug = this.routeByKeywords(step.title, step.description);

    // If keyword routing is uncertain, use LLM
    if (roleSlug === DEFAULT_ROLE) {
      roleSlug = await this.assignRoleViaLLM(step);
    }

    const mode = this.modes.find(m => m.slug === roleSlug);
    if (!mode) {
      console.warn(`[OrchestrationEngine] Mode not found for role ${roleSlug}, using orchestrator`);
    }

    const assignment: RoleAssignment = {
      id: `assignment-${stepId}-${Date.now()}`,
      missionId,
      stepId,
      roleSlug,
      roleName: mode?.name ?? roleSlug,
      modelId: mode?.modelId ?? '',
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    // Update step with assigned role
    step.assignedRole = roleSlug;

    // Add assignment to state
    this.state.roleAssignments.push(assignment);
    this.persistState();

    return assignment;
  }

  /**
   * Execute a plan step using the assigned role's model.
   */
  async executeStep(assignment: RoleAssignment): Promise<StepExecutionResult> {
    const plan = this.state.currentPlan;
    if (!plan) {
      return { success: false, output: null, error: 'No active plan' };
    }

    const step = plan.steps.find(s => s.id === assignment.stepId);
    if (!step) {
      return { success: false, output: null, error: `Step ${assignment.stepId} not found` };
    }

    const mode = this.modes.find(m => m.slug === assignment.roleSlug);
    if (!mode) {
      return { success: false, output: null, error: `Mode ${assignment.roleSlug} not found` };
    }

    // Update step status
    step.status = 'active';
    this.updateState({
      activeStepId: step.id,
      status: 'executing',
    });

    // Build the execution prompt
    const prompt = this.buildStepPrompt(plan, step);

    let fullContent = '';
    let streamError: string | null = null;

    await this.provider.stream(
      {
        model: mode.modelId,
        systemPrompt: mode.soul,
        messages: [{ role: 'user', content: prompt }],
        temperature: mode.temperature,
        maxRetries: 1,
      },
      {
        onToken: () => {}, // Tokens handled via events in Phase 4
        onDone: (content) => { fullContent = content; },
        onError: (error) => { streamError = error; },
      }
    );

    if (streamError) {
      step.status = 'failed';
      step.error = streamError;
      assignment.status = 'failed';
      assignment.error = streamError;
      this.persistState();
      return { success: false, output: null, error: streamError };
    }

    // Step completed successfully
    step.status = 'completed';
    step.actualOutput = fullContent;
    assignment.status = 'completed';
    assignment.completedAt = new Date().toISOString();

    // Update progress
    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    this.updateState({
      executionProgress: plan.steps.length > 0 ? completedSteps / plan.steps.length : 0,
      activeStepId: null,
    });

    this.persistState();
    return { success: true, output: fullContent, error: null };
  }

  /**
   * Retry a failed step.
   */
  async retryStep(assignment: RoleAssignment): Promise<StepExecutionResult> {
    const plan = this.state.currentPlan;
    if (!plan) {
      return { success: false, output: null, error: 'No active plan' };
    }

    const step = plan.steps.find(s => s.id === assignment.stepId);
    if (!step) {
      return { success: false, output: null, error: `Step ${assignment.stepId} not found` };
    }

    if (step.retryCount >= step.maxRetries) {
      return { success: false, output: null, error: `Max retries (${step.maxRetries}) exceeded` };
    }

    step.retryCount += 1;
    step.status = 'pending';
    step.error = null;
    assignment.status = 'assigned';
    assignment.error = null;
    this.persistState();

    return this.executeStep(assignment);
  }

  /**
   * Escalate a step to another role or to human.
   */
  async escalateStep(assignment: RoleAssignment): Promise<EscalationResult> {
    const plan = this.state.currentPlan;
    if (!plan) {
      return { escalated: false, reason: 'No active plan', targetRole: null };
    }

    const step = plan.steps.find(s => s.id === assignment.stepId);
    if (!step) {
      return { escalated: false, reason: `Step ${assignment.stepId} not found`, targetRole: null };
    }

    // Determine escalation target
    let targetRole: string | null = null;
    let reason = '';

    if (assignment.roleSlug === 'coder') {
      // Coder failures escalate to debugger
      targetRole = 'debugger';
      reason = 'Code execution failed, escalating to Debugger for investigation';
    } else if (assignment.roleSlug === 'debugger') {
      // Debugger failures escalate to orchestrator for human review
      targetRole = null; // null means human escalation
      reason = 'Debugging failed, requires human review';
    } else {
      // Default: escalate to orchestrator
      targetRole = 'orchestrator';
      reason = `Step failed in ${assignment.roleSlug}, escalating to Orchestrator`;
    }

    step.status = 'blocked';
    step.error = `Escalated: ${reason}`;
    assignment.status = 'escalated';
    assignment.error = reason;
    this.persistState();

    return { escalated: true, reason, targetRole };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private createInitialState(): OrchestrationState {
    return {
      missionId: null,
      currentPlan: null,
      activeStepId: null,
      roleAssignments: [],
      executionProgress: 0,
      status: 'idle',
      error: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private updateState(updates: Partial<OrchestrationState>): void {
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.onStateChange?.(this.state);
  }

  private persistState(): void {
    this.updateState({});
  }

  /** Route a step to a role based on keyword matching. */
  private routeByKeywords(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();

    for (const [keyword, role] of Object.entries(ROLE_ROUTING)) {
      if (text.includes(keyword)) {
        return role;
      }
    }

    return DEFAULT_ROLE;
  }

  /** Use LLM to assign a role for ambiguous steps. */
  private async assignRoleViaLLM(step: PlanStepRecord): Promise<string> {
    const orchestratorMode = this.modes.find(m => m.slug === 'orchestrator');
    if (!orchestratorMode) return DEFAULT_ROLE;

    const prompt = ASSIGN_ROLE_PROMPT
      .replace('{{stepTitle}}', step.title)
      .replace('{{stepDescription}}', step.description);

    let fullContent = '';
    await this.provider.stream(
      {
        model: orchestratorMode.modelId,
        systemPrompt: 'You are a role assignment engine. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxRetries: 0,
      },
      {
        onToken: () => {},
        onDone: (content) => { fullContent = content; },
        onError: () => {},
      }
    );

    const result = parseStructuredOutput<{ roleSlug: string }>(fullContent, { roleSlug: DEFAULT_ROLE });
    return result.roleSlug ?? DEFAULT_ROLE;
  }

  /** Build the execution prompt for a step. */
  private buildStepPrompt(plan: PlanRecord, step: PlanStepRecord): string {
    return `Execute the following step from mission plan:

Plan: ${plan.missionSummary}
Step: ${step.title}
Description: ${step.description}
Expected Output: ${step.expectedOutput ?? 'N/A'}

Proceed with the execution and provide the result.`;
  }
}
