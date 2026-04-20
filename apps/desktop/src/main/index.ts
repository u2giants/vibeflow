/**
 * Electron main process entry point.
 * Creates the BrowserWindow, registers IPC handlers via handler modules, initializes local SQLite DB.
 */

// Load .env file from repo root before anything else (development only).
// electron-vite loads VITE_* vars automatically in dev, but dotenv ensures
// they are available in all contexts during development.
// In packaged builds we skip dotenv entirely: env vars are pre-injected at
// build time or read directly from process.env (set by the installer/OS).
import * as dotenv from 'dotenv';
import * as path from 'path';

// Use the canonical Electron API to detect packaged vs dev.
// We must use require() here because ES-module `import { app }` is hoisted
// before electron-vite's externalization shim is ready.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app: _app } = require('electron');

if (!_app.isPackaged) {
  // Development: repo root is 4 levels up from src/main/index.ts compiled to
  // out/main/index.js  →  apps/desktop/out/main/index.js  →  ../../../../.env
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
}
// Packaged builds: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be
// present in process.env via build-time injection or system environment.

// Electron must be imported via require to work correctly with electron-vite externalization
// eslint-disable-next-line @typescript-eslint/no-var-requires
const electron = require('electron');
const { app, BrowserWindow } = electron;

import { registerBuiltinCapabilities } from '../lib/capability-fabric/capability-adapter';
import { DEFAULT_MODES } from '../lib/modes/default-modes';
import { LocalDb } from '../lib/storage';
import { ChangeEngine } from '../lib/change-engine';
import { SecretsStore } from '../lib/secrets/secrets-store';
import { DriftDetector } from '../lib/drift-detector';
import { EvidenceCaptureEngine } from '../lib/runtime-execution/evidence-capture-engine';
import { WatchEngine } from '../lib/observability/watch-engine';
import { RuntimeExecutionService } from '../lib/runtime-execution/runtime-execution-service';
import { BrowserAutomationService } from '../lib/runtime-execution/browser-automation-service';
import { VerificationEngine } from '../lib/verification/verification-engine';
import { ValidityPipeline } from '../lib/change-engine/validity-pipeline';
import { SyncEngine } from '../lib/sync/sync-engine';
import { initAutoUpdater } from '../lib/updater/auto-updater';

// Handler registration
import {
  registerAuthHandlers,
  registerProjectsHandlers,
  registerModesHandlers,
  registerOpenRouterHandlers,
  registerConversationsHandlers,
  registerOrchestratorHandlers,
  registerSyncHandlers,
  registerToolingHandlers,
  registerCapabilitiesHandlers,
  registerIntelligenceHandlers,
  registerDevOpsHandlers,
  registerHandoffHandlers,
  registerApprovalHandlers,
  registerChangeEngineHandlers,
  registerSecretsHandlers,
  registerOAuthHandlers,
  registerConnectionTestHandlers,
  registerMigrationHandlers,
  registerDeployHandlers,
  registerEnvironmentHandlers,
  registerDriftHandlers,
  registerObservabilityHandlers,
  registerMemoryHandlers,
  registerAuditRollbackHandlers,
  registerRuntimeHandlers,
  registerEvidenceHandlers,
  registerVerificationHandlers,
  registerBuildMetadataHandlers,
  registerUpdaterHandlers,
  registerMissionsHandlers,
} from './handlers';

import { getSupabaseClient, createWindow, initSyncEngine } from './handlers/helpers';
import { container as state } from './handlers/state';

// ── App initialization ────────────────────────────────────────────

app.whenReady().then(async () => {
  // Check Supabase configuration and warn if missing
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !anonKey) {
    console.warn('[main] WARNING: Supabase not configured. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    // Send a warning to the renderer if it's already loaded
    if (state.mainWindow) {
      state.mainWindow.webContents.send('config:warning', {
        message: 'Supabase not configured. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      });
    }
  }

  // Initialize local SQLite DB — non-fatal: app opens even if DB init fails
  try {
    const dbPath = path.join(app.getPath('userData'), 'vibeflow-cache.sqlite');
    state.localDb = new LocalDb(dbPath);
    await state.localDb.init();
    console.log('[main] Local SQLite DB initialized at', dbPath);
    state.localDb.seedDefaultModes(DEFAULT_MODES);
    state.localDb.migrateDefaultModelId('anthropic/claude-sonnet-4-5', 'anthropic/claude-sonnet-4-6');
    console.log('[main] Default modes seeded');

    // Initialize capability registry with builtin capabilities
    state.capabilityRegistry.db = state.localDb;
    state.capabilityRegistry.loadFromDb();
    registerBuiltinCapabilities(state.capabilityRegistry);
    console.log('[main] Capability registry initialized with builtin capabilities');

    // Initialize MCP connection manager
    state.mcpConnectionManager.db = state.localDb;
    state.mcpConnectionManager.loadFromDb();
    console.log('[main] MCP connection manager initialized');

    // Initialize Component 15/19 services
    state.evidenceEngine = new EvidenceCaptureEngine(state.localDb);
    const screenshotDir = path.join(app.getPath('userData'), 'screenshots');
    state.runtimeService = new RuntimeExecutionService(state.localDb, state.evidenceEngine);
    state.browserService = new BrowserAutomationService(state.localDb, state.evidenceEngine, screenshotDir);
    const validityPipeline = new ValidityPipeline();
    state.verificationEngine = new VerificationEngine(state.localDb, validityPipeline, state.evidenceEngine, state.browserService);
    console.log('[main] Runtime, browser, evidence, and verification services initialized');
  } catch (err) {
    console.error('[main] SQLite DB init failed (non-fatal):', err);
    state.localDb = null;
  }

  // Try to init sync for existing session (user already signed in)
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data } = await client.auth.getSession();
      if (data.session?.user?.id) {
        await initSyncEngine(data.session.user.id);
        console.log('[main] Sync engine initialized for existing session');
      }
    }
  } catch (err) {
    console.log('[main] No existing session, sync will start on sign-in');
  }

  // Register all IPC handlers
  registerAuthHandlers();
  registerProjectsHandlers();
  registerModesHandlers();
  registerOpenRouterHandlers();
  registerConversationsHandlers();
  registerOrchestratorHandlers();
  registerSyncHandlers();
  registerToolingHandlers();
  registerCapabilitiesHandlers();
  registerIntelligenceHandlers();
  registerDevOpsHandlers();
  registerHandoffHandlers();
  registerApprovalHandlers();
  registerChangeEngineHandlers();
  registerSecretsHandlers();
  registerOAuthHandlers();
  registerConnectionTestHandlers();
  registerMigrationHandlers();
  registerDeployHandlers();
  registerEnvironmentHandlers();
  registerDriftHandlers();
  registerObservabilityHandlers();
  registerMemoryHandlers();
  registerAuditRollbackHandlers();
  registerRuntimeHandlers();
  registerEvidenceHandlers();
  registerVerificationHandlers();
  registerBuildMetadataHandlers();
  registerUpdaterHandlers();
  registerMissionsHandlers();

  createWindow();

  // Only init auto-updater in packaged builds (not dev mode)
  if (app.isPackaged && state.mainWindow) {
    initAutoUpdater(state.mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  state.syncEngine?.stop();
  state.localDb?.close();
});
