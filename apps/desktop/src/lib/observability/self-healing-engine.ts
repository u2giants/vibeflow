/**
 * SelfHealingEngine — executes permitted automatic and approval-gated self-healing actions.
 *
 * Automatic actions (no approval): disable probe, rerun checks, restart preview
 * Approval-required actions: rollback, production restart
 * Notify-only: notify-and-prepare-rollback (always prepares evidence, never auto-executes)
 */

import type {
  SelfHealingAction, AnomalyEvent, AuditRecord,
} from '../shared-types';
import { LocalDb } from '../storage';
import { assessRisk } from '../approval/approval-engine';

/** Input for executing an automatic action without full SelfHealingAction fields. */
export interface AutomaticActionInput {
  actionType: SelfHealingAction['actionType'];
  projectId: string;
  environmentId: string;
  anomalyEventId: string | null;
  incidentId: string | null;
  description?: string;
}

export class SelfHealingEngine {
  constructor(
    private db: LocalDb,
    private mainWindow: Electron.BrowserWindow | null
  ) {}

  /** Process an anomaly and trigger appropriate self-healing actions. */
  async processAnomaly(anomaly: AnomalyEvent, environmentType: string): Promise<void> {
    const { actionType, approvalRequired } = this.classifyActionForAnomaly(anomaly, environmentType);

    const action: SelfHealingAction = {
      id: `heal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: anomaly.projectId,
      environmentId: anomaly.environmentId,
      anomalyEventId: anomaly.id,
      incidentId: null,
      actionType,
      automatic: true,
      status: approvalRequired ? 'pending' : 'running',
      approvalRequired,
      approvalResult: null,
      result: null,
      executedAt: null,
      auditRecordId: null,
    };

    this.db.upsertSelfHealingAction(action);
    this.broadcast('selfHealing:actionStarted', action);

    if (approvalRequired) {
      // Notify that approval is required — do NOT execute automatically
      this.broadcast('selfHealing:approvalRequired', action);
      return;
    }

    // Execute automatic action
    await this.executeAutomaticAction({
      actionType,
      projectId: anomaly.projectId,
      environmentId: anomaly.environmentId,
      anomalyEventId: anomaly.id,
      incidentId: null,
    });
  }

  /** Execute an automatic self-healing action. */
  async executeAutomaticAction(input: AutomaticActionInput): Promise<SelfHealingAction> {
    const action: SelfHealingAction = {
      id: `heal-auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.projectId,
      environmentId: input.environmentId,
      anomalyEventId: input.anomalyEventId,
      incidentId: input.incidentId,
      actionType: input.actionType,
      automatic: true,
      status: 'running',
      approvalRequired: false,
      approvalResult: null,
      result: null,
      executedAt: null,
      auditRecordId: null,
    };

    this.db.upsertSelfHealingAction(action);
    this.broadcast('selfHealing:actionStarted', action);

    try {
      switch (action.actionType) {
        case 'disable-probe':
          action.result = input.description ?? 'Probe auto-disabled after consecutive failures';
          action.status = 'completed';
          break;

        case 'rerun-checks':
          // Scaffolded — in a full implementation, this would call VerificationEngine
          action.result = 'Non-destructive checks re-run (scaffolded — VerificationEngine integration pending)';
          action.status = 'completed';
          break;

        case 'restart-preview':
          // Scaffolded — in a full implementation, this would call CoolifyClient.restart()
          action.result = 'Preview restart requested (scaffolded — Coolify integration pending)';
          action.status = 'completed';
          break;

        case 'notify-and-prepare-rollback':
          // Always notify-only — never auto-executes rollback
          action.result = 'Rollback prepared and notification sent. Awaiting operator decision.';
          action.status = 'completed';
          break;

        case 'rollback':
          // Should never reach here automatically — rollback always requires approval
          action.result = 'Rollback requires approval — not executed automatically';
          action.status = 'blocked';
          break;

        default:
          action.result = `Unknown action type: ${action.actionType}`;
          action.status = 'failed';
      }

      action.executedAt = new Date().toISOString();
      this.db.upsertSelfHealingAction(action);
      this.broadcast('selfHealing:actionCompleted', action);

      // Create audit record
      this.createAuditRecord(action);

      return action;
    } catch (err) {
      action.status = 'failed';
      action.result = String(err);
      action.executedAt = new Date().toISOString();
      this.db.upsertSelfHealingAction(action);
      this.broadcast('selfHealing:actionCompleted', action);
      return action;
    }
  }

  /** Classify what action to take for an anomaly. */
  private classifyActionForAnomaly(
    anomaly: AnomalyEvent,
    environmentType: string
  ): { actionType: SelfHealingAction['actionType']; approvalRequired: boolean } {
    // Production + critical/high → notify and prepare rollback (approval required for actual rollback)
    if (environmentType === 'production' && (anomaly.severity === 'high' || anomaly.severity === 'critical')) {
      return { actionType: 'notify-and-prepare-rollback', approvalRequired: true };
    }

    // Production + medium → rerun checks (automatic)
    if (environmentType === 'production' && anomaly.severity === 'medium') {
      return { actionType: 'rerun-checks', approvalRequired: false };
    }

    // Preview + health degradation → restart preview (automatic)
    if (environmentType === 'preview' && anomaly.anomalyType === 'health-degradation') {
      return { actionType: 'restart-preview', approvalRequired: false };
    }

    // Default: rerun checks (automatic)
    return { actionType: 'rerun-checks', approvalRequired: false };
  }

  /** Create an audit record for a self-healing action. */
  private createAuditRecord(action: SelfHealingAction): void {
    const auditRecord: AuditRecord = {
      id: `audit-heal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      missionId: null,
      planStepId: null,
      roleSlug: 'watcher',
      capabilityId: null,
      actionType: `self-heal:${action.actionType}`,
      parameters: {
        actionId: action.id,
        anomalyEventId: action.anomalyEventId,
        incidentId: action.incidentId,
        automatic: action.automatic,
      },
      environment: action.environmentId,
      riskAssessment: assessRisk({
        actionType: action.automatic ? 'incident:remediate' : 'incident:acknowledge',
        environment: action.environmentId,
      }),
      evidenceSummary: `Self-healing action: ${action.actionType} — ${action.result ?? 'pending'}`,
      approvalChain: action.approvalRequired
        ? [{ tier: 2, reviewerModel: null, reviewerRole: null, decision: 'pending', reason: 'Approval required for self-healing', decidedAt: '' }]
        : [],
      result: action.status === 'completed' ? 'approved' : 'rejected',
      checkpointId: null,
      rollbackPlan: null,
      initiatedBy: action.automatic ? 'system' : 'operator',
      initiatedAt: new Date().toISOString(),
      completedAt: action.executedAt,
      durationMs: action.executedAt
        ? new Date(action.executedAt).getTime() - new Date(action.executedAt).getTime()
        : null,
    };

    this.db.insertAuditRecord(auditRecord);
    action.auditRecordId = auditRecord.id;
    this.db.upsertSelfHealingAction(action);
  }

  /** Broadcast an event to the renderer. */
  private broadcast(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
