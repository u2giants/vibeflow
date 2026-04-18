/**
 * Verification IPC handlers: verification:*, acceptance:*
 */

import { ipcMain } from 'electron';
import type { VerificationRun, VerificationBundle, AcceptanceCriteria } from '../../lib/shared-types';
import { localDb, verificationEngine } from './state';
import { AcceptanceCriteriaGenerator } from '../../lib/verification/acceptance-criteria-generator';

export function registerVerificationHandlers(): void {
  // ── Component 16: Verification IPC ───────────────────────────────────────

  ipcMain.handle('verification:run', async (_event, args): Promise<VerificationRun> => {
    if (!verificationEngine) throw new Error('Verification engine not initialized');
    return verificationEngine.runVerification(args);
  });

  ipcMain.handle('verification:getRun', async (_event, id: string): Promise<VerificationRun | null> => {
    if (!localDb) return null;
    return localDb.getVerificationRun(id);
  });

  ipcMain.handle('verification:getRunsForMission', async (_event, missionId: string): Promise<VerificationRun[]> => {
    if (!localDb) return [];
    return localDb.listVerificationRunsByMission(missionId);
  });

  ipcMain.handle('verification:getBundles', async (): Promise<VerificationBundle[]> => {
    if (!localDb) return [];
    return localDb.listVerificationBundles();
  });

  // ── Component 16: Acceptance IPC ────────────────────────────────────────

  ipcMain.handle('acceptance:generate', async (_event, args): Promise<AcceptanceCriteria> => {
    if (!localDb) throw new Error('Database not initialized');
    const generator = new AcceptanceCriteriaGenerator(localDb);
    return generator.generateCriteria(args.missionId);
  });

  ipcMain.handle('acceptance:get', async (_event, missionId: string): Promise<AcceptanceCriteria | null> => {
    if (!localDb) return null;
    return localDb.getAcceptanceCriteria(missionId);
  });
}
