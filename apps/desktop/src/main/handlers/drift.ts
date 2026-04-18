/**
 * Drift IPC handlers: drift:*
 */

import { ipcMain } from 'electron';
import type { DriftReport } from '../../lib/shared-types';
import { localDb } from './state';
import { EnvironmentManager } from '../../lib/environment-manager';
import { SecretsStore } from '../../lib/secrets/secrets-store';
import { DriftDetector } from '../../lib/drift-detector';

export function registerDriftHandlers(): void {
  ipcMain.handle('drift:detect', async (_event, projectId: string): Promise<DriftReport[]> => {
    if (!localDb) return [];
    const manager = new EnvironmentManager(localDb);
    const environments = manager.listEnvironments(projectId);
    const secretsStore = new SecretsStore(localDb);
    const detector = new DriftDetector(localDb, secretsStore);
    return detector.detectDrift(projectId, environments);
  });

  ipcMain.handle('drift:getReports', async (_event, projectId: string): Promise<DriftReport[]> => {
    if (!localDb) return [];
    const secretsStore = new SecretsStore(localDb);
    const detector = new DriftDetector(localDb, secretsStore);
    return detector.getReports(projectId);
  });

  ipcMain.handle('drift:resolve', async (_event, reportId: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const secretsStore = new SecretsStore(localDb);
    const detector = new DriftDetector(localDb, secretsStore);
    detector.resolveReport(reportId);
    return { success: true };
  });
}
