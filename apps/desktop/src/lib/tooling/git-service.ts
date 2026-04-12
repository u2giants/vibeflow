/** Git operations: status, diff, commit, push, log. Uses the local git binary. */

import { execSync, spawn } from 'child_process';
import type { BrowserWindow } from 'electron';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  isRepo: boolean;
}

export interface GitCommitResult {
  success: boolean;
  commitSha: string | null;
  error: string | null;
}

export class GitService {
  getStatus(repoPath: string): GitStatus {
    try {
      execSync('git rev-parse --git-dir', { cwd: repoPath, stdio: 'pipe' });
    } catch {
      return { branch: '', ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], isRepo: false };
    }

    try {
      const branch = execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf-8' }).trim();
      const statusOutput = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf-8' });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const line of statusOutput.split('\n').filter(Boolean)) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const file = line.slice(3);

        if (indexStatus !== ' ' && indexStatus !== '?') staged.push(file);
        if (workTreeStatus === 'M' || workTreeStatus === 'D') unstaged.push(file);
        if (indexStatus === '?' && workTreeStatus === '?') untracked.push(file);
      }

      return { branch, ahead: 0, behind: 0, staged, unstaged, untracked, isRepo: true };
    } catch {
      return { branch: 'unknown', ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], isRepo: true };
    }
  }

  getDiff(repoPath: string, staged: boolean = false): string {
    try {
      const flag = staged ? '--cached' : '';
      return execSync(`git diff ${flag}`, { cwd: repoPath, encoding: 'utf-8' });
    } catch {
      return '';
    }
  }

  commit(repoPath: string, message: string): GitCommitResult {
    try {
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoPath, stdio: 'pipe' });
      const sha = execSync('git rev-parse --short HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
      return { success: true, commitSha: sha, error: null };
    } catch (err) {
      return { success: false, commitSha: null, error: String(err) };
    }
  }

  push(
    repoPath: string,
    remote: string = 'origin',
    branch: string = 'main',
    window: BrowserWindow
  ): Promise<{ success: boolean; error: string | null }> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['push', remote, branch], { cwd: repoPath });

      proc.stdout.on('data', (data: Buffer) => {
        window.webContents.send('terminal:output', { commandId: 'git-push', text: data.toString(), stream: 'stdout' });
      });

      proc.stderr.on('data', (data: Buffer) => {
        window.webContents.send('terminal:output', { commandId: 'git-push', text: data.toString(), stream: 'stderr' });
      });

      proc.on('close', (code) => {
        resolve({ success: code === 0, error: code !== 0 ? `Exit code ${code}` : null });
      });
    });
  }

  getLog(repoPath: string, limit: number = 10): Array<{ sha: string; message: string; author: string; date: string }> {
    try {
      const output = execSync(
        `git log --oneline --format="%H|%s|%an|%ai" -${limit}`,
        { cwd: repoPath, encoding: 'utf-8' }
      );
      return output.split('\n').filter(Boolean).map(line => {
        const [sha, message, author, date] = line.split('|');
        return { sha: sha?.slice(0, 7) ?? '', message: message ?? '', author: author ?? '', date: date ?? '' };
      });
    } catch {
      return [];
    }
  }
}
