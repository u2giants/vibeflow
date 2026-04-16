/**
 * Electron main process entry point.
 * Creates the BrowserWindow, registers IPC handlers, initializes local SQLite DB.
 */

// Load .env file from repo root before anything else
// electron-vite loads VITE_* vars automatically in dev, but dotenv ensures
// they are available in all contexts including packaged builds.
import * as dotenv from 'dotenv';
import * as path from 'path';
// In dev: repo root is 4 levels up from out/main/index.js → apps/desktop/out/main
// In packaged: use app.getAppPath() instead (handled below after app is ready)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Electron must be imported via require to work correctly with electron-vite externalization
// eslint-disable-next-line @typescript-eslint/no-var-requires
const electron = require('electron');
const { app, BrowserWindow, ipcMain, shell } = electron;
type IpcMainInvokeEvent = import('electron').IpcMainInvokeEvent;
import * as http from 'http';
import * as url from 'url';
import * as os from 'os';
import keytar from 'keytar';
import { LocalDb } from '../lib/storage';
import { BUILD_METADATA } from '../lib/build-metadata';
import { DEFAULT_MODES } from '../lib/modes/default-modes';
import type {
  AuthSignInResult,
  CreateProjectArgs,
  UpdateModeSoulArgs,
  UpdateModeModelArgs,
  CreateConversationArgs,
  SendMessageArgs,
  Message,
} from '../lib/shared-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runOrchestrator } from '../lib/orchestrator/orchestrator';
import { OrchestrationEngine } from '../lib/orchestrator/orchestration-engine';
import { SyncEngine } from '../lib/sync/sync-engine';
import { FileService } from '../lib/tooling/file-service';
import { TerminalService } from '../lib/tooling/terminal-service';
import { GitService } from '../lib/tooling/git-service';
import { SshService } from '../lib/tooling/ssh-service';
import { CapabilityRegistry } from '../lib/capability-fabric/capability-registry';
import { registerBuiltinCapabilities } from '../lib/capability-fabric/capability-adapter';
import { McpConnectionManager } from '../lib/mcp-manager/mcp-connection-manager';
import { McpToolExecutor } from '../lib/mcp-manager/mcp-tool-executor';
import { BUILT_IN_TEMPLATES } from '../lib/devops/devops-templates';
import { GitHubActionsClient } from '../lib/devops/github-actions-client';
import { CoolifyClient } from '../lib/devops/coolify-client';
import { runHealthCheck } from '../lib/devops/health-check';
import type {
  TerminalRunArgs,
  GitCommitArgs,
  GitPushArgs,
  SshHost,
  ProjectDevOpsConfig,
  ActionRequest,
  HumanDecisionArgs,
} from '../lib/shared-types';
import { classifyAction, runSecondModelReview, type ApprovalResult, type ApprovalTier } from '../lib/approval/approval-engine';
import { logApprovalDecision, getRecentApprovals } from '../lib/approval/approval-logger';
import { generateHandoffDoc, generateHandoffPrompt } from '../lib/handoff/handoff-generator';
import { HandoffStorage } from '../lib/handoff/handoff-storage';
import type { GenerateHandoffArgs, HandoffResult } from '../lib/shared-types';
import * as fs from 'fs';
import { initAutoUpdater, downloadUpdate, installUpdate } from '../lib/updater/auto-updater';
import { IndexingPipeline, detectFramework, ImpactAnalyzer, TopologyBuilder, ContextPackAssembler } from '../lib/project-intelligence';
import { ChangeEngine } from '../lib/change-engine';
import type { CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs, SecretRecord, MigrationPlan, MigrationRiskClass, Environment, DeployWorkflow, DriftReport, DeployInitiateArgs } from '../lib/shared-types';
import { SecretsStore } from '../lib/secrets/secrets-store';
import { classifyRisk, generatePreview, requiresCheckpoint } from '../lib/secrets/migration-safety';
import { EnvironmentManager } from '../lib/environment-manager';
import { DriftDetector } from '../lib/drift-detector';
import { DeployEngine } from '../lib/deploy-engine';
import { ServiceControlPlaneManager } from '../lib/service-control-plane';
import { WatchEngine } from '../lib/observability/watch-engine';
import { EvidenceCaptureEngine } from '../lib/runtime-execution/evidence-capture-engine';
import type { WatchStartSessionArgs, SelfHealingExecuteArgs, Incident, AnomalyEvent, WatchSession, SelfHealingAction, WatchDashboard } from '../lib/shared-types';

const KEYTAR_SERVICE = 'vibeflow';
const KEYTAR_OPENROUTER_KEY = 'openrouter-api-key';
const KEYTAR_GITHUB_TOKEN = 'github-token';
const KEYTAR_COOLIFY_KEY = 'coolify-api-key';

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let localDb: LocalDb | null = null;
let supabase: SupabaseClient | null = null;
let syncEngine: SyncEngine | null = null;
const fileService = new FileService();
const terminalService = new TerminalService();
const gitService = new GitService();
const sshService = new SshService();
const capabilityRegistry = new CapabilityRegistry();
const mcpConnectionManager = new McpConnectionManager();
const mcpToolExecutor = new McpToolExecutor();
let orchestrationEngine: OrchestrationEngine | null = null;
let changeEngine: ChangeEngine | null = null;
let watchEngine: WatchEngine | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !anonKey) {
    console.error('[main] Supabase not configured: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing');
    return null;
  }

  supabase = createClient(supabaseUrl, anonKey);
  return supabase;
}

/** Get the repo path for a project. For self-maintenance, use VibeFlow repo. */
async function getProjectRepoPath(projectId: string): Promise<string> {
  if (!localDb) return process.cwd();
  const project = localDb.listProjects('').find(p => p.id === projectId);
  if (project?.isSelfMaintenance) {
    if (app.isPackaged) return app.getAppPath();
    return path.resolve(__dirname, '../../../..');
  }
  // For regular projects, default to current working directory
  // In a real implementation, this would read a stored project path
  return process.cwd();
}

// ── Sync Engine ─────────────────────────────────────────────────────

async function initSyncEngine(userId: string): Promise<void> {
  if (!localDb) {
    console.warn('[main] Cannot init sync: LocalDb not initialized');
    if (mainWindow) {
      mainWindow.webContents.send('sync:statusChanged', 'offline');
    }
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !anonKey) {
    console.warn('[main] Supabase not configured — sync disabled');
    if (mainWindow) {
      mainWindow.webContents.send('sync:statusChanged', 'offline');
    }
    return;
  }

  // Get or create stable device ID
  let deviceId = localDb.getDeviceId();
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localDb.setDeviceId(deviceId);
    console.log('[main] Generated new device ID:', deviceId);
  }

  const deviceName = os.hostname();

  syncEngine = new SyncEngine(supabaseUrl, anonKey, deviceId, deviceName, userId, localDb);

  // Forward sync events to renderer
  syncEngine.on((event) => {
    if (event.type === 'sync-status-changed' && mainWindow) {
      mainWindow.webContents.send('sync:statusChanged', event.data);
    }
  });

  try {
    await syncEngine.start();
    console.log('[main] Sync engine started for user:', userId);
  } catch (err) {
    console.error('[main] Sync engine start failed:', err);
    if (mainWindow) {
      mainWindow.webContents.send('sync:statusChanged', 'degraded');
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow!.loadURL('http://localhost:5173');
  } else {
    mainWindow!.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────

app.whenReady().then(async () => {
  // ── IPC Handlers (registered after app is ready) ──────────────────

  /**
   * GitHub OAuth via localhost redirect.
   * Starts a temporary HTTP server, opens GitHub OAuth in the system browser,
   * waits for the callback, exchanges the code for a session, and returns it.
   */
  ipcMain.handle(
    'auth:signInWithGitHub',
    async (): Promise<AuthSignInResult> => {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase not configured. Please create a .env file.' };
      }

      const callbackPort = 54321;
      const callbackPath = '/callback';

      // Wait for OAuth callback — returns either a PKCE code or implicit flow tokens
      function waitForOAuthCallback(): Promise<{ type: 'code'; code: string } | { type: 'tokens'; accessToken: string; refreshToken: string } | { type: 'error'; error: string }> {
        return new Promise((resolve, reject) => {
          const server = http.createServer((req, res) => {
            const rawUrl = req.url ?? '/';

            if (rawUrl === callbackPath || rawUrl.startsWith(`${callbackPath}?`)) {
              // Check for PKCE code in query params
              const parsedUrl = url.parse(rawUrl, true);
              const code = parsedUrl.query.code as string | undefined;
              const error = parsedUrl.query.error as string | undefined;

              if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body><h2>Sign-in failed</h2><p>You can close this tab and return to VibeFlow.</p></body></html>');
                server.close();
                resolve({ type: 'error', error: `OAuth error: ${error}` });
                return;
              }

              if (code) {
                // PKCE flow — exchange code for session
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body><h2>Sign-in successful! You can close this tab and return to VibeFlow.</h2></body></html>');
                server.close();
                resolve({ type: 'code', code });
                return;
              }

              // No code in query params — serve a page that extracts hash fragment and posts it back
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`<!DOCTYPE html>
<html>
<head><title>VibeFlow Sign-in</title></head>
<body>
<h2>Completing sign-in...</h2>
<script>
  // Extract tokens from hash fragment
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken) {
    // Send tokens back to the local server
    fetch('/callback-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken })
    }).then(() => {
      document.body.innerHTML = '<h2>Sign-in successful! You can close this tab and return to VibeFlow.</h2>';
    }).catch(() => {
      document.body.innerHTML = '<h2>Sign-in failed. Could not send tokens. Please try again.</h2>';
    });
  } else {
    document.body.innerHTML = '<h2>Sign-in failed. No tokens received. Please try again.</h2>';
  }
</script>
</body>
</html>`);
              return;
            }

            if (rawUrl === '/callback-tokens' && req.method === 'POST') {
              // Receive tokens posted from the browser page
              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { accessToken, refreshToken } = JSON.parse(body);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end('{"ok":true}');
                  server.close();
                  resolve({ type: 'tokens', accessToken, refreshToken });
                } catch {
                  res.writeHead(400);
                  res.end('Bad request');
                  reject(new Error('Failed to parse tokens'));
                }
              });
              return;
            }

            // Unknown path
            res.writeHead(404);
            res.end('Not found');
          });

          server.listen(callbackPort, '127.0.0.1', () => {
            console.log(`[main] OAuth callback server listening on http://127.0.0.1:${callbackPort}`);
          });

          server.on('error', (err) => {
            console.error('[main] OAuth callback server error:', err);
            reject(new Error(`Failed to start callback server: ${err.message}`));
          });

          // Timeout after 5 minutes
          setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout — no response received within 5 minutes'));
          }, 5 * 60 * 1000);
        });
      }

      // Start the OAuth flow
      const redirectUrl = `http://127.0.0.1:${callbackPort}${callbackPath}`;

      try {
        const { data, error: oauthError } = await client.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (oauthError) {
          return { success: false, error: oauthError.message };
        }

        if (data?.url) {
          shell.openExternal(data.url);
        } else {
          return { success: false, error: 'No OAuth URL received from Supabase' };
        }

        // Wait for callback result
        const callbackResult = await waitForOAuthCallback();

        if (callbackResult.type === 'error') {
          return { success: false, error: callbackResult.error };
        }

        // Exchange tokens for session
        let sessionData: any;
        let sessionError: any;

        if (callbackResult.type === 'code') {
          // PKCE flow
          const result = await client.auth.exchangeCodeForSession(callbackResult.code);
          sessionData = result.data;
          sessionError = result.error;
        } else {
          // Implicit flow — set session directly
          const result = await client.auth.setSession({
            access_token: callbackResult.accessToken,
            refresh_token: callbackResult.refreshToken ?? '',
          });
          sessionData = result.data;
          sessionError = result.error;
        }

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }

        const result: AuthSignInResult = {
          success: true,
          account: {
            id: sessionData.session?.user?.id ?? '',
            email: sessionData.session?.user?.email ?? '',
            displayName: sessionData.session?.user?.user_metadata?.display_name ?? null,
            createdAt: sessionData.session?.user?.created_at ?? '',
          },
        };

        // Initialize sync engine after successful sign-in
        if (result.success && result.account) {
          try {
            await initSyncEngine(result.account.id);
          } catch (err) {
            console.error('[main] Failed to init sync:', err);
          }
        }

        return result;
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle('auth:signOut', async (): Promise<void> => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  });

  ipcMain.handle(
    'auth:getSession',
    async (): Promise<{ email: string | null }> => {
      const client = getSupabaseClient();
      if (!client) {
        return { email: null };
      }
      const { data } = await client.auth.getSession();
      return { email: data.session?.user?.email ?? null };
    }
  );

  ipcMain.handle('projects:list', async (): Promise<unknown[]> => {
    if (!localDb) return [];
    // TODO: Get userId from session
    return localDb.listProjects('');
  });

  ipcMain.handle(
    'projects:create',
    async (_event: IpcMainInvokeEvent, args: CreateProjectArgs): Promise<unknown> => {
      if (!localDb) throw new Error('Local DB not initialized');

      const project = {
        id: crypto.randomUUID(),
        userId: '', // TODO: Get from session
        name: args.name,
        description: args.description ?? null,
        isSelfMaintenance: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      };

      localDb.insertProject(project);

      // TODO: Sync to Supabase cloud
      return project;
    }
  );

  ipcMain.handle('projects:getSelfMaintenance', async (): Promise<unknown | null> => {
    if (!localDb) return null;
    return localDb.getSelfMaintenanceProject();
  });

  ipcMain.handle('projects:getVibeFlowRepoPath', async (): Promise<string> => {
    // In dev mode: __dirname is apps/desktop/out/main, repo root is 4 levels up
    // In packaged mode: use app.getAppPath()
    if (app.isPackaged) {
      return app.getAppPath();
    }
    return path.resolve(__dirname, '../../../..');
  });

  ipcMain.handle('projects:createSelfMaintenance', async (): Promise<unknown> => {
    // Lazy-initialize DB if it failed during startup (e.g. better-sqlite3 native module issue)
    if (!localDb) {
      try {
        const dbPath = path.join(app.getPath('userData'), 'vibeflow-cache.sqlite');
        localDb = new LocalDb(dbPath);
        await localDb.init();
        changeEngine = new ChangeEngine(localDb);
        const secretsStore = new SecretsStore(localDb);
        const driftDetector = new DriftDetector(localDb, secretsStore);
        const evidenceEngine = new EvidenceCaptureEngine(localDb);
        watchEngine = new WatchEngine(localDb, driftDetector, evidenceEngine, mainWindow);
        localDb.seedDefaultModes(DEFAULT_MODES);
        console.log('[main] LocalDb lazy-initialized in createSelfMaintenance');
      } catch (err) {
        console.error('[main] LocalDb lazy-init failed:', err);
        throw new Error('Local DB could not be initialized. Please restart the app.');
      }
    }

    // Check if already exists
    const existing = localDb.getSelfMaintenanceProject();
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

    localDb.insertProject(project);
    return project;
  });

  ipcMain.handle('buildMetadata:get', async () => BUILD_METADATA);

  // ── Updater IPC (only in packaged builds) ─────────────────────────
  ipcMain.handle('updater:downloadUpdate', async () => downloadUpdate());
  ipcMain.handle('updater:installUpdate', async () => installUpdate());

  // ── App initialization ────────────────────────────────────────────

  // Check Supabase configuration and warn if missing
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !anonKey) {
    console.warn('[main] WARNING: Supabase not configured. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    // Send a warning to the renderer if it's already loaded
    if (mainWindow) {
      mainWindow.webContents.send('config:warning', {
        message: 'Supabase not configured. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      });
    }
  }

  // Initialize local SQLite DB — non-fatal: app opens even if DB init fails
  try {
    const dbPath = path.join(app.getPath('userData'), 'vibeflow-cache.sqlite');
    localDb = new LocalDb(dbPath);
    await localDb.init();
    console.log('[main] Local SQLite DB initialized at', dbPath);
    localDb.seedDefaultModes(DEFAULT_MODES);
    console.log('[main] Default modes seeded');

    // Initialize capability registry with builtin capabilities
    capabilityRegistry.db = localDb;
    capabilityRegistry.loadFromDb();
    registerBuiltinCapabilities(capabilityRegistry);
    console.log('[main] Capability registry initialized with builtin capabilities');

    // Initialize MCP connection manager
    mcpConnectionManager.db = localDb;
    mcpConnectionManager.loadFromDb();
    console.log('[main] MCP connection manager initialized');
  } catch (err) {
    console.error('[main] SQLite DB init failed (non-fatal):', err);
    localDb = null;
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

  // ── Modes IPC Handlers ────────────────────────────────────────────

  ipcMain.handle('modes:list', async () => {
    if (!localDb) return [];
    return localDb.listModes();
  });

  ipcMain.handle(
    'modes:updateSoul',
    async (_event: IpcMainInvokeEvent, args: UpdateModeSoulArgs) => {
      if (!localDb) throw new Error('DB not initialized');
      localDb.updateModeSoul(args.modeId, args.soul);
      return { success: true };
    }
  );

  ipcMain.handle(
    'modes:updateModel',
    async (_event: IpcMainInvokeEvent, args: UpdateModeModelArgs) => {
      if (!localDb) throw new Error('DB not initialized');
      localDb.updateModeModel(args.modeId, args.modelId);
      return { success: true };
    }
  );

  // ── OpenRouter IPC Handlers ───────────────────────────────────────

  ipcMain.handle(
    'openrouter:setApiKey',
    async (_event: IpcMainInvokeEvent, apiKey: string) => {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY, apiKey);
      return { success: true };
    }
  );

  ipcMain.handle('openrouter:getApiKey', async () => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    return { hasKey: !!apiKey };
  });

  ipcMain.handle('openrouter:listModels', async () => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) throw new Error('OpenRouter API key not set');
    const response = await fetch('https://openrouter.ai/api/v1/models/user', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as { data: any[] };
    return data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      contextLength: m.context_length,
      inputPricePerMillion: parseFloat(m.pricing?.prompt ?? '0') * 1_000_000,
      outputPricePerMillion: parseFloat(m.pricing?.completion ?? '0') * 1_000_000,
      supportsTools: m.supported_parameters?.includes('tools') ?? false,
    }));
  });

  ipcMain.handle('openrouter:testConnection', async () => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) return { success: false, error: 'No API key set' };
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      return { success: response.ok };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Conversation IPC Handlers ───────────────────────────────────────

  ipcMain.handle('conversations:list', async (_event, projectId: string) => {
    if (!localDb) return [];
    return localDb.listConversations(projectId);
  });

  ipcMain.handle('conversations:create', async (_event, args: CreateConversationArgs) => {
    if (!localDb) throw new Error('DB not initialized');
    const conv = {
      id: crypto.randomUUID(),
      projectId: args.projectId,
      userId: '', // TODO: Get from session
      title: args.title,
      runState: 'idle' as const,
      ownerDeviceId: null,
      ownerDeviceName: null,
      leaseExpiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localDb.createConversation(conv);
    return conv;
  });

  ipcMain.handle('conversations:getMessages', async (_event, conversationId: string) => {
    if (!localDb) return [];
    return localDb.listMessages(conversationId);
  });

  ipcMain.handle('conversations:sendMessage', async (event, args: SendMessageArgs) => {
    if (!localDb) throw new Error('DB not initialized');

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: args.conversationId,
      role: 'user',
      content: args.content,
      modeId: null,
      modelId: null,
      createdAt: new Date().toISOString(),
    };
    localDb.insertMessage(userMsg);

    // Get conversation history
    const history = localDb.listMessages(args.conversationId);

    // Get Orchestrator mode
    const orchestratorMode = localDb.listModes().find(m => m.slug === 'orchestrator');
    if (!orchestratorMode) throw new Error('Orchestrator mode not found');

    // Get API key
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) throw new Error('OpenRouter API key not set');

    // Stream response
    let fullContent = '';
    await runOrchestrator(history, orchestratorMode, apiKey, {
      onToken: (token) => {
        event.sender.send('conversations:streamToken', { conversationId: args.conversationId, token });
      },
      onDone: (content) => {
        fullContent = content;
      },
      onError: (error) => {
        event.sender.send('conversations:streamError', { conversationId: args.conversationId, error });
      },
    });

    // Save assistant message
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: args.conversationId,
      role: 'assistant',
      content: fullContent,
      modeId: orchestratorMode.id,
      modelId: orchestratorMode.modelId,
      createdAt: new Date().toISOString(),
    };
    localDb.insertMessage(assistantMsg);

    event.sender.send('conversations:streamDone', { conversationId: args.conversationId });
    return assistantMsg;
  });

  // ── Orchestrator IPC Handlers (Component 12) ──────────────────────────

  ipcMain.handle('orchestrator:decomposeMission', async (_event, args: { missionId: string; projectId: string }) => {
    if (!localDb) throw new Error('DB not initialized');

    const mission = localDb.getMission(args.missionId);
    if (!mission) throw new Error(`Mission ${args.missionId} not found`);

    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) throw new Error('OpenRouter API key not set');

    const modes = localDb.listModes();

    // Initialize or reuse the engine
    if (!orchestrationEngine) {
      orchestrationEngine = new OrchestrationEngine(apiKey, modes, (state) => {
        // Broadcast state changes to renderer
        if (mainWindow) {
          mainWindow.webContents.send('orchestrator:stateChanged', state);
        }
      });
    } else {
      orchestrationEngine.setApiKey(apiKey);
    }

    const plan = await orchestrationEngine.decomposeMission(mission);

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

  // ── Sync IPC Handlers ──

  ipcMain.handle('sync:getDeviceId', async (): Promise<string | null> => {
    return localDb?.getDeviceId() ?? null;
  });

  ipcMain.handle(
    'sync:registerDevice',
    async (): Promise<{ deviceId: string; deviceName: string }> => {
      if (!localDb) throw new Error('LocalDb not initialized');
      let deviceId = localDb.getDeviceId();
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localDb.setDeviceId(deviceId);
      }
      return { deviceId, deviceName: os.hostname() };
    }
  );

  ipcMain.handle('sync:syncAll', async (): Promise<{ success: boolean }> => {
    if (!syncEngine) return { success: false };
    try {
      await syncEngine.syncAll();
      return { success: true };
    } catch (err) {
      console.error('[main] sync:syncAll failed:', err);
      return { success: false };
    }
  });

  ipcMain.handle('sync:acquireLease', async (_event, conversationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!syncEngine) return { success: false, error: 'Sync engine not initialized' };
    return syncEngine.acquireLease(conversationId);
  });

  ipcMain.handle('sync:releaseLease', async (_event, conversationId: string): Promise<{ success: boolean }> => {
    if (!syncEngine) return { success: false };
    return syncEngine.releaseLease(conversationId);
  });

  ipcMain.handle('sync:takeoverLease', async (_event, conversationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!syncEngine) return { success: false, error: 'Sync engine not initialized' };
    return syncEngine.takeoverLease(conversationId);
  });

  ipcMain.handle('sync:getLease', async (_event, conversationId: string) => {
    if (!syncEngine) return null;
    return syncEngine.getLease(conversationId);
  });

  // ── Tooling IPC Handlers ──────────────────────────────────────────

  // File handlers
  ipcMain.handle('files:read', (_event, filePath: string, projectRoot?: string) =>
    fileService.readFile(filePath, projectRoot));
  ipcMain.handle('files:write', (_event, filePath: string, content: string, projectRoot?: string) =>
    fileService.writeFile(filePath, content, projectRoot));
  ipcMain.handle('files:list', (_event, dirPath: string, projectRoot?: string) =>
    fileService.listDirectory(dirPath, projectRoot));
  ipcMain.handle('files:exists', (_event, filePath: string, projectRoot?: string) =>
    fileService.fileExists(filePath, projectRoot));

  // Terminal handlers
  ipcMain.handle('terminal:run', async (event, args: TerminalRunArgs) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return terminalService.runCommand(args.command, args.cwd, args.commandId, win);
  });
  ipcMain.handle('terminal:kill', (_event, commandId: string) =>
    terminalService.killCommand(commandId));

  // Git handlers
  ipcMain.handle('git:status', (_event, repoPath: string) => gitService.getStatus(repoPath));
  ipcMain.handle('git:diff', (_event, repoPath: string, staged: boolean = false) =>
    gitService.getDiff(repoPath, staged));
  ipcMain.handle('git:commit', (_event, args: GitCommitArgs) =>
    gitService.commit(args.repoPath, args.message));
  ipcMain.handle('git:push', async (event, args: GitPushArgs) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return gitService.push(args.repoPath, args.remote, args.branch, win);
  });
  ipcMain.handle('git:log', (_event, repoPath: string, limit: number = 10) =>
    gitService.getLog(repoPath, limit));

  // SSH handlers
  ipcMain.handle('ssh:discoverHosts', () => sshService.discoverHosts());
  ipcMain.handle('ssh:discoverKeys', () => sshService.discoverKeys());
  ipcMain.handle('ssh:testConnection', (_event, host: SshHost) =>
    sshService.testConnection(host));

  // ── Capabilities IPC Handlers ─────────────────────────────────────

  ipcMain.handle('capabilities:list', () => {
    return capabilityRegistry.list();
  });

  ipcMain.handle('capabilities:get', (_event, id: string) => {
    return capabilityRegistry.get(id);
  });

  ipcMain.handle('capabilities:getHealth', () => {
    return capabilityRegistry.getHealth();
  });

  ipcMain.handle('capabilities:getInvocationLog', (_event, capabilityId: string, limit: number = 50) => {
    return capabilityRegistry.getInvocationLog(capabilityId, limit);
  });

  // ── MCP IPC Handlers ──────────────────────────────────────────────

  ipcMain.handle('mcp:list', () => {
    return mcpConnectionManager.listServers();
  });

  ipcMain.handle('mcp:add', (_event, config) => {
    return mcpConnectionManager.addServer(config);
  });

  ipcMain.handle('mcp:update', (_event, id: string, updates) => {
    const result = mcpConnectionManager.updateServer(id, updates);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:remove', (_event, id: string) => {
    const success = mcpConnectionManager.removeServer(id);
    return { success };
  });

  ipcMain.handle('mcp:enable', (_event, id: string) => {
    const result = mcpConnectionManager.enableServer(id);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:disable', (_event, id: string) => {
    const result = mcpConnectionManager.disableServer(id);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:testConnection', async (_event, id: string) => {
    return mcpConnectionManager.testConnection(id);
  });

  ipcMain.handle('mcp:executeTool', async (_event, serverId: string, toolName: string, parameters: Record<string, unknown>) => {
    const server = mcpConnectionManager.getServer(serverId);
    if (!server) throw new Error(`MCP server ${serverId} not found`);
    return mcpToolExecutor.executeTool(server, toolName, parameters);
  });

  // ── Project Intelligence IPC Handlers (Component 11) ──────────────

  ipcMain.handle('projectIntelligence:getIndex', async (_event, projectId: string) => {
    if (!localDb) return null;
    return localDb.getProjectIndex(projectId);
  });

  ipcMain.handle('projectIntelligence:triggerIndex', async (_event, projectId: string, options?: { fullReindex: boolean }) => {
    if (!localDb) throw new Error('DB not initialized');

    // Get project path — for self-maintenance use VibeFlow repo, otherwise use a default
    const repoPath = await getProjectRepoPath(projectId);

    const pipeline = new IndexingPipeline(localDb, projectId, repoPath, (current, total) => {
      if (mainWindow) {
        mainWindow.webContents.send('projectIntelligence:indexProgress', { current, total });
      }
    });

    const result = await pipeline.run(options);
    return { success: true, fileCount: result.fileCount };
  });

  ipcMain.handle('projectIntelligence:getIndexStatus', async (_event, projectId: string) => {
    if (!localDb) return { indexed: false, fileCount: 0, staleness: 'unknown', indexedAt: null };
    const index = localDb.getProjectIndex(projectId);
    const fileCount = localDb.listFileRecords(projectId).length;
    return {
      indexed: !!index,
      fileCount,
      staleness: index?.staleness ?? 'unknown',
      indexedAt: index?.indexedAt ?? null,
    };
  });

  ipcMain.handle('projectIntelligence:getFiles', async (_event, projectId: string, filter?: { language?: string; isGenerated?: boolean }) => {
    if (!localDb) return [];
    return localDb.listFileRecords(projectId, filter);
  });

  ipcMain.handle('projectIntelligence:getFile', async (_event, projectId: string, path: string) => {
    if (!localDb) return null;
    return localDb.getFileRecord(projectId, path);
  });

  ipcMain.handle('projectIntelligence:getSymbols', async (_event, projectId: string, filter?: { fileId?: string; kind?: string }) => {
    if (!localDb) return [];
    return localDb.listSymbolRecords(projectId, filter);
  });

  ipcMain.handle('projectIntelligence:getSymbol', async (_event, projectId: string, id: string) => {
    if (!localDb) return null;
    return localDb.getSymbolRecord(projectId, id);
  });

  ipcMain.handle('projectIntelligence:getImpactAnalysis', async (_event, projectId: string, targetPath: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const analyzer = new ImpactAnalyzer(localDb, projectId);
    return analyzer.analyze(targetPath);
  });

  ipcMain.handle('projectIntelligence:getTopology', async (_event, projectId: string) => {
    if (!localDb) return { nodes: [], edges: [] };
    const stack = detectFramework(await getProjectRepoPath(projectId));
    const builder = new TopologyBuilder(localDb, projectId);
    return builder.build(stack);
  });

  ipcMain.handle('projectIntelligence:getConfigVariables', async (_event, projectId: string) => {
    if (!localDb) return [];
    return localDb.listConfigVariableRecords(projectId);
  });

  ipcMain.handle('projectIntelligence:getMissingConfig', async (_event, projectId: string, environment: string) => {
    if (!localDb) return [];
    const all = localDb.listConfigVariableRecords(projectId);
    return all.filter(c => c.missingEnvironments.includes(environment));
  });

  ipcMain.handle('projectIntelligence:getDetectedStack', async (_event, projectId: string) => {
    const repoPath = await getProjectRepoPath(projectId);
    return detectFramework(repoPath);
  });

  // ── Context Packs IPC Handlers (Component 11) ─────────────────────

  ipcMain.handle('contextPacks:createPack', async (_event, missionId: string, options?) => {
    if (!localDb) throw new Error('DB not initialized');

    // Get projectId from mission
    const mission = localDb.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const assembler = new ContextPackAssembler(localDb, mission.projectId);
    return assembler.assemble(missionId, options);
  });

  ipcMain.handle('contextPacks:getPack', async (_event, packId: string) => {
    if (!localDb) return null;
    return localDb.getContextPack(packId);
  });

  ipcMain.handle('contextPacks:getPackForMission', async (_event, missionId: string) => {
    if (!localDb) return null;
    return localDb.getContextPackForMission(missionId);
  });

  ipcMain.handle('contextPacks:updatePack', async (_event, packId: string, updates) => {
    if (!localDb) throw new Error('DB not initialized');
    const pack = localDb.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);
    if (updates.items) pack.items = updates.items;
    if (updates.warnings) pack.warnings = updates.warnings;
    pack.updatedAt = new Date().toISOString();
    localDb.upsertContextPack(pack);
    return pack;
  });

  ipcMain.handle('contextPacks:pinItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.pinItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:unpinItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.unpinItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:swapStaleItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.swapStaleItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:getDashboard', async (_event, packId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.getDashboard(packId);
  });

  // ── DevOps IPC Handlers ──────────────────────────────────────────

  ipcMain.handle('devops:listTemplates', () => BUILT_IN_TEMPLATES);

  ipcMain.handle('devops:getProjectConfig', (_event, projectId: string) => {
    return localDb?.getProjectDevOpsConfig(projectId) ?? null;
  });

  ipcMain.handle('devops:saveProjectConfig', (_event, config: ProjectDevOpsConfig) => {
    localDb?.saveProjectDevOpsConfig(config);
    return { success: true };
  });

  ipcMain.handle('devops:setGitHubToken', async (_event, token: string) => {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_GITHUB_TOKEN, token);
    return { success: true };
  });

  ipcMain.handle('devops:setCoolifyApiKey', async (_event, apiKey: string) => {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY, apiKey);
    return { success: true };
  });

  ipcMain.handle('devops:listWorkflowRuns', async (_event, owner: string, repo: string) => {
    const token = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_GITHUB_TOKEN);
    if (!token) throw new Error('GitHub token not set');
    const client = new GitHubActionsClient(token);
    return client.listWorkflowRuns(owner, repo);
  });

  ipcMain.handle('devops:deploy', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.deploy(appId);
  });

  ipcMain.handle('devops:restart', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.restart(appId);
  });

  ipcMain.handle('devops:stop', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.stop(appId);
  });

  ipcMain.handle('devops:healthCheck', async (_event, url: string) => {
    return runHealthCheck(url);
  });

  ipcMain.handle('devops:listDeployRuns', (_event, projectId: string) => {
    return localDb?.listDeployRuns(projectId) ?? [];
  });

  // ── Handoff IPC Handlers ───────────────────────────────────────────

  ipcMain.handle('handoff:generate', async (_event, args: GenerateHandoffArgs): Promise<HandoffResult> => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

      // Read current idiosyncrasies.md
      const idiosyncrasiesPath = path.join(__dirname, '../../../../docs/idiosyncrasies.md');
      let idiosyncrasies = '';
      try {
        idiosyncrasies = fs.readFileSync(idiosyncrasiesPath, 'utf-8');
      } catch {
        idiosyncrasies = 'Could not read idiosyncrasies.md';
      }

      // Get conversation messages
      const messages = localDb?.listMessages(args.conversationId) ?? [];

      // Get orchestrator mode
      const orchestratorMode = localDb?.listModes().find(m => m.slug === 'orchestrator');

      const timestamp = new Date().toISOString();
      const filename = `handoff-${timestamp.replace(/[:.]/g, '-').slice(0, 19)}.md`;

      // Component 22: Extended handoff context with mission/plan/evidence
      const missions = localDb?.listMissions(args.projectId) ?? [];
      const latestMission = missions.length > 0 ? missions[0] : null;
      const plan = latestMission ? localDb?.getPlan(latestMission.id) ?? null : null;
      const evidence = latestMission ? localDb?.listEvidenceItems(latestMission.id) ?? [] : [];

      const missionState = latestMission
        ? { id: latestMission.id, title: latestMission.title, status: latestMission.status }
        : undefined;

      const planState = plan
        ? {
            completedSteps: plan.steps.filter((s) => s.status === 'completed').length,
            totalSteps: plan.steps.length,
            nextStep: plan.steps.find((s) => s.status === 'pending')?.title ?? 'No pending steps',
          }
        : undefined;

      const evidenceSummary = evidence.length > 0
        ? {
            passed: evidence.filter((e) => e.status === 'pass').length,
            failed: evidence.filter((e) => e.status === 'fail').length,
            warnings: evidence.filter((e) => e.status === 'warning').length,
          }
        : undefined;

      const ctx = {
        conversationId: args.conversationId,
        projectId: args.projectId,
        projectName: args.projectName,
        messages,
        orchestratorMode: orchestratorMode!,
        currentGoal: args.currentGoal,
        whatWasTried: [],
        whatWorked: [],
        whatFailed: [],
        pendingBugs: args.pendingBugs,
        nextStep: args.nextStep,
        warnings: args.warnings,
        idiosyncrasies,
        timestamp,
        isSelfMaintenance: args.isSelfMaintenance ?? false,
        vibeFlowRepoPath: args.isSelfMaintenance ? path.resolve(__dirname, '../../../..') : undefined,
        missionState,
        planState,
        evidenceSummary,
        blockedItems: undefined,
      };

      const handoffDoc = generateHandoffDoc(ctx);
      const handoffPrompt = generateHandoffPrompt(ctx);

      // Save to Supabase Storage (optional — works without it)
      let storageUrl: string | null = null;
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data: { user } } = await client.auth.getUser();
          if (user) {
            const storage = new HandoffStorage(supabaseUrl, supabaseAnonKey);
            const result = await storage.saveHandoffDoc(user.id, args.projectId, filename, handoffDoc);
            storageUrl = result.url;
          }
        }
      } catch (err) {
        console.warn('[main] Handoff storage save failed (non-fatal):', err);
      }

      return { handoffDoc, handoffPrompt, filename, storageUrl, error: null };
    } catch (err) {
      return { handoffDoc: '', handoffPrompt: '', filename: '', storageUrl: null, error: String(err) };
    }
  });

  ipcMain.handle('handoff:getIdiosyncrasies', () => {
    const idiosyncrasiesPath = path.join(__dirname, '../../../../docs/idiosyncrasies.md');
    try {
      return fs.readFileSync(idiosyncrasiesPath, 'utf-8');
    } catch {
      return 'Could not read idiosyncrasies.md';
    }
  });

  // ── Approval IPC Handlers ──────────────────────────────────────────

  // Pending human approvals queue
  const pendingHumanApprovals = new Map<string, {
    action: ActionRequest;
    resolve: (result: ApprovalResult) => void;
  }>();

  ipcMain.handle('approval:requestAction', async (event, action: ActionRequest): Promise<ApprovalResult> => {
    // Check if this conversation belongs to a self-maintenance project
    const conv = localDb?.getConversation(action.conversationId);
    const project = conv ? localDb?.listProjects('').find(p => p.id === conv.projectId) : null;
    const isSelfMaintenance = project?.isSelfMaintenance ?? false;

    const tier = classifyAction(action.actionType, { isSelfMaintenance });

    if (tier === 1) {
      // Auto-allow
      const result: ApprovalResult = {
        actionId: action.id,
        decision: 'approved',
        tier: 1,
        reviewerModel: null,
        reviewerReason: 'Auto-approved (safe action)',
        decidedAt: new Date().toISOString(),
      };
      logApprovalDecision(action, result);
      return result;
    }

    if (tier === 2) {
      // Second-model review
      const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
      if (!apiKey) {
        // No API key — escalate to human
        return requestHumanApproval(event, action, 2);
      }

      const review = await runSecondModelReview(action, apiKey);

      if (review.decision === 'approve') {
        const result: ApprovalResult = {
          actionId: action.id,
          decision: 'approved',
          tier: 2,
          reviewerModel: 'google/gemini-flash-1.5',
          reviewerReason: review.reason,
          decidedAt: new Date().toISOString(),
        };
        logApprovalDecision(action, result);
        // Notify renderer of the auto-approval for execution stream
        event.sender.send('approval:pendingApproval', { type: 'auto-approved', action, result });
        return result;
      }

      if (review.decision === 'reject') {
        const result: ApprovalResult = {
          actionId: action.id,
          decision: 'rejected',
          tier: 2,
          reviewerModel: 'google/gemini-flash-1.5',
          reviewerReason: review.reason,
          decidedAt: new Date().toISOString(),
        };
        logApprovalDecision(action, result);
        return result;
      }

      // escalate_to_human
      return requestHumanApproval(event, action, 2);
    }

    // Tier 3 — human approval required
    return requestHumanApproval(event, action, 3);
  });

  function requestHumanApproval(event: IpcMainInvokeEvent, action: ActionRequest, tier: ApprovalTier): Promise<ApprovalResult> {
    return new Promise((resolve) => {
      pendingHumanApprovals.set(action.id, { action, resolve });
      // Send to renderer to show approval card
      event.sender.send('approval:pendingApproval', { type: 'human-required', action, tier });
    });
  }

  ipcMain.handle('approval:humanDecision', async (_event, args: HumanDecisionArgs): Promise<void> => {
    const pending = pendingHumanApprovals.get(args.actionId);
    if (!pending) return;

    pendingHumanApprovals.delete(args.actionId);

    const result: ApprovalResult = {
      actionId: args.actionId,
      decision: args.decision,
      tier: 3,
      reviewerModel: null,
      reviewerReason: args.note,
      decidedAt: new Date().toISOString(),
    };

    logApprovalDecision(pending.action, result);
    pending.resolve(result);
  });

  ipcMain.handle('approval:getQueue', () => {
    return Array.from(pendingHumanApprovals.values()).map(p => p.action);
  });

  ipcMain.handle('approval:getLog', () => getRecentApprovals(20));

  // ── Component 13: Change Engine IPC ──────────────────────────────────

  ipcMain.handle('changeEngine:createWorkspaceRun', async (_event, args: CreateWorkspaceRunArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.createWorkspaceRun(args.missionId, args.planStepId, args.projectRoot);
  });

  ipcMain.handle('changeEngine:applyPatch', async (_event, args: ApplyPatchArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.applyPatch(args.workspaceRunId, {
      filePath: args.filePath,
      operation: args.operation,
      newContent: args.newContent,
      rationale: args.rationale,
    });
  });

  ipcMain.handle('changeEngine:getChangeSet', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getChangeSet(workspaceRunId);
  });

  ipcMain.handle('changeEngine:runValidityChecks', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.runValidityChecks(workspaceRunId);
  });

  ipcMain.handle('changeEngine:createCheckpoint', async (_event, workspaceRunId: string, label: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.createCheckpoint(workspaceRunId, label);
  });

  ipcMain.handle('changeEngine:rollbackToCheckpoint', async (_event, checkpointId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.rollbackToCheckpoint(checkpointId);
  });

  ipcMain.handle('changeEngine:getSemanticGroups', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getSemanticGroups(workspaceRunId);
  });

  ipcMain.handle('changeEngine:getDuplicateWarnings', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.getDuplicateWarnings(workspaceRunId);
  });

  ipcMain.handle('changeEngine:commitWorkspace', async (_event, args: CommitWorkspaceArgs) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.commitWorkspace(args.workspaceRunId, args.message);
  });

  ipcMain.handle('changeEngine:cleanupWorkspace', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.cleanupWorkspace(workspaceRunId);
  });

  ipcMain.handle('changeEngine:listWorkspaceRuns', async (_event, missionId?: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.listWorkspaceRuns(missionId);
  });

  ipcMain.handle('changeEngine:listCheckpoints', async (_event, workspaceRunId: string) => {
    if (!changeEngine) throw new Error('Change engine not initialized');
    return changeEngine.listCheckpoints(workspaceRunId);
  });

  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  createWindow();

  // Only init auto-updater in packaged builds (not dev mode)
  if (app.isPackaged && mainWindow) {
    initAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  // ── Component 17: Deploy IPC ─────────────────────────────────────────────

  ipcMain.handle('deploy:initiate', async (_event, args: DeployInitiateArgs): Promise<DeployWorkflow> => {
    if (!localDb) throw new Error('Database not initialized');
    const coolifyClient = new CoolifyClient('', ''); // API key from keytar in production
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.initiateDeploy(args.candidateId, args.environmentId, args.projectId);
  });

  ipcMain.handle('deploy:getStatus', async (_event, workflowId: string): Promise<DeployWorkflow | null> => {
    if (!localDb) return null;
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.getStatus(workflowId);
  });

  ipcMain.handle('deploy:getHistory', async (_event, projectId: string): Promise<DeployWorkflow[]> => {
    if (!localDb) return [];
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.getHistory(projectId);
  });

  ipcMain.handle('deploy:rollback', async (_event, workflowId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!localDb) return { success: false, error: 'Database not initialized' };
    const coolifyClient = new CoolifyClient('', '');
    const engine = new DeployEngine(localDb, coolifyClient);
    return engine.rollback(workflowId);
  });

  // ── Component 17: Environment IPC ─────────────────────────────────────────

  ipcMain.handle('environment:list', async (_event, projectId: string): Promise<Environment[]> => {
    if (!localDb) return [];
    const manager = new EnvironmentManager(localDb);
    return manager.listEnvironments(projectId);
  });

  ipcMain.handle('environment:get', async (_event, id: string): Promise<Environment | null> => {
    if (!localDb) return null;
    const manager = new EnvironmentManager(localDb);
    return manager.getEnvironment(id);
  });

  ipcMain.handle('environment:create', async (_event, env: Omit<Environment, 'id'>): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    return manager.createEnvironment(env);
  });

  ipcMain.handle('environment:update', async (_event, id: string, updates: Partial<Environment>): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const result = await manager.updateEnvironment(id, updates);
    if (!result) throw new Error(`Environment ${id} not found`);
    return result;
  });

  ipcMain.handle('environment:delete', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const manager = new EnvironmentManager(localDb);
    return { success: manager.deleteEnvironment(id) };
  });

  ipcMain.handle('environment:createPreview', async (_event, projectId: string, branch: string): Promise<Environment> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    return manager.createPreviewEnvironment(projectId, branch);
  });

  ipcMain.handle('environment:destroyPreview', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const manager = new EnvironmentManager(localDb);
    return { success: manager.destroyPreviewEnvironment(id) };
  });

  ipcMain.handle('environment:promote', async (_event, fromEnvId: string, toEnvId: string, candidateId: string): Promise<DeployWorkflow> => {
    if (!localDb) throw new Error('Database not initialized');
    const manager = new EnvironmentManager(localDb);
    const result = manager.promote(fromEnvId, toEnvId, candidateId);
    if (!result) throw new Error('Promotion failed');
    return result;
  });

  // ── Component 17: Drift IPC ───────────────────────────────────────────────

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
  syncEngine?.stop();
  localDb?.close();
});
