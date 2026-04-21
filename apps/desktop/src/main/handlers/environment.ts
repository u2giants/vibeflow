/**
 * Environment IPC handlers: environment:*
 */

import { ipcMain } from 'electron';
import type { Environment, DeployWorkflow } from '../../lib/shared-types';
import { localDb, syncEngine } from './state';
import { EnvironmentManager } from '../../lib/environment-manager';

export function registerEnvironmentHandlers(): void {
  ipcMain.handle('environment:list', async (_event, projectId: string): Promise<Environment[]> => {
    if (!localDb) return [];
    const manager = new EnvironmentManager(localDb);
    return manager.listEnvironments(projectId);
  });

  ipcMain.handle('environment:get', async (_event, id: string): Promise<Environment | null> => {
    if (!localDb) return null;
    const manager = new EnvironmentManager(localDb);
    return manager.getEnvironment(id);
  });

  ipcMain.handle('environment:create', async (_event, env: Omit<Environment, 'id'>): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const created = manager.createEnvironment(env);
    syncEngine?.pushEnvironment(created).catch(err =>
      console.warn('[main] pushEnvironment (create) failed (non-fatal):', err)
    );
    return created;
  });

  ipcMain.handle('environment:update', async (_event, id: string, updates: Partial<Environment>): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const result = await manager.updateEnvironment(id, updates);
    if (!result) throw new Error(`Environment ${id} not found`);
    syncEngine?.pushEnvironment(result).catch(err =>
      console.warn('[main] pushEnvironment (update) failed (non-fatal):', err)
    );
    return result;
  });

  ipcMain.handle('environment:delete', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const manager = new EnvironmentManager(localDb);
    return { success: manager.deleteEnvironment(id) };
  });

  ipcMain.handle('environment:createPreview', async (_event, projectId: string, branch: string): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const preview = manager.createPreviewEnvironment(projectId, branch);
    syncEngine?.pushEnvironment(preview).catch(err =>
      console.warn('[main] pushEnvironment (preview) failed (non-fatal):', err)
    );
    return preview;
  });

  ipcMain.handle('environment:destroyPreview', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const manager = new EnvironmentManager(localDb);
    return { success: manager.destroyPreviewEnvironment(id) };
  });

  ipcMain.handle('environment:promote', async (_event, fromEnvId: string, toEnvId: string, candidateId: string): Promise<DeployWorkflow> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const result = manager.promote(fromEnvId, toEnvId, candidateId);
    if (!result) throw new Error('Promotion failed');
    return result;
  });
}
