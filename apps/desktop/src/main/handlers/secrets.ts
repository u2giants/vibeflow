/**
 * Secrets IPC handlers: secrets:*
 */

import { ipcMain } from 'electron';
import type { SecretRecord } from '../../lib/shared-types';
import { localDb } from './state';

export function registerSecretsHandlers(): void {
  ipcMain.handle('secrets:list', async (_event, projectId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.listSecretRecords(projectId);
  });

  ipcMain.handle('secrets:get', async (_event, id: string): Promise<SecretRecord | null> => {
    if (!localDb) return null;
    return localDb.getSecretRecord(id);
  });

  ipcMain.handle('secrets:upsert', async (_event, record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>): Promise<SecretRecord> => {
    if (!localDb) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const full: SecretRecord = { ...record, createdAt: now, updatedAt: now };
    localDb.upsertSecretRecord(full);
    return full;
  });

  ipcMain.handle('secrets:delete', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.deleteSecretRecord(id);
    return { success: true };
  });

  ipcMain.handle('secrets:getMissingForEnvironment', async (_event, projectId: string, environmentId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.getMissingSecretsForEnvironment(projectId, environmentId);
  });

  ipcMain.handle('secrets:getChangedSinceLastDeploy', async (_event, projectId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.getChangedSecretsSinceLastDeploy(projectId);
  });

  ipcMain.handle('secrets:verify', async (_event, id: string): Promise<{ success: boolean; error?: string }> => {
    if (!localDb) return { success: false, error: 'Database not initialized' };
    return localDb.verifySecret(id);
  });

  ipcMain.handle('secrets:getInventorySummary', async (_event, projectId: string): Promise<{ total: number; missing: number; verified: number }> => {
    if (!localDb) return { total: 0, missing: 0, verified: 0 };
    return localDb.getSecretInventorySummary(projectId);
  });
}
