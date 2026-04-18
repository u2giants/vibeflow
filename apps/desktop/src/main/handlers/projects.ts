/**
 * Projects IPC handlers: projects:list, projects:create, projects:getSelfMaintenance,
 * projects:getVibeFlowRepoPath, projects:pickVibeFlowRepoPath, projects:createSelfMaintenance
 */

import { ipcMain, dialog, app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import keytar from 'keytar';
import type { CreateProjectArgs } from '../../lib/shared-types';
import { localDb, syncEngine, KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH, changeEngine } from './state';
import { getCurrentUserId } from './helpers';
import { SecretsStore } from '../../lib/secrets/secrets-store';
import { DriftDetector } from '../../lib/drift-detector';
import { EvidenceCaptureEngine } from '../../lib/runtime-execution/evidence-capture-engine';
import { WatchEngine } from '../../lib/observability/watch-engine';
import { RuntimeExecutionService } from '../../lib/runtime-execution/runtime-execution-service';
import { BrowserAutomationService } from '../../lib/runtime-execution/browser-automation-service';
import { VerificationEngine } from '../../lib/verification/verification-engine';
import { ValidityPipeline } from '../../lib/change-engine/validity-pipeline';

export function registerProjectsHandlers(): void {
  ipcMain.handle('projects:list', async (): Promise<unknown[]> => {
    if (!localDb) return [];
    const userId = await getCurrentUserId();
    return localDb.listProjects(userId);
  });

  ipcMain.handle(
    'projects:create',
    async (_event: IpcMainInvokeEvent, args: CreateProjectArgs): Promise<unknown> => {
      if (!localDb) throw new Error('Local DB not initialized');

      const userId = await getCurrentUserId();
      const project = {
        id: crypto.randomUUID(),
        userId,
        name: args.name,
        description: args.description ?? null,
        isSelfMaintenance: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      };

      localDb.insertProject(project);

      if (syncEngine) {
        syncEngine.pushProject(project).catch(err =>
          console.warn('[main] pushProject failed (non-fatal):', err)
        );
      }

      return project;
    }
  );

  ipcMain.handle('projects:getSelfMaintenance', async (): Promise<unknown | null> => {
    if (!localDb) return null;
    return localDb.getSelfMaintenanceProject();
  });

  ipcMain.handle('projects:getVibeFlowRepoPath', async (): Promise<string | null> => {
    if (app.isPackaged) {
      return await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH) ?? null;
    }
    return path.resolve(__dirname, '../../../..');
  });

  ipcMain.handle('projects:pickVibeFlowRepoPath', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select VibeFlow source code folder',
      message: 'Choose the folder where you cloned the VibeFlow repository',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const repoPath = result.filePaths[0];
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH, repoPath);
    return repoPath;
  });

  ipcMain.handle('projects:createSelfMaintenance', async (): Promise<unknown> => {
    // Lazy-initialize DB if it failed during startup (e.g. better-sqlite3 native module issue)
    if (!localDb) {
      try {
        const state = require('./state');
        const dbPath = path.join(app.getPath('userData'), 'vibeflow-cache.sqlite');
        const { LocalDb } = require('../../lib/storage');
        state.localDb = new LocalDb(dbPath);
        await state.localDb.init();
        const { ChangeEngine } = require('../../lib/change-engine');
        state.changeEngine = new ChangeEngine(state.localDb);
        const secretsStore = new SecretsStore(state.localDb);
        const driftDetector = new DriftDetector(state.localDb, secretsStore);
        state.evidenceEngine = new EvidenceCaptureEngine(state.localDb);
        state.watchEngine = new WatchEngine(state.localDb, driftDetector, state.evidenceEngine, state.mainWindow);
        const lazyScreenshotDir = path.join(app.getPath('userData'), 'screenshots');
        state.runtimeService = new RuntimeExecutionService(state.localDb, state.evidenceEngine);
        state.browserService = new BrowserAutomationService(state.localDb, state.evidenceEngine, lazyScreenshotDir);
        const lazyValidityPipeline = new ValidityPipeline();
        state.verificationEngine = new VerificationEngine(state.localDb, lazyValidityPipeline, state.evidenceEngine, state.browserService);
        state.localDb.seedDefaultModes(require('../../lib/modes/default-modes').DEFAULT_MODES);
        state.localDb.migrateDefaultModelId('anthropic/claude-sonnet-4-5', 'anthropic/claude-sonnet-4-6');
        console.log('[main] LocalDb lazy-initialized in createSelfMaintenance');
      } catch (err) {
        console.error('[main] LocalDb lazy-init failed:', err);
        throw new Error('Local DB could not be initialized. Please restart the app.');
      }
    }

    // Check if already exists
    const existing = localDb!.getSelfMaintenanceProject();
    if (existing) return existing;

    const project = {
      id: crypto.randomUUID(),
      userId: '',
      name: 'VibeFlow (Self-Maintenance)',
      description: 'Work on the VibeFlow IDE itself',
      isSelfMaintenance: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    };

    localDb!.insertProject(project);
    return project;
  });
}
