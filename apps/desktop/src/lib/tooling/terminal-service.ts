/** Terminal operations: run commands with streaming output, kill processes. */

import { spawn, type ChildProcess } from 'child_process';
import type { BrowserWindow } from 'electron';

export interface TerminalCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class TerminalService {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  runCommand(
    command: string,
    cwd: string,
    commandId: string,
    window: BrowserWindow
  ): Promise<TerminalCommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      const proc = spawn(shell, [shellFlag, command], {
        cwd,
        env: process.env,
      });

      this.activeProcesses.set(commandId, proc);

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        window.webContents.send('terminal:output', { commandId, text, stream: 'stdout' });
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        window.webContents.send('terminal:output', { commandId, text, stream: 'stderr' });
      });

      proc.on('close', (code) => {
        this.activeProcesses.delete(commandId);
        const result: TerminalCommandResult = {
          command,
          exitCode: code ?? -1,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
        };
        window.webContents.send('terminal:done', { commandId, result });
        resolve(result);
      });

      proc.on('error', (err) => {
        this.activeProcesses.delete(commandId);
        reject(err);
      });
    });
  }

  killCommand(commandId: string): void {
    const proc = this.activeProcesses.get(commandId);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(commandId);
    }
  }
}
