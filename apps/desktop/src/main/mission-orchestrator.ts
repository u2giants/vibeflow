/**
 * MissionOrchestrator — 18-step lifecycle coordinator (MVP: Steps 1–11).
 *
 * This is a coordinator class, not a service. It calls existing injected
 * services in sequence and persists MissionLifecycleState before every
 * await so that crashes are recoverable.
 *
 * Phase 2 of mission lifecycle wiring.
 */

import type { WebContents } from 'electron';
import type { LocalDb } from '../lib/storage/local-db';
import type { OrchestrationEngine } from '../lib/orchestrator/orchestration-engine';
import type { ChangeEngine } from '../lib/change-engine/change-engine';
import type { VerificationEngine } from '../lib/verification/verification-engine';
import type { ContextPackAssembler } from '../lib/project-intelligence/context-pack-assembler';
import { PatchEdit } from '../lib/change-engine/patch-applier';
import {
  assessRisk,
  classifyAction,
  mapRiskClassToApprovalTier,
  type ActionRequest,
  type ApprovalResult,
  type ApprovalTier,
} from '../lib/approval/approval-engine';
import type {
  Mission,
  MissionLifecycleState,
  PlanRecord,
  RiskAssessment,
} from '../lib/shared-types';

// ── Types ──────────────────────────────────────────────────────────────

interface PendingApproval {
  resolve: (approved: boolean) => void;
}

// ── MissionOrchestrator ────────────────────────────────────────────────

export class MissionOrchestrator {
  /** Map of missionId → pending approval resolver for step 7 suspension. */
  private pendingApprovals = new Map<string, PendingApproval>();

  /** Set of missionIds for which cancel() has been called. */
  private cancelledMissions = new Set<string>();

  constructor(
    private localDb: LocalDb,
    private orchestrationEngine: OrchestrationEngine,
    private changeEngine: ChangeEngine,
    private verificationEngine: VerificationEngine,
    private contextPackAssembler: ContextPackAssembler | null,
    private webContents: WebContents,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Run the full mission lifecycle from step 1 through 11 (MVP),
   * with stubs for steps 12–18.
   */
  async run(missionId: string): Promise<void> {
    let currentStep = 1;
    let workspaceRunId: string | null = null;
    let verificationRunId: string | null = null;
    let riskAssessment: RiskAssessment | null = null;

    try {
      // ── Step 1–2: Mission record already created by caller ─────────
      // The IPC handler (missions:start) has already created the Mission row
      // and called insertMission(). We just load it here.
      currentStep = 1;
      this.persistLifecycleState(missionId, currentStep, 'running', null, null, null);

      const mission = this.localDb.getMission(missionId);
      if (!mission) {
        throw new Error(`Mission ${missionId} not found in local DB`);
      }

      if (this.isCancelled(missionId)) return;

      // ── Step 3: Decompose mission into plan ─────────────────────────
      currentStep = 3;
      this.persistLifecycleState(missionId, currentStep, 'running', null, null, null);
      this.localDb.updateMission(missionId, { status: 'planning' });

      const plan: PlanRecord = await this.orchestrationEngine.decomposeMission(mission);

      // Persist plan as a Plan record (map PlanRecord → Plan shape).
      // PlanStep.status does not include 'failed' so we coerce it.
      const now = new Date().toISOString();
      this.localDb.upsertPlan({
        missionId: plan.missionId,
        steps: plan.steps.map(s => ({
          id: s.id,
          missionId: plan.missionId,
          order: s.order,
          title: s.title,
          description: s.description,
          status: (
            s.status === 'failed' ? 'blocked' : s.status
          ) as 'pending' | 'active' | 'blocked' | 'completed' | 'skipped',
          requiredCapabilities: [] as string[],
          riskLabel: s.riskLabel,
          requiredEvidence: s.requiredEvidence,
          expectedOutput: s.expectedOutput,
        })),
        createdAt: plan.createdAt ?? now,
        updatedAt: now,
      });

      this.sendToRenderer('mission:planReady', { missionId, plan });

      if (this.isCancelled(missionId)) return;

      // ── Step 4: Assemble context pack ───────────────────────────────
      currentStep = 4;
      this.persistLifecycleState(missionId, currentStep, 'running', null, null, null);

      if (this.contextPackAssembler) {
        const pack = this.contextPackAssembler.assemble(missionId, {
          includeMemory: true,
          missionTitle: mission.title,
          operatorRequest: mission.operatorRequest,
        });
        // Build a lightweight dashboard from the pack
        const dashboard = {
          packId: pack.id,
          totalItems: pack.items.length,
          tokenUsage: pack.tokenUsage,
          warningCount: pack.warnings.length,
        };
        this.sendToRenderer('mission:contextReady', { missionId, pack, dashboard });
      } else {
        console.warn('[MissionOrchestrator] contextPackAssembler not available — skipping step 4');
      }

      if (this.isCancelled(missionId)) return;

      // ── Step 5: Impact analysis (surfaced via plan affectedSubsystems) ─
      // ImpactAnalyzer is called internally by ContextPackAssembler.
      // We surface affectedSubsystems from the plan here as a log entry.
      console.log(
        `[MissionOrchestrator] Step 5 — affected subsystems: ${plan.affectedSubsystems.join(', ') || 'none'}`
      );

      if (this.isCancelled(missionId)) return;

      // ── Step 6: Risk classification ─────────────────────────────────
      currentStep = 6;
      this.persistLifecycleState(missionId, currentStep, 'running', null, null, null);

      // Build an ActionRequest from the plan metadata for risk assessment
      const riskActionRequest: ActionRequest = {
        id: `risk-${missionId}-${Date.now()}`,
        description: `Mission: ${mission.title}`,
        reason: mission.operatorRequest,
        affectedResources: plan.affectedSubsystems,
        rollbackDifficulty: 'difficult',
        requestingModeId: 'orchestrator',
        requestingModelId: '',
        conversationId: '',
        actionType: 'file:write',
        payload: { riskClasses: plan.riskClasses },
        createdAt: new Date().toISOString(),
      };

      riskAssessment = assessRisk({
        actionType: riskActionRequest.actionType,
        blastRadius:
          plan.riskClasses.some(r => r === 'destructive' || r === 'high')
            ? 'high'
            : plan.riskClasses.some(r => r === 'medium')
            ? 'medium'
            : 'low',
        evidenceCompleteness: 'partial',
        reversibility: 'reversible',
      });

      // Persist the risk assessment into lifecycle state
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, null, null);

      if (this.isCancelled(missionId)) return;

      // ── Step 7: Approval gate ───────────────────────────────────────
      currentStep = 7;
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, null, null);

      const approvalTier: ApprovalTier = mapRiskClassToApprovalTier(riskAssessment.riskClass);

      if (approvalTier === 3) {
        // Tier 3: suspend and wait for human decision
        this.localDb.updateMission(missionId, { status: 'paused' });
        this.persistLifecycleState(missionId, currentStep, 'awaiting-approval', riskAssessment, null, null);

        this.sendToRenderer('mission:awaitingApproval', {
          missionId,
          action: riskActionRequest,
          tier: approvalTier,
        });

        const approved = await this.waitForApproval(missionId);

        if (!approved || this.isCancelled(missionId)) {
          this.localDb.updateMission(missionId, { status: 'cancelled' });
          this.persistLifecycleState(missionId, currentStep, 'failed', riskAssessment, null, null);
          this.sendToRenderer('mission:failed', {
            missionId,
            reason: 'Approval rejected by human reviewer',
            step: currentStep,
          });
          return;
        }

        // Approved — resume
        this.localDb.updateMission(missionId, { status: 'running' });
        this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, null, null);
      }
      // Tier 1 and 2: auto-approve (tier 2 second-model review is deferred to full IPC flow)

      if (this.isCancelled(missionId)) return;

      // ── Steps 8–9: Workspace changes ────────────────────────────────
      currentStep = 8;
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, null, null);
      this.localDb.updateMission(missionId, { status: 'running' });

      // Find coder steps — steps where role is 'coder' or default to first step
      const coderSteps = plan.steps.filter(
        s => s.assignedRole === 'coder' || s.assignedRole === null
      );
      const stepsToExecute = coderSteps.length > 0 ? coderSteps : plan.steps.slice(0, 1);

      const allFileEdits: import('../lib/shared-types').FileEdit[] = [];

      for (const planStep of stepsToExecute) {
        if (this.isCancelled(missionId)) return;

        // Create workspace run
        const projectRoot = process.cwd();
        const workspaceRun = this.changeEngine.createWorkspaceRun(
          missionId,
          planStep.id,
          projectRoot,
        );
        workspaceRunId = workspaceRun.id;
        this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, workspaceRunId, null);

        // Assign role for this step via orchestration engine
        let assignment: import('../lib/shared-types').RoleAssignment | null = null;
        try {
          assignment = await this.orchestrationEngine.assignRole(missionId, planStep.id);
        } catch (err) {
          console.warn(`[MissionOrchestrator] assignRole failed for step ${planStep.id}:`, err);
        }

        if (!assignment) {
          console.warn(`[MissionOrchestrator] No assignment for step ${planStep.id} — skipping execution`);
          continue;
        }

        // Execute the step (step 8 proper: get coder output)
        const execResult = await this.orchestrationEngine.executeStep(assignment);

        if (!execResult.success || !execResult.output) {
          console.warn(
            `[MissionOrchestrator] Step execution failed for ${planStep.id}: ${execResult.error}`
          );
          continue;
        }

        // Step 9: parse output as patch and apply via ChangeEngine.
        // The coder's actualOutput is expected to be a JSON patch payload or
        // a description string. We build a minimal PatchEdit from it.
        const patch: PatchEdit = this.buildPatchFromOutput(execResult.output, planStep.id);

        try {
          const fileEdit = this.changeEngine.applyPatch(workspaceRunId, patch);
          allFileEdits.push(fileEdit);
        } catch (err) {
          console.warn(`[MissionOrchestrator] applyPatch failed for step ${planStep.id}:`, err);
        }
      }

      if (workspaceRunId) {
        this.sendToRenderer('mission:workspaceProgress', {
          missionId,
          workspaceRunId,
          fileEdits: allFileEdits,
        });
      }

      if (this.isCancelled(missionId)) return;

      // ── Step 10: Verification ────────────────────────────────────────
      currentStep = 10;
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, workspaceRunId, null);

      const riskClassForVerif: 'low' | 'medium' | 'high' | 'destructive' =
        riskAssessment.riskClass === 'privileged-production'
          ? 'destructive'
          : riskAssessment.riskClass === 'informational'
          ? 'low'
          : (riskAssessment.riskClass as 'low' | 'medium' | 'high' | 'destructive');

      const verificationRun = await this.verificationEngine.runVerification({
        missionId,
        workspaceRunId: workspaceRunId ?? undefined,
        riskClass: riskClassForVerif,
        riskAssessment,
      });

      verificationRunId = verificationRun.id;
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, workspaceRunId, verificationRunId);

      // Handle verification verdict
      if (verificationRun.verdict === 'block') {
        this.localDb.updateMission(missionId, { status: 'failed' });
        this.persistLifecycleState(missionId, currentStep, 'blocked', riskAssessment, workspaceRunId, verificationRunId);
        this.sendToRenderer('mission:failed', {
          missionId,
          reason: verificationRun.verdictReason ?? 'Verification blocked',
          step: currentStep,
        });
        return;
      }

      if (verificationRun.verdict === 'needs-review') {
        this.localDb.updateMission(missionId, { status: 'paused' });
        this.persistLifecycleState(missionId, currentStep, 'awaiting-approval', riskAssessment, workspaceRunId, verificationRunId);
        this.sendToRenderer('mission:awaitingApproval', {
          missionId,
          action: {
            id: `verif-review-${missionId}`,
            description: 'Verification needs human review',
            reason: verificationRun.verdictReason ?? '',
            affectedResources: [],
            rollbackDifficulty: 'difficult' as const,
            requestingModeId: 'orchestrator',
            requestingModelId: '',
            conversationId: '',
            actionType: 'file:write' as const,
            payload: verificationRun,
            createdAt: new Date().toISOString(),
          },
          tier: 3,
        });
        // Wait for reviewer decision
        const reviewApproved = await this.waitForApproval(missionId);
        if (!reviewApproved || this.isCancelled(missionId)) {
          this.localDb.updateMission(missionId, { status: 'cancelled' });
          this.persistLifecycleState(missionId, currentStep, 'failed', riskAssessment, workspaceRunId, verificationRunId);
          this.sendToRenderer('mission:failed', {
            missionId,
            reason: 'Needs-review approval rejected',
            step: currentStep,
          });
          return;
        }
        this.localDb.updateMission(missionId, { status: 'running' });
        this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, workspaceRunId, verificationRunId);
      }

      if (this.isCancelled(missionId)) return;

      // ── Step 11: Change set assembly ─────────────────────────────────
      currentStep = 11;
      this.persistLifecycleState(missionId, currentStep, 'running', riskAssessment, workspaceRunId, verificationRunId);

      const changeSet = workspaceRunId
        ? this.changeEngine.getChangeSet(workspaceRunId)
        : null;

      this.sendToRenderer('mission:verificationComplete', {
        missionId,
        run: verificationRun,
        changeSet,
      });

      if (this.isCancelled(missionId)) return;

      // ── Steps 12–18: Deploy / Watch / Self-Healing (stub) ──────────
      console.log('[MissionOrchestrator] Steps 12–18 not yet implemented — setting mission to completed');
      this.localDb.updateMission(missionId, { status: 'completed' });
      this.persistLifecycleState(missionId, 18, 'completed', riskAssessment, workspaceRunId, verificationRunId);

      this.sendToRenderer('mission:completed', {
        missionId,
        summary: 'Mission completed (steps 12–18 pending implementation)',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MissionOrchestrator] Mission ${missionId} failed at step ${currentStep}:`, err);

      try {
        this.localDb.updateMission(missionId, { status: 'failed' });
        this.persistLifecycleState(missionId, currentStep, 'failed', riskAssessment, workspaceRunId, verificationRunId);
      } catch (persistErr) {
        console.error('[MissionOrchestrator] Failed to persist error state:', persistErr);
      }

      this.sendToRenderer('mission:failed', {
        missionId,
        reason: message,
        step: currentStep,
      });
    }
  }

  /**
   * Resolve a pending approval suspension.
   * Called when the human approves or rejects via the UI.
   */
  resolveApproval(missionId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(missionId);
    if (!pending) {
      console.warn(`[MissionOrchestrator] resolveApproval: no pending approval for mission ${missionId}`);
      return;
    }
    this.pendingApprovals.delete(missionId);
    pending.resolve(approved);
  }

  /**
   * Cancel a running mission.
   * The run() loop checks isCancelled() before each major step.
   */
  cancel(missionId: string): void {
    this.cancelledMissions.add(missionId);
    // If suspended at an approval gate, resolve it as rejected so run() exits
    const pending = this.pendingApprovals.get(missionId);
    if (pending) {
      this.pendingApprovals.delete(missionId);
      pending.resolve(false);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /** Persist lifecycle state before each async boundary. */
  private persistLifecycleState(
    missionId: string,
    currentStep: number,
    lifecycleStatus: MissionLifecycleState['lifecycleStatus'],
    riskAssessment: RiskAssessment | null,
    workspaceRunId: string | null,
    verificationRunId: string | null,
  ): void {
    const state: MissionLifecycleState = {
      missionId,
      currentStep,
      lifecycleStatus,
      riskAssessment,
      workspaceRunId,
      verificationRunId,
      deployWorkflowId: null,
      watchSessionId: null,
      updatedAt: new Date().toISOString(),
    };
    try {
      this.localDb.upsertMissionLifecycleState(state);
    } catch (err) {
      console.error('[MissionOrchestrator] Failed to persist lifecycle state:', err);
    }
  }

  /** Suspend execution until resolveApproval() is called for this mission. */
  private waitForApproval(missionId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(missionId, { resolve });
    });
  }

  /** Check if this mission has been cancelled. */
  private isCancelled(missionId: string): boolean {
    return this.cancelledMissions.has(missionId);
  }

  /**
   * Send an IPC push event to the renderer.
   * Guards against destroyed WebContents.
   */
  private sendToRenderer(channel: string, payload: unknown): void {
    if (this.webContents.isDestroyed()) {
      console.warn(`[MissionOrchestrator] WebContents destroyed — cannot send ${channel}`);
      return;
    }
    this.webContents.send(channel, payload);
  }

  /**
   * Build a minimal PatchEdit from a coder step's actualOutput string.
   *
   * The coder LLM returns a text description or JSON patch payload.
   * We attempt to parse it as JSON first; if that fails we treat the
   * output as file content for a default scratch file.
   */
  private buildPatchFromOutput(output: string, stepId: string): PatchEdit {
    // Try to parse as a JSON PatchEdit
    try {
      const cleaned = output.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(cleaned.slice(jsonStart)) as Partial<PatchEdit>;
        if (parsed.filePath && parsed.operation) {
          return {
            filePath: parsed.filePath,
            operation: parsed.operation,
            newContent: parsed.newContent ?? null,
            rationale: parsed.rationale ?? `Step ${stepId} output`,
          };
        }
      }
    } catch {
      // Fall through to default
    }

    // Fallback: treat as raw content for a generated file
    return {
      filePath: `generated/${stepId}.txt`,
      operation: 'create',
      newContent: output,
      rationale: `Auto-generated from step ${stepId} output`,
    };
  }
}
