/**
 * Orchestrator IPC handlers: orchestrator:decomposeMission, orchestrator:assignRole, orchestrator:getPlan, orchestrator:getState
 */

import { ipcMain } from 'electron';
import keytar from 'keytar';
import { localDb, orchestrationEngine, mainWindow, KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY, container as state } from './state';
import { OrchestrationEngine } from '../../lib/orchestrator/orchestration-engine';

export function registerOrchestratorHandlers(): void {
  ipcMain.handle('orchestrator:decomposeMission', async (_event, args: { missionId: string; projectId: string }) => {
    if (!localDb) throw new Error('DB not initialized');

    const mission = localDb.getMission(args.missionId);
    if (!mission) throw new Error(`Mission ${args.missionId} not found`);

    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) throw new Error('OpenRouter API key not set');

    const modes = localDb.listModes();

    // Initialize or reuse the engine
    if (!orchestrationEngine) {
      state.orchestrationEngine = new OrchestrationEngine(apiKey, modes, (orchState) => {
        if (state.mainWindow) {
          state.mainWindow.webContents.send('orchestrator:stateChanged', orchState);
        }
      });
    } else {
      orchestrationEngine.setApiKey(apiKey);
    }

    const plan = await state.orchestrationEngine!.decomposeMission(mission);

    // Persist the plan to local DB
    localDb.upsertPlan({
      missionId: plan.missionId,
      steps: plan.steps.map(s => ({
        id: s.id,
        missionId: plan.missionId,
        order: s.order,
        title: s.title,
        description: s.description,
        status: s.status === 'failed' ? 'blocked' : s.status,
        requiredCapabilities: s.requiredEvidence,
        riskLabel: s.riskLabel,
        requiredEvidence: s.requiredEvidence,
        expectedOutput: s.expectedOutput,
      })),
      createdAt: plan.createdAt,
      updatedAt: new Date().toISOString(),
    });

    // Update mission status to planning
    localDb.updateMission(args.missionId, { status: 'planning' });

    return plan;
  });

  ipcMain.handle('orchestrator:assignRole', async (_event, args: { missionId: string; stepId: string; roleSlug: string }) => {
    if (!orchestrationEngine) throw new Error('Orchestration engine not initialized');
    return orchestrationEngine.assignRole(args.missionId, args.stepId);
  });

  ipcMain.handle('orchestrator:getPlan', async (_event, missionId: string) => {
    if (!localDb) return null;
    return localDb.getPlan(missionId);
  });

  ipcMain.handle('orchestrator:getState', async () => {
    if (!orchestrationEngine) return { status: 'idle' as const, missionId: null, currentPlan: null, activeStepId: null, roleAssignments: [], executionProgress: 0, error: null, updatedAt: new Date().toISOString() };
    return orchestrationEngine.getState();
  });
}
