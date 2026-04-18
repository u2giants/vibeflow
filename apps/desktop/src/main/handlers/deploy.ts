/**
 * Deploy IPC handlers: deploy:*
 */

import { ipcMain } from 'electron';
import type { DeployInitiateArgs, DeployWorkflow } from '../../lib/shared-types';
import { localDb } from './state';
import { CoolifyClient } from '../../lib/devops/coolify-client';
import { DeployEngine } from '../../lib/deploy-engine';

export function registerDeployHandlers(): void {
  ipcMain.handle('deploy:initiate', async (_event, args: DeployInitiateArgs): Promise<DeployWorkflow> => {
    if (!localDb) throw new Error('Database not initialized');
    const coolifyClient = new CoolifyClient('', ''); // API key from keytar in production
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.initiateDeploy(args.candidateId, args.environmentId, args.projectId);
  });

  ipcMain.handle('deploy:getStatus', async (_event, workflowId: string): Promise<DeployWorkflow | null> => {
    if (!localDb) return null;
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.getStatus(workflowId);
  });

  ipcMain.handle('deploy:getHistory', async (_event, projectId: string): Promise<DeployWorkflow[]> => {
    if (!localDb) return [];
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.getHistory(projectId);
  });

  ipcMain.handle('deploy:rollback', async (_event, workflowId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!localDb) return { success: false, error: 'Database not initialized' };
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.rollback(workflowId);
  });
}
