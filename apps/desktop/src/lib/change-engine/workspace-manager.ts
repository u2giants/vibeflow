/**
 * WorkspaceManager — git worktree/branch lifecycle for isolated code changes.
 *
 * Prefers git worktrees for true filesystem isolation. Falls back to
 * branch-only isolation when worktrees are unavailable (e.g. Windows quirks).
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';

export interface WorktreeInfo {
  path: string;
  branch: string;
  isBare: boolean;
  isLocked: boolean;
}

export class WorkspaceManager {
  /**
   * Create a git worktree for isolated work. Falls back to branch creation
   * if worktrees fail on this platform.
   */
  createWorktree(
    projectRoot: string,
    branchName: string,
  ): { worktreePath: string; method: 'worktree' | 'branch' } {
    const worktreePath = path.join(os.tmpdir(), `vf-wt-${Date.now()}-${branchName}`);

    try {
      // Try worktree first
      execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
      return { worktreePath, method: 'worktree' };
    } catch {
      // Fallback: create branch in-place
      try {
        execSync(`git checkout -b "${branchName}"`, {
          cwd: projectRoot,
          stdio: 'pipe',
        });
      } catch {
        // Branch may already exist — just checkout
        execSync(`git checkout "${branchName}"`, {
          cwd: projectRoot,
          stdio: 'pipe',
        });
      }
      return { worktreePath: projectRoot, method: 'branch' };
    }
  }

  /** Create a new branch without a worktree (branch-only isolation). */
  createBranch(projectRoot: string, branchName: string): void {
    try {
      execSync(`git checkout -b "${branchName}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch {
      // Branch may already exist
      execSync(`git checkout "${branchName}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    }
  }

  /** Checkout a branch in the given directory. */
  checkout(worktreePath: string, branchName: string): void {
    execSync(`git checkout "${branchName}"`, {
      cwd: worktreePath,
      stdio: 'pipe',
    });
  }

  /** List all worktrees for a project. */
  getWorktreeList(projectRoot: string): WorktreeInfo[] {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: projectRoot,
        encoding: 'utf-8',
      });
      const worktrees: WorktreeInfo[] = [];
      let current: Partial<WorktreeInfo> = {};

      for (const line of output.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) worktrees.push(current as WorktreeInfo);
          current = { path: line.slice(9).trim() };
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice(7).trim();
        } else if (line === 'bare') {
          current.isBare = true;
        } else if (line === 'locked') {
          current.isLocked = true;
        }
      }
      if (current.path) worktrees.push(current as WorktreeInfo);
      return worktrees;
    } catch {
      return [];
    }
  }

  /** Remove a worktree. No-op if the path is the project root (branch mode). */
  removeWorktree(worktreePath: string, projectRoot: string): void {
    if (worktreePath === projectRoot) return; // branch mode — nothing to remove
    try {
      execSync(`git worktree remove "${worktreePath}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch {
      // Already removed or never existed
    }
  }

  /** Get the current branch name in a directory. */
  getCurrentBranch(dir: string): string {
    try {
      return execSync('git branch --show-current', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  /** Get the current HEAD commit SHA (short). */
  getCurrentRef(dir: string): string {
    try {
      return execSync('git rev-parse --short HEAD', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'no-commits';
    }
  }
}
