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
import { SyncEngine } from '../lib/sync/sync-engine';
import { FileService } from '../lib/tooling/file-service';
import { TerminalService } from '../lib/tooling/terminal-service';
import { GitService } from '../lib/tooling/git-service';
import { SshService } from '../lib/tooling/ssh-service';
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

// ── Sync Engine ─────────────────────────────────────────────────────

async function initSyncEngine(userId: string): Promise<void> {
  // Sync is temporarily disabled due to SQLite native module issues.
  // The app works fully without sync — all data is stored locally.
  // Sync will be re-enabled in a future milestone.
  console.log('[main] Sync is temporarily disabled. All data is stored locally.');
  if (mainWindow) {
    mainWindow.webContents.send('sync:statusChanged', 'offline');
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

  // ── Sync IPC Handlers (temporarily disabled — all data is local) ──

  ipcMain.handle('sync:getDeviceId', async (): Promise<string | null> => 'local');

  ipcMain.handle(
    'sync:registerDevice',
    async (): Promise<{ deviceId: string; deviceName: string }> => ({
      deviceId: 'local',
      deviceName: os.hostname(),
    })
  );

  ipcMain.handle('sync:syncAll', async (): Promise<{ success: boolean }> => ({ success: true }));
  ipcMain.handle('sync:acquireLease', async (): Promise<{ success: boolean; error?: string }> => ({ success: true }));
  ipcMain.handle('sync:releaseLease', async (): Promise<{ success: boolean }> => ({ success: true }));
  ipcMain.handle('sync:takeoverLease', async (): Promise<{ success: boolean; error?: string }> => ({ success: true }));
  ipcMain.handle('sync:getLease', async (): Promise<null> => null);

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

  createWindow();

  // Only init auto-updater in packaged builds (not dev mode)
  if (app.isPackaged && mainWindow) {
    initAutoUpdater(mainWindow);
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
  // syncEngine is disabled — no stop needed
  localDb?.close();
});
