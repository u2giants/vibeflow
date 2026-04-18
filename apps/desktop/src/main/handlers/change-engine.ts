/**
 * Change Engine IPC handlers: changeEngine:*
 */

import { ipcMain } from 'electron';
import type { CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs } from '../../lib/shared-types';
import { changeEngine } from './state';

export function registerChangeEngineHandlers(): void {
  ipcMain.handle('changeEngine:createWorkspaceRun', async (_event, args: CreateWorkspaceRunArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.createWorkspaceRun(args.missionId, args.planStepId, args.projectRoot);
  });

  ipcMain.handle('changeEngine:applyPatch', async (_event, args: ApplyPatchArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.applyPatch(args.workspaceRunId, {
      filePath: args.filePath,
      operation: args.operation,
      newContent: args.newContent,
      rationale: args.rationale,
    });
  });

  ipcMain.handle('changeEngine:getChangeSet', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getChangeSet(workspaceRunId);
  });

  ipcMain.handle('changeEngine:runValidityChecks', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.runValidityChecks(workspaceRunId);
  });

  ipcMain.handle('changeEngine:createCheckpoint', async (_event, workspaceRunId: string, label: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.createCheckpoint(workspaceRunId, label);
  });

  ipcMain.handle('changeEngine:rollbackToCheckpoint', async (_event, checkpointId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.rollbackToCheckpoint(checkpointId);
  });

  ipcMain.handle('changeEngine:getSemanticGroups', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getSemanticGroups(workspaceRunId);
  });

  ipcMain.handle('changeEngine:getDuplicateWarnings', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getDuplicateWarnings(workspaceRunId);
  });

  ipcMain.handle('changeEngine:commitWorkspace', async (_event, args: CommitWorkspaceArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.commitWorkspace(args.workspaceRunId, args.message);
  });

  ipcMain.handle('changeEngine:cleanupWorkspace', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.cleanupWorkspace(workspaceRunId);
  });

  ipcMain.handle('changeEngine:listWorkspaceRuns', async (_event, missionId?: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.listWorkspaceRuns(missionId);
  });

  ipcMain.handle('changeEngine:listCheckpoints', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.listCheckpoints(workspaceRunId);
  });
}
