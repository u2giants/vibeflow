/**
 * Evidence IPC handlers: evidence:*
 */

import { ipcMain } from 'electron';
import type { EvidenceRecord, BeforeAfterComparison } from '../../lib/shared-types';
import { evidenceEngine } from './state';

export function registerEvidenceHandlers(): void {
  // ── Component 15: Evidence Capture IPC ───────────────────────────────────

  ipcMain.handle('evidence:getForMission', async (_event, missionId: string): Promise<EvidenceRecord[]> => {
    if (!evidenceEngine) return [];
    return evidenceEngine.getEvidenceForMission(missionId);
  });

  ipcMain.handle('evidence:getForWorkspaceRun', async (_event, workspaceRunId: string): Promise<EvidenceRecord[]> => {
    if (!evidenceEngine) return [];
    return evidenceEngine.getEvidenceForWorkspaceRun(workspaceRunId);
  });

  ipcMain.handle('evidence:compareBeforeAfter', async (_event, beforeId: string, afterId: string): Promise<BeforeAfterComparison | null> => {
    if (!evidenceEngine) return null;
    return evidenceEngine.compareBeforeAfter(beforeId, afterId);
  });
}
