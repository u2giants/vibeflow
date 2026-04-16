/**
 * EvidenceCaptureEngine — central evidence recording and correlation service.
 *
 * Records evidence items, correlates them to missions/workspace runs,
 * stores to LocalDb, and supports before/after comparison generation.
 */

import type { EvidenceRecord, EvidenceItem, BeforeAfterComparison } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export class EvidenceCaptureEngine {
  private records: Map<string, EvidenceRecord> = new Map();

  constructor(private db: LocalDb) {}

  /** Record a new evidence item and persist it. */
  recordEvidence(record: EvidenceRecord): void {
    this.records.set(record.id, record);
    try {
      this.db.upsertEvidenceRecord(record);
    } catch (err) {
      console.error('[EvidenceCaptureEngine] Failed to persist evidence record:', err);
    }
  }

  /** Get all evidence records for a mission. */
  getEvidenceForMission(missionId: string): EvidenceRecord[] {
    try {
      return this.db.listEvidenceRecordsByMission(missionId);
    } catch {
      // Fallback to in-memory
      return Array.from(this.records.values()).filter((r) => r.missionId === missionId);
    }
  }

  /** Get all evidence records for a workspace run. */
  getEvidenceForWorkspaceRun(workspaceRunId: string): EvidenceRecord[] {
    try {
      return this.db.listEvidenceRecordsByWorkspaceRun(workspaceRunId);
    } catch {
      // Fallback to in-memory
      return Array.from(this.records.values()).filter((r) => r.workspaceRunId === workspaceRunId);
    }
  }

  /** Generate a before/after comparison between two evidence records. */
  compareBeforeAfter(beforeId: string, afterId: string): BeforeAfterComparison | null {
    const before = this.records.get(beforeId) ?? this.findRecordById(beforeId);
    const after = this.records.get(afterId) ?? this.findRecordById(afterId);

    if (!before || !after) return null;

    const comparison: BeforeAfterComparison = {
      id: `comparison-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      missionId: before.missionId,
      beforeEvidenceId: beforeId,
      afterEvidenceId: afterId,
      beforeArtifactPath: before.artifactPath,
      afterArtifactPath: after.artifactPath,
      differenceSummary: this.generateDifferenceSummary(before, after),
      createdAt: new Date().toISOString(),
    };

    // Record the comparison as evidence
    this.recordEvidence({
      id: comparison.id,
      missionId: comparison.missionId,
      workspaceRunId: before.workspaceRunId,
      planStepId: before.planStepId,
      changesetId: null,
      environmentId: null,
      capabilityInvocationId: null,
      type: 'before-after-comparison',
      status: after.status === 'pass' ? 'pass' : 'fail',
      title: `Before/after comparison: ${before.title} → ${after.title}`,
      detail: comparison.differenceSummary,
      artifactPath: null,
      timestamp: comparison.createdAt,
    });

    return comparison;
  }

  /** Convert an EvidenceRecord to an EvidenceItem for UI consumption. */
  toEvidenceItem(record: EvidenceRecord): EvidenceItem {
    return {
      id: record.id,
      missionId: record.missionId,
      type: record.type,
      status: record.status,
      title: record.title,
      detail: record.detail,
      timestamp: record.timestamp,
    };
  }

  private findRecordById(id: string): EvidenceRecord | null {
    for (const record of this.records.values()) {
      if (record.id === id) return record;
    }
    return null;
  }

  private generateDifferenceSummary(before: EvidenceRecord, after: EvidenceRecord): string {
    const parts: string[] = [];

    // Status change
    if (before.status !== after.status) {
      parts.push(`Status changed: ${before.status} → ${after.status}`);
    }

    // Type comparison
    if (before.type === 'screenshot' && after.type === 'screenshot' && before.artifactPath && after.artifactPath) {
      parts.push(`Screenshot comparison: ${before.artifactPath} vs ${after.artifactPath}`);
    }

    // Log comparison
    if (before.type === 'runtime-log' && after.type === 'runtime-log') {
      const beforeLines = (before.detail ?? '').split('\n').length;
      const afterLines = (after.detail ?? '').split('\n').length;
      parts.push(`Log output: ${beforeLines} lines → ${afterLines} lines`);
    }

    // Stack trace comparison
    if (before.type === 'stack-trace' && after.type !== 'stack-trace') {
      parts.push('Stack trace resolved — no longer present in after evidence');
    }

    if (parts.length === 0) {
      parts.push(`Evidence updated: ${before.title} → ${after.title}`);
    }

    return parts.join('\n');
  }
}
