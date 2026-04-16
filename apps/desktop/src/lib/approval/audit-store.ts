/**
 * AuditStore — SQLite-backed audit persistence for Component 19.
 *
 * Wraps LocalDb audit record CRUD operations and provides a clean API
 * for creating, updating, and querying audit records.
 */

import type { AuditRecord, RiskAssessment, RollbackPlan, Checkpoint } from '../shared-types';

/** Interface for the database dependency (LocalDb subset). */
export interface AuditDb {
  insertAuditRecord(record: AuditRecord): void;
  getAuditRecord(id: string): AuditRecord | null;
  listAuditRecords(filter?: { missionId?: string; limit?: number }): AuditRecord[];
  listAuditRecordsByRiskClass(riskClass: string): AuditRecord[];
  updateAuditResult(id: string, result: string, completedAt: string | null, durationMs: number | null): void;
  linkCheckpointToAudit(auditId: string, checkpointId: string): void;
  getCheckpointsForMission(missionId: string): Checkpoint[];
}

/** Input for creating a new audit record. */
export interface CreateAuditRecordInput {
  id: string;
  missionId: string | null;
  planStepId: string | null;
  roleSlug: string | null;
  capabilityId: string | null;
  actionType: string;
  parameters: Record<string, unknown>;
  environment: string | null;
  riskAssessment: RiskAssessment;
  evidenceSummary: string | null;
  initiatedBy: string;
}

/**
 * AuditStore class — wraps LocalDb for audit record operations.
 */
export class AuditStore {
  constructor(private db: AuditDb) {}

  /**
   * Create a new audit record with risk assessment.
   */
  createAuditRecord(input: CreateAuditRecordInput): AuditRecord {
    const record: AuditRecord = {
      id: input.id,
      missionId: input.missionId,
      planStepId: input.planStepId,
      roleSlug: input.roleSlug,
      capabilityId: input.capabilityId,
      actionType: input.actionType,
      parameters: input.parameters,
      environment: input.environment,
      riskAssessment: input.riskAssessment,
      evidenceSummary: input.evidenceSummary,
      approvalChain: [],
      result: 'approved', // default; updated after action execution
      checkpointId: null,
      rollbackPlan: null,
      initiatedBy: input.initiatedBy,
      initiatedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
    };

    this.db.insertAuditRecord(record);
    return record;
  }

  /**
   * Update the result of an audit record after action execution.
   */
  updateAuditResult(
    id: string,
    result: 'approved' | 'rejected' | 'escalated' | 'rolled-back',
    completedAt: string | null = new Date().toISOString(),
    durationMs: number | null = null,
  ): void {
    this.db.updateAuditResult(id, result, completedAt, durationMs);
  }

  /**
   * Link a checkpoint to an audit record.
   */
  linkCheckpoint(auditId: string, checkpointId: string): void {
    this.db.linkCheckpointToAudit(auditId, checkpointId);
  }

  /**
   * Query audit records with optional filters.
   */
  getHistory(filter?: { missionId?: string; limit?: number }): AuditRecord[] {
    return this.db.listAuditRecords(filter);
  }

  /**
   * Retrieve a single audit record by id.
   */
  getRecord(id: string): AuditRecord | null {
    return this.db.getAuditRecord(id);
  }

  /**
   * Get checkpoints for a mission (via audit record linkage).
   */
  getCheckpointsForMission(missionId: string): Checkpoint[] {
    return this.db.getCheckpointsForMission(missionId);
  }
}
