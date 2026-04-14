/**
 * CheckpointManager — creates and manages rollback checkpoints.
 *
 * Uses git stash and commit references to create rollback points
 * before risky modifications within isolated workspaces.
 */

import { execSync } from 'child_process';
import type { Checkpoint } from '../shared-types';

export class CheckpointManager {
  /**
   * Create a checkpoint by committing current state in the workspace.
   * Returns a Checkpoint record with the git ref.
   */
  createCheckpoint(
    workspaceRunId: string,
    worktreePath: string,
    label: string,
  ): Checkpoint {
    try {
      // Stage all changes
      execSync('git add -A', {
        cwd: worktreePath,
        stdio: 'pipe',
      });

      // Create a checkpoint commit
      const message = `checkpoint: ${label} (${new Date().toISOString()})`;
      execSync(`git commit -m "${message}"`, {
        cwd: worktreePath,
        stdio: 'pipe',
      });

      // Get the commit ref
      const gitRef = execSync('git rev-parse --short HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

      return {
        id: `cp-${Date.now()}-${label.replace(/\s+/g, '-').toLowerCase()}`,
        workspaceRunId,
        label,
        gitRef,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      // If commit fails (e.g. no changes), use current HEAD as checkpoint
      const gitRef = execSync('git rev-parse --short HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

      return {
        id: `cp-${Date.now()}-${label.replace(/\s+/g, '-').toLowerCase()}`,
        workspaceRunId,
        label,
        gitRef,
        createdAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Rollback to a checkpoint by resetting the workspace to the checkpoint ref.
   */
  rollbackToCheckpoint(worktreePath: string, checkpoint: Checkpoint): boolean {
    try {
      // Hard reset to the checkpoint ref
      execSync(`git reset --hard ${checkpoint.gitRef}`, {
        cwd: worktreePath,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a stash-based checkpoint for cases where we don't want to commit.
   */
  createStashCheckpoint(
    workspaceRunId: string,
    worktreePath: string,
    label: string,
  ): Checkpoint {
    try {
      execSync('git stash push -m "checkpoint: ' + label + '"', {
        cwd: worktreePath,
        stdio: 'pipe',
      });

      // Get the stash ref
      const gitRef = execSync('git stash list --format="%H" -1', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

      return {
        id: `cp-stash-${Date.now()}-${label.replace(/\s+/g, '-').toLowerCase()}`,
        workspaceRunId,
        label,
        gitRef,
        createdAt: new Date().toISOString(),
      };
    } catch {
      // Fallback: use HEAD
      const gitRef = execSync('git rev-parse --short HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

      return {
        id: `cp-stash-${Date.now()}-${label.replace(/\s+/g, '-').toLowerCase()}`,
        workspaceRunId,
        label,
        gitRef,
        createdAt: new Date().toISOString(),
      };
    }
  }
}
