/**
 * Audit & Rollback IPC handlers: audit:*, rollback:*
 */

import { ipcMain } from 'electron';
import type { AuditHistoryFilter, AuditRecord, Checkpoint, RollbackPlan } from '../../lib/shared-types';
import { localDb, changeEngine } from './state';

export function registerAuditRollbackHandlers(): void {
  // ── Component 19: Audit IPC ──────────────────────────────────────────────

  ipcMain.handle('audit:getHistory', async (_event, filter?: AuditHistoryFilter): Promise<AuditRecord[]> => {
    if (!localDb) return [];
    return localDb.listAuditRecords(filter);
  });

  ipcMain.handle('audit:getRecord', async (_event, id: string): Promise<AuditRecord | null> => {
    if (!localDb) return null;
    return localDb.getAuditRecord(id);
  });

  ipcMain.handle('audit:getCheckpoints', async (_event, missionId: string): Promise<Checkpoint[]> => {
    if (!localDb) return [];
    if (!missionId) return localDb.listCheckpoints('');
    return localDb.getCheckpointsForMission(missionId);
  });

  // ── Component 19: Rollback IPC ──────────────────────────────────────────

  ipcMain.handle('rollback:preview', async (_event, checkpointId: string): Promise<{ checkpointId: string; rollbackPlan: RollbackPlan | null; warning: string | null }> => {
    if (!changeEngine || !localDb) {
      return { checkpointId, rollbackPlan: null, warning: 'No change engine available' };
    }
    const checkpoint = localDb.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return { checkpointId, rollbackPlan: null, warning: `Checkpoint ${checkpointId} not found` };
    }
    const rollbackPlan: RollbackPlan = {
      targetState: checkpoint.gitRef,
      reversibleChanges: [`Revert to checkpoint: ${checkpoint.label}`],
      irreversibleChanges: [],
      environment: 'local',
      dataCaveats: [],
      estimatedDowntime: null,
      requiredApprovals: [],
      checkpointId,
    };
    return { checkpointId, rollbackPlan, warning: null };
  });

  ipcMain.handle('rollback:initiate', async (_event, checkpointId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!changeEngine) {
      return { success: false, error: 'Change engine not initialized' };
    }
    try {
      const result = changeEngine.rollbackToCheckpoint(checkpointId);
      return { success: result, error: result ? null : 'Rollback failed — checkpoint or workspace run not found' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('rollback:getStatus', async (_event, checkpointId: string): Promise<{ status: string; error: string | null }> => {
    if (!localDb) return { status: 'unknown', error: 'Database not initialized' };
    const checkpoint = localDb.getCheckpoint(checkpointId);
    if (!checkpoint) return { status: 'not-found', error: `Checkpoint ${checkpointId} not found` };
    return { status: 'available', error: null };
  });
}
