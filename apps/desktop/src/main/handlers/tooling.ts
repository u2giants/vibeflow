/**
 * Tooling IPC handlers: files:*, terminal:*, git:*, ssh:*
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { TerminalRunArgs, GitCommitArgs, GitPushArgs, SshHost } from '../../lib/shared-types';
import { fileService, terminalService, gitService, sshService } from './state';

export function registerToolingHandlers(): void {
  // File handlers
  ipcMain.handle('files:read', (_event, filePath: string, projectRoot?: string) =>
    fileService.readFile(filePath, projectRoot));
  ipcMain.handle('files:write', (_event, filePath: string, content: string, projectRoot?: string) =>
    fileService.writeFile(filePath, content, projectRoot));
  ipcMain.handle('files:list', (_event, dirPath: string, projectRoot?: string) =>
    fileService.listDirectory(dirPath, projectRoot));
  ipcMain.handle('files:exists', (_event, filePath: string, projectRoot?: string) =>
    fileService.fileExists(filePath, projectRoot));

  // Terminal handlers
  ipcMain.handle('terminal:run', async (event, args: TerminalRunArgs) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return terminalService.runCommand(args.command, args.cwd, args.commandId, win);
  });
  ipcMain.handle('terminal:kill', (_event, commandId: string) =>
    terminalService.killCommand(commandId));

  // Git handlers
  ipcMain.handle('git:status', (_event, repoPath: string) => gitService.getStatus(repoPath));
  ipcMain.handle('git:diff', (_event, repoPath: string, staged: boolean = false) =>
    gitService.getDiff(repoPath, staged));
  ipcMain.handle('git:commit', (_event, args: GitCommitArgs) =>
    gitService.commit(args.repoPath, args.message));
  ipcMain.handle('git:push', async (event, args: GitPushArgs) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return gitService.push(args.repoPath, args.remote, args.branch, win);
  });
  ipcMain.handle('git:log', (_event, repoPath: string, limit: number = 10) =>
    gitService.getLog(repoPath, limit));

  // SSH handlers
  ipcMain.handle('ssh:discoverHosts', () => sshService.discoverHosts());
  ipcMain.handle('ssh:discoverKeys', () => sshService.discoverKeys());
  ipcMain.handle('ssh:testConnection', (_event, host: SshHost) =>
    sshService.testConnection(host));
}
