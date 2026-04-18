/**
 * Mission Lifecycle IPC handlers.
 *
 * Phase 3 of mission lifecycle wiring.
 * Registers missions:start, missions:get, missions:getLifecycleState,
 * missions:cancel, missions:retry, and missions:resolveApproval handlers.
 */

import { ipcMain } from 'electron';
import type { Mission, MissionStartArgs } from '../../lib/shared-types';
import { MissionOrchestrator } from '../mission-orchestrator';
import {
  localDb,
  mainWindow,
  orchestrationEngine,
  changeEngine,
  verificationEngine,
} from './state';

/** Module-level map of missionId → active MissionOrchestrator instance. */
const orchestratorMap = new Map<string, MissionOrchestrator>();

export function registerMissionsHandlers(): void {
  // ── missions:start ────────────────────────────────────────────────────
  ipcMain.handle('missions:start', async (_event, args: MissionStartArgs) => {
    if (!localDb) throw new Error('DB not initialized');
    if (!orchestrationEngine || !changeEngine || !verificationEngine) {
      throw new Error('Required mission services not initialized');
    }
    if (!mainWindow) throw new Error('Main window not available');

    const now = new Date().toISOString();
    const missionId = crypto.randomUUID();

    // 1. Create the Mission record
    const mission: Mission = {
      id: missionId,
      projectId: args.projectId,
      title: args.title,
      operatorRequest: args.operatorRequest,
      clarifiedConstraints: [],
      status: 'draft',
      owner: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    localDb.insertMission(mission);

    // 2. Create initial MissionLifecycleState
    localDb.upsertMissionLifecycleState({
      missionId,
      currentStep: 1,
      lifecycleStatus: 'idle',
      riskAssessment: null,
      workspaceRunId: null,
      verificationRunId: null,
      deployWorkflowId: null,
      watchSessionId: null,
      updatedAt: now,
    });

    // 3. Instantiate the orchestrator (contextPackAssembler is not in state — pass null)
    const orchestrator = new MissionOrchestrator(
      localDb,
      orchestrationEngine,
      changeEngine,
      verificationEngine,
      null,
      mainWindow.webContents,
    );
    orchestratorMap.set(missionId, orchestrator);

    // 4. Fire and forget — push events handle progress updates
    orchestrator.run(missionId).catch((err: unknown) => {
      console.error(`[missions:start] Unhandled orchestrator error for ${missionId}:`, err);
    }).finally(() => {
      orchestratorMap.delete(missionId);
    });

    // 5. Return the Mission record immediately
    return mission;
  });

  // ── missions:get ─────────────────────────────────────────────────────
  ipcMain.handle('missions:get', async (_event, missionId: string) => {
    if (!localDb) return null;
    return localDb.getMission(missionId) ?? null;
  });

  // ── missions:getLifecycleState ────────────────────────────────────────
  ipcMain.handle('missions:getLifecycleState', async (_event, missionId: string) => {
    if (!localDb) return null;
    return localDb.getMissionLifecycleState(missionId) ?? null;
  });

  // ── missions:cancel ───────────────────────────────────────────────────
  ipcMain.handle('missions:cancel', async (_event, missionId: string) => {
    const orchestrator = orchestratorMap.get(missionId);
    if (orchestrator) {
      orchestrator.cancel(missionId);
      orchestratorMap.delete(missionId);
    }
    // Persist cancelled status even if no orchestrator is active
    if (localDb) {
      localDb.updateMission(missionId, { status: 'cancelled' });
    }
  });

  // ── missions:retry ────────────────────────────────────────────────────
  ipcMain.handle('missions:retry', async (_event, args: { missionId: string; fromStep: number }) => {
    if (!localDb) throw new Error('DB not initialized');
    if (!orchestrationEngine || !changeEngine || !verificationEngine) {
      throw new Error('Required mission services not initialized');
    }
    if (!mainWindow) throw new Error('Main window not available');

    const { missionId, fromStep } = args;

    // Cancel any existing orchestrator for this mission
    const existing = orchestratorMap.get(missionId);
    if (existing) {
      existing.cancel(missionId);
      orchestratorMap.delete(missionId);
    }

    // Reset lifecycle state to fromStep
    const now = new Date().toISOString();
    const currentState = localDb.getMissionLifecycleState(missionId);
    localDb.upsertMissionLifecycleState({
      missionId,
      currentStep: fromStep,
      lifecycleStatus: 'idle',
      riskAssessment: currentState?.riskAssessment ?? null,
      workspaceRunId: currentState?.workspaceRunId ?? null,
      verificationRunId: currentState?.verificationRunId ?? null,
      deployWorkflowId: currentState?.deployWorkflowId ?? null,
      watchSessionId: currentState?.watchSessionId ?? null,
      updatedAt: now,
    });
    localDb.updateMission(missionId, { status: 'draft' });

    // Spawn a fresh orchestrator and re-run
    const orchestrator = new MissionOrchestrator(
      localDb,
      orchestrationEngine,
      changeEngine,
      verificationEngine,
      null,
      mainWindow.webContents,
    );
    orchestratorMap.set(missionId, orchestrator);

    orchestrator.run(missionId).catch((err: unknown) => {
      console.error(`[missions:retry] Unhandled orchestrator error for ${missionId}:`, err);
    }).finally(() => {
      orchestratorMap.delete(missionId);
    });
  });

  // ── missions:resolveApproval ──────────────────────────────────────────
  ipcMain.handle(
    'missions:resolveApproval',
    async (_event, args: { missionId: string; approved: boolean }) => {
      const orchestrator = orchestratorMap.get(args.missionId);
      if (!orchestrator) {
        console.warn(`[missions:resolveApproval] No active orchestrator for mission ${args.missionId}`);
        return;
      }
      orchestrator.resolveApproval(args.missionId, args.approved);
    }
  );
}
