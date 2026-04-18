/**
 * Runtime IPC handlers: runtime:*, browser:*
 */

import { ipcMain } from 'electron';
import type { RuntimeStartArgs, RuntimeExecution, BrowserSessionArgs, BrowserSession } from '../../lib/shared-types';
import { runtimeService, browserService, mainWindow } from './state';

export function registerRuntimeHandlers(): void {
  // ── Component 15: Runtime Execution IPC ──────────────────────────────────

  ipcMain.handle('runtime:start', async (_event, args: RuntimeStartArgs): Promise<RuntimeExecution> => {
    if (!runtimeService || !mainWindow) throw new Error('Runtime service not initialized');
    return runtimeService.start({
      missionId: args.missionId,
      workspaceRunId: args.workspaceRunId,
      planStepId: args.planStepId,
      command: args.command,
      cwd: args.cwd,
    }, mainWindow);
  });

  ipcMain.handle('runtime:stop', async (_event, executionId: string): Promise<void> => {
    if (!runtimeService) throw new Error('Runtime service not initialized');
    await runtimeService.stop(executionId);
  });

  ipcMain.handle('runtime:getStatus', async (_event, executionId: string): Promise<RuntimeExecution | null> => {
    if (!runtimeService) return null;
    return runtimeService.getStatus(executionId);
  });

  ipcMain.handle('runtime:getExecutions', async (_event, missionId: string): Promise<RuntimeExecution[]> => {
    if (!runtimeService) return [];
    return runtimeService.getExecutions(missionId);
  });

  ipcMain.handle('runtime:getLogs', async (_event, executionId: string): Promise<{ stdout: string; stderr: string }> => {
    if (!runtimeService) return { stdout: '', stderr: '' };
    return runtimeService.getLogs(executionId);
  });

  // ── Component 15: Browser Automation IPC ─────────────────────────────────

  ipcMain.handle('browser:startSession', async (_event, args: BrowserSessionArgs): Promise<BrowserSession> => {
    if (!browserService) throw new Error('Browser service not initialized');
    return browserService.startSession({
      missionId: args.missionId,
      workspaceRunId: args.workspaceRunId,
      planStepId: args.planStepId,
      baseUrl: args.baseUrl,
    });
  });

  ipcMain.handle('browser:navigate', async (_event, sessionId: string, url: string): Promise<void> => {
    if (!browserService) throw new Error('Browser service not initialized');
    await browserService.navigate(sessionId, url);
  });

  ipcMain.handle('browser:click', async (_event, sessionId: string, selector: string): Promise<void> => {
    if (!browserService) throw new Error('Browser service not initialized');
    await browserService.click(sessionId, selector);
  });

  ipcMain.handle('browser:fillForm', async (_event, sessionId: string, fields: Record<string, string>): Promise<void> => {
    if (!browserService) throw new Error('Browser service not initialized');
    await browserService.fillForm(sessionId, fields);
  });

  ipcMain.handle('browser:uploadFile', async (_event, sessionId: string, selector: string, filePath: string): Promise<void> => {
    if (!browserService) throw new Error('Browser service not initialized');
    await browserService.uploadFile(sessionId, selector, filePath);
  });

  ipcMain.handle('browser:screenshot', async (_event, sessionId: string, name: string): Promise<{ path: string }> => {
    if (!browserService) throw new Error('Browser service not initialized');
    return browserService.screenshot(sessionId, name);
  });

  ipcMain.handle('browser:getConsoleLogs', async (_event, sessionId: string): Promise<string> => {
    if (!browserService) throw new Error('Browser service not initialized');
    return browserService.getConsoleLogs(sessionId);
  });

  ipcMain.handle('browser:getNetworkTraces', async (_event, sessionId: string): Promise<string> => {
    if (!browserService) throw new Error('Browser service not initialized');
    return browserService.getNetworkTraces(sessionId);
  });

  ipcMain.handle('browser:getDomSnapshot', async (_event, sessionId: string, selector: string): Promise<string> => {
    if (!browserService) throw new Error('Browser service not initialized');
    return browserService.getDomSnapshot(sessionId, selector);
  });

  ipcMain.handle('browser:closeSession', async (_event, sessionId: string): Promise<void> => {
    if (!browserService) throw new Error('Browser service not initialized');
    await browserService.closeSession(sessionId);
  });
}
