/**
 * ChangeEngine — core orchestrator for isolated code changes.
 *
 * Manages workspace runs, patch application, validity checks,
 * semantic grouping, checkpoints, and change set assembly.
 * Wraps existing FileService, GitService, and TerminalService.
 */

import { WorkspaceManager } from './workspace-manager';
import { PatchApplier, type PatchEdit } from './patch-applier';
import { ValidityPipeline } from './validity-pipeline';
import { SemanticGrouper } from './semantic-grouper';
import { DuplicateDetector } from './duplicate-detector';
import { CheckpointManager } from './checkpoint-manager';
import { GitService } from '../tooling/git-service';
import type {
  WorkspaceRun,
  FileEdit,
  SemanticChangeGroup,
  Checkpoint,
  ChangeSet,
  DuplicateWarning,
  EvidenceItem,
  GitCommitResult,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export class ChangeEngine {
  private workspaceManager = new WorkspaceManager();
  private patchApplier = new PatchApplier();
  private validityPipeline = new ValidityPipeline();
  private semanticGrouper = new SemanticGrouper();
  private duplicateDetector = new DuplicateDetector();
  private checkpointManager = new CheckpointManager();
  private gitService = new GitService();

  constructor(private localDb: LocalDb) {}

  /**
   * Create an isolated workspace run for a mission plan step.
   * Uses git worktree (preferred) or branch fallback.
   */
  createWorkspaceRun(
    missionId: string,
    planStepId: string,
    projectRoot: string,
  ): WorkspaceRun {
    const branchName = `vf-change-${missionId.slice(0, 8)}-${Date.now()}`;
    const { worktreePath, method } = this.workspaceManager.createWorktree(
      projectRoot,
      branchName,
    );

    const run: WorkspaceRun = {
      id: `wr-${Date.now()}-${missionId.slice(0, 8)}`,
      missionId,
      planStepId,
      projectRoot,
      worktreePath,
      branchName,
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    this.localDb.upsertWorkspaceRun(run);
    return run;
  }

  /**
   * Apply a patch (file edit) within a workspace run.
   * Runs immediate validity checks after application.
   */
  applyPatch(
    workspaceRunId: string,
    patch: PatchEdit,
  ): FileEdit {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) {
      throw new Error(`Workspace run not found: ${workspaceRunId}`);
    }

    // Apply the edit
    const fileEdit = this.patchApplier.applyEdit(run.worktreePath, patch);
    fileEdit.workspaceRunId = workspaceRunId;

    // Run immediate validity checks on the affected file
    const validityResults = this.validityPipeline.runMinimalValidationSet(
      [patch.filePath],
      run.worktreePath,
    );
    fileEdit.validityResults = validityResults;

    // Persist
    this.localDb.upsertFileEdit(fileEdit);

    return fileEdit;
  }

  /**
   * Get the assembled change set for a workspace run.
   * Includes semantic groups, blast radius, verification state, and duplicate warnings.
   */
  getChangeSet(workspaceRunId: string): ChangeSet | null {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) return null;

    const fileEdits = this.localDb.listFileEdits(workspaceRunId);
    const semanticGroups = this.localDb.listSemanticChangeGroups(workspaceRunId);
    const duplicateWarnings = this.localDb.listDuplicateWarnings(workspaceRunId);
    const checkpoints = this.localDb.listCheckpoints(workspaceRunId);

    // Aggregate verification state from all file edits
    const verificationState: EvidenceItem[] = [];
    for (const edit of fileEdits) {
      verificationState.push(...edit.validityResults);
    }

    // Compute overall blast radius (highest from any group)
    const blastRadiusOrder = ['low', 'medium', 'high', 'critical'] as const;
    let blastRadius: ChangeSet['blastRadius'] = 'low';
    for (const group of semanticGroups) {
      const groupIdx = blastRadiusOrder.indexOf(group.blastRadius);
      const currentIdx = blastRadiusOrder.indexOf(blastRadius);
      if (groupIdx > currentIdx) {
        blastRadius = group.blastRadius;
      }
    }

    // Collect affected contracts
    const affectedContracts = semanticGroups.flatMap(g => g.affectedContracts);

    // Build summary
    const summary = `${fileEdits.length} file${fileEdits.length !== 1 ? 's' : ''} changed across ${semanticGroups.length} group${semanticGroups.length !== 1 ? 's' : ''}`;

    const changeSet: ChangeSet = {
      id: `cs-${workspaceRunId}-${Date.now()}`,
      workspaceRunId,
      missionId: run.missionId,
      planStepId: run.planStepId,
      summary,
      rationale: `Changes for mission ${run.missionId}, step ${run.planStepId}`,
      fileEdits,
      semanticGroups,
      affectedContracts,
      blastRadius,
      verificationState,
      rollbackCheckpointId: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].id : null,
      duplicateWarnings,
      createdAt: new Date().toISOString(),
    };

    this.localDb.upsertChangeSet(changeSet);
    return changeSet;
  }

  /**
   * Run validity checks for a workspace run.
   */
  runValidityChecks(workspaceRunId: string): EvidenceItem[] {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) return [];

    const fileEdits = this.localDb.listFileEdits(workspaceRunId);
    const affectedFiles = fileEdits.map(e => e.filePath);

    return this.validityPipeline.runMinimalValidationSet(
      affectedFiles,
      run.worktreePath,
    );
  }

  /**
   * Create a checkpoint before risky modifications.
   */
  createCheckpoint(workspaceRunId: string, label: string): Checkpoint {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) {
      throw new Error(`Workspace run not found: ${workspaceRunId}`);
    }

    const checkpoint = this.checkpointManager.createCheckpoint(
      workspaceRunId,
      run.worktreePath,
      label,
    );

    this.localDb.upsertCheckpoint(checkpoint);
    return checkpoint;
  }

  /**
   * Rollback to a checkpoint.
   */
  rollbackToCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.localDb.getCheckpoint(checkpointId);
    if (!checkpoint) return false;

    const run = this.localDb.getWorkspaceRun(checkpoint.workspaceRunId);
    if (!run) return false;

    const success = this.checkpointManager.rollbackToCheckpoint(
      run.worktreePath,
      checkpoint,
    );

    return success;
  }

  /**
   * Get semantic groups for a workspace run.
   */
  getSemanticGroups(workspaceRunId: string): SemanticChangeGroup[] {
    return this.localDb.listSemanticChangeGroups(workspaceRunId);
  }

  /**
   * Get duplicate warnings for a workspace run.
   */
  getDuplicateWarnings(workspaceRunId: string): DuplicateWarning[] {
    return this.localDb.listDuplicateWarnings(workspaceRunId);
  }

  /**
   * Commit changes in a workspace and return the commit result.
   */
  commitWorkspace(workspaceRunId: string, message: string): GitCommitResult {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) {
      throw new Error(`Workspace run not found: ${workspaceRunId}`);
    }

    const result = this.gitService.commit(run.worktreePath, message);

    if (result.success) {
      run.status = 'committed';
      run.completedAt = new Date().toISOString();
      this.localDb.upsertWorkspaceRun(run);
    }

    return result;
  }

  /**
   * Clean up a workspace run (remove worktree, update status).
   */
  cleanupWorkspace(workspaceRunId: string): boolean {
    const run = this.localDb.getWorkspaceRun(workspaceRunId);
    if (!run) return false;

    this.workspaceManager.removeWorktree(run.worktreePath, run.projectRoot);

    run.status = 'cleaned-up';
    run.completedAt = new Date().toISOString();
    this.localDb.upsertWorkspaceRun(run);

    return true;
  }

  /**
   * List workspace runs, optionally filtered by mission.
   */
  listWorkspaceRuns(missionId?: string): WorkspaceRun[] {
    return this.localDb.listWorkspaceRuns(missionId);
  }

  /**
   * List checkpoints for a workspace run.
   */
  listCheckpoints(workspaceRunId: string): Checkpoint[] {
    return this.localDb.listCheckpoints(workspaceRunId);
  }
}
