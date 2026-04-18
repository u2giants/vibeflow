/**
 * Observability IPC handlers: watch:*, anomaly:*, incident:*, selfHealing:*
 */

import { ipcMain } from 'electron';
import type { WatchStartSessionArgs, SelfHealingExecuteArgs, Incident, AnomalyEvent, WatchSession, SelfHealingAction, WatchDashboard } from '../../lib/shared-types';
import { localDb, watchEngine } from './state';

export function registerObservabilityHandlers(): void {
  // ── Component 21: Watch IPC ───────────────────────────────────────────────

  ipcMain.handle('watch:startSession', async (_event, args: WatchStartSessionArgs): Promise<WatchSession> => {
    if (!localDb || !watchEngine) throw new Error('Watch engine not initialized');
    return watchEngine.startSession(args);
  });

  ipcMain.handle('watch:stopSession', async (_event, sessionId: string): Promise<{ success: boolean }> => {
    if (!watchEngine) return { success: false };
    return watchEngine.stopSession(sessionId);
  });

  ipcMain.handle('watch:getSession', async (_event, sessionId: string): Promise<WatchSession | null> => {
    if (!localDb) return null;
    return localDb.getWatchSession(sessionId);
  });

  ipcMain.handle('watch:listSessions', async (_event, projectId: string): Promise<WatchSession[]> => {
    if (!localDb) return [];
    return localDb.listWatchSessions(projectId);
  });

  ipcMain.handle('watch:getDashboard', async (_event, projectId: string): Promise<WatchDashboard> => {
    if (!watchEngine) throw new Error('Watch engine not initialized');
    return watchEngine.getDashboard(projectId);
  });

  // ── Component 21: Anomaly IPC ─────────────────────────────────────────────

  ipcMain.handle('anomaly:list', async (_event, projectId: string): Promise<AnomalyEvent[]> => {
    if (!localDb) return [];
    return localDb.listAnomalyEvents(projectId);
  });

  ipcMain.handle('anomaly:acknowledge', async (_event, id: string, acknowledgedBy: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.acknowledgeAnomaly(id, acknowledgedBy);
    return { success: true };
  });

  // ── Component 21: Incident IPC ────────────────────────────────────────────

  ipcMain.handle('incident:list', async (_event, projectId: string): Promise<Incident[]> => {
    if (!localDb) return [];
    return localDb.listIncidents(projectId);
  });

  ipcMain.handle('incident:get', async (_event, id: string): Promise<Incident | null> => {
    if (!localDb) return null;
    return localDb.getIncident(id);
  });

  ipcMain.handle('incident:resolve', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.updateIncident(id, { status: 'resolved', resolvedAt: new Date().toISOString() });
    return { success: true };
  });

  ipcMain.handle('incident:dismiss', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.updateIncident(id, { status: 'dismissed', resolvedAt: new Date().toISOString() });
    return { success: true };
  });

  ipcMain.handle('incident:getRecommendation', async (_event, id: string): Promise<string | null> => {
    if (!localDb) return null;
    const incident = localDb.getIncident(id);
    return incident?.recommendedAction ?? null;
  });

  // ── Component 21: Self-Healing IPC ────────────────────────────────────────

  ipcMain.handle('selfHealing:list', async (_event, projectId: string): Promise<SelfHealingAction[]> => {
    if (!localDb) return [];
    return localDb.listSelfHealingActions(projectId);
  });

  ipcMain.handle('selfHealing:execute', async (_event, args: SelfHealingExecuteArgs): Promise<SelfHealingAction> => {
    if (!localDb) throw new Error('Database not initialized');
    const action: SelfHealingAction = {
      id: `heal-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: args.projectId ?? '',
      environmentId: args.environmentId ?? '',
      anomalyEventId: args.anomalyId ?? null,
      incidentId: args.incidentId ?? null,
      actionType: args.actionType,
      automatic: false,
      status: 'pending',
      approvalRequired: args.actionType === 'rollback',
      approvalResult: null,
      result: null,
      executedAt: null,
      auditRecordId: null,
    };
    localDb.upsertSelfHealingAction(action);
    return action;
  });

  ipcMain.handle('selfHealing:getStatus', async (_event, id: string): Promise<SelfHealingAction | null> => {
    if (!localDb) return null;
    const actions = localDb.listSelfHealingActions('');
    return actions.find((a) => a.id === id) ?? null;
  });
}
