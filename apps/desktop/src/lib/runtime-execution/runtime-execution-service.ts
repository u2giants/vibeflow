/**
 * RuntimeExecutionService — wraps TerminalService for evidence capture.
 *
 * Starts/stops local runtimes (dev servers, build processes), captures stdout/stderr,
 * stores execution results with mission/workspace run linkage, and emits evidence items.
 */

import { spawn, type ChildProcess } from 'child_process';
import type { BrowserWindow } from 'electron';
import type { RuntimeExecution, EvidenceRecord } from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import type { EvidenceCaptureEngine } from './evidence-capture-engine';

export class RuntimeExecutionService {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private executions: Map<string, RuntimeExecution> = new Map();

  constructor(
    private db: LocalDb,
    private evidenceEngine: EvidenceCaptureEngine
  ) {}

  /** Start a runtime (dev server, build, etc.) and begin capturing output. */
  async start(
    args: {
      missionId: string;
      workspaceRunId: string;
      planStepId: string | null;
      command: string;
      cwd: string;
    },
    window: BrowserWindow
  ): Promise<RuntimeExecution> {
    const executionId = `exec-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();

    const execution: RuntimeExecution = {
      id: executionId,
      workspaceRunId: args.workspaceRunId,
      missionId: args.missionId,
      planStepId: args.planStepId,
      command: args.command,
      cwd: args.cwd,
      status: 'running',
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      startedAt,
      completedAt: null,
    };

    this.executions.set(executionId, execution);

    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const shellFlag = process.platform === 'win32' ? '/c' : '-c';

    const proc = spawn(shell, [shellFlag, args.command], {
      cwd: args.cwd,
      env: process.env,
    });

    this.activeProcesses.set(executionId, proc);

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.stdout += text;
      }
      window.webContents.send('runtime:output', { executionId, text, stream: 'stdout' });
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.stderr += text;
      }
      window.webContents.send('runtime:output', { executionId, text, stream: 'stderr' });
    });

    proc.on('close', (code) => {
      this.activeProcesses.delete(executionId);
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = code === 0 ? 'completed' : 'failed';
        exec.exitCode = code ?? -1;
        exec.completedAt = new Date().toISOString();
        exec.durationMs = Date.now() - new Date(exec.startedAt).getTime();
        this.persistExecution(exec);
        this.captureExecutionEvidence(exec);
      }
      window.webContents.send('runtime:done', { executionId, result: this.executions.get(executionId) });
    });

    proc.on('error', (err) => {
      this.activeProcesses.delete(executionId);
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = 'failed';
        exec.stderr += `\nError: ${err.message}`;
        exec.completedAt = new Date().toISOString();
        exec.durationMs = Date.now() - new Date(exec.startedAt).getTime();
        this.persistExecution(exec);
        this.captureExecutionEvidence(exec);
      }
      window.webContents.send('runtime:error', { executionId, error: err.message });
    });

    // Persist initial execution record
    this.persistExecution(execution);

    return execution;
  }

  /** Stop a running runtime. */
  async stop(executionId: string): Promise<void> {
    const proc = this.activeProcesses.get(executionId);
    const exec = this.executions.get(executionId);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(executionId);
    }
    if (exec) {
      exec.status = 'killed';
      exec.completedAt = new Date().toISOString();
      exec.durationMs = Date.now() - new Date(exec.startedAt).getTime();
      this.persistExecution(exec);
      this.captureExecutionEvidence(exec);
    }
  }

  /** Get current execution status. */
  getStatus(executionId: string): RuntimeExecution | null {
    return this.executions.get(executionId) ?? null;
  }

  /** Get execution history for a mission. */
  getExecutions(missionId: string): RuntimeExecution[] {
    return Array.from(this.executions.values()).filter((e) => e.missionId === missionId);
  }

  /** Get captured logs for an execution. */
  getLogs(executionId: string): { stdout: string; stderr: string } {
    const exec = this.executions.get(executionId);
    return {
      stdout: exec?.stdout ?? '',
      stderr: exec?.stderr ?? '',
    };
  }

  private persistExecution(exec: RuntimeExecution): void {
    try {
      this.db.upsertRuntimeExecution({
        id: exec.id,
        workspaceRunId: exec.workspaceRunId,
        missionId: exec.missionId,
        planStepId: exec.planStepId,
        command: exec.command,
        cwd: exec.cwd,
        status: exec.status,
        exitCode: exec.exitCode,
        stdout: exec.stdout,
        stderr: exec.stderr,
        durationMs: exec.durationMs,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
      });
    } catch (err) {
      console.error('[RuntimeExecutionService] Failed to persist execution:', err);
    }
  }

  private captureExecutionEvidence(exec: RuntimeExecution): void {
    // Capture stdout/stderr as runtime-log evidence
    if (exec.stdout) {
      this.evidenceEngine.recordEvidence({
        id: `evidence-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        missionId: exec.missionId,
        workspaceRunId: exec.workspaceRunId,
        planStepId: exec.planStepId,
        changesetId: null,
        environmentId: null,
        capabilityInvocationId: null,
        type: 'runtime-log',
        status: exec.status === 'completed' ? 'pass' : 'fail',
        title: `Runtime output: ${exec.command}`,
        detail: exec.stdout.length > 2000 ? exec.stdout.slice(0, 2000) + '... (truncated)' : exec.stdout,
        artifactPath: null,
        timestamp: exec.completedAt ?? new Date().toISOString(),
      });
    }

    // Capture stderr as stack-trace evidence if it contains error patterns
    if (exec.stderr) {
      const hasError = /error|exception|stack trace|fatal/i.test(exec.stderr);
      this.evidenceEngine.recordEvidence({
        id: `evidence-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        missionId: exec.missionId,
        workspaceRunId: exec.workspaceRunId,
        planStepId: exec.planStepId,
        changesetId: null,
        environmentId: null,
        capabilityInvocationId: null,
        type: hasError ? 'stack-trace' : 'runtime-log',
        status: 'fail',
        title: `Runtime error: ${exec.command}`,
        detail: exec.stderr.length > 2000 ? exec.stderr.slice(0, 2000) + '... (truncated)' : exec.stderr,
        artifactPath: null,
        timestamp: exec.completedAt ?? new Date().toISOString(),
      });
    }
  }
}
