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

import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
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

const KEYTAR_SERVICE = 'vibeflow';
const KEYTAR_OPENROUTER_KEY = 'openrouter-api-key';

let mainWindow: BrowserWindow | null = null;
let localDb: LocalDb | null = null;
let supabase: SupabaseClient | null = null;
let syncEngine: SyncEngine | null = null;

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
  if (syncEngine) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[main] Supabase not configured, sync disabled');
    return;
  }

  let deviceId = localDb?.getDeviceId() ?? null;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localDb?.setDeviceId(deviceId);
  }

  const deviceName = os.hostname();

  syncEngine = new SyncEngine(supabaseUrl, supabaseAnonKey, deviceId, deviceName, userId, localDb!);

  // Forward sync status events to renderer
  syncEngine.on((event) => {
    if (event.type === 'sync-status-changed' && mainWindow) {
      mainWindow.webContents.send('sync:statusChanged', event.data);
    }
  });

  await syncEngine.start();
  console.log('[main] Sync engine started for user', userId);
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
    mainWindow!.webContents.openDevTools();
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

      // Find an available port for the temporary callback server
      const callbackPort = 54321;
      const callbackPath = '/callback';

      return new Promise<AuthSignInResult>((resolve) => {
        // Create a temporary HTTP server to capture the OAuth callback
        const server = http.createServer((req, res) => {
          const parsedUrl = url.parse(req.url ?? '', true);

          if (parsedUrl.pathname === callbackPath) {
            const code = parsedUrl.query.code as string | undefined;
            const error = parsedUrl.query.error as string | undefined;

            // Send a response to the browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            if (error) {
              res.end('<html><body><h1>Authentication failed</h1><p>You can close this window and return to VibeFlow.</p></body></html>');
              resolve({ success: false, error: `OAuth error: ${error}` });
            } else if (code) {
              res.end('<html><body><h1>Authentication successful!</h1><p>You can close this window and return to VibeFlow.</p></body></html>');

              // Exchange the code for a session
              client.auth
                .exchangeCodeForSession(code)
                .then(async ({ data, error: exchangeError }) => {
                  if (exchangeError) {
                    resolve({ success: false, error: exchangeError.message });
                    return;
                  }

                  const result: AuthSignInResult = {
                    success: true,
                    account: {
                      id: data.session?.user?.id ?? '',
                      email: data.session?.user?.email ?? '',
                      displayName: data.session?.user?.user_metadata?.display_name ?? null,
                      createdAt: data.session?.user?.created_at ?? '',
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

                  resolve(result);
                })
                .catch((err) => {
                  resolve({ success: false, error: String(err) });
                });
            } else {
              res.end('<html><body><h1>No auth code received</h1><p>You can close this window and return to VibeFlow.</p></body></html>');
              resolve({ success: false, error: 'No auth code received' });
            }

            // Close the server after handling the callback
            server.close();
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        server.listen(callbackPort, '127.0.0.1', () => {
          console.log(`[main] OAuth callback server listening on http://127.0.0.1:${callbackPort}`);

          const redirectUrl = `http://127.0.0.1:${callbackPort}${callbackPath}`;

          client.auth
            .signInWithOAuth({
              provider: 'github',
              options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
              },
            })
            .then(({ data, error: oauthError }) => {
              if (oauthError) {
                server.close();
                resolve({ success: false, error: oauthError.message });
                return;
              }

              if (data?.url) {
                shell.openExternal(data.url);
              } else {
                server.close();
                resolve({ success: false, error: 'No OAuth URL received from Supabase' });
              }
            })
            .catch((err) => {
              server.close();
              resolve({ success: false, error: String(err) });
            });
        });

        server.on('error', (err) => {
          console.error('[main] OAuth callback server error:', err);
          resolve({ success: false, error: `Failed to start callback server: ${err.message}` });
        });
      });
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

  ipcMain.handle('buildMetadata:get', async () => BUILD_METADATA);

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
    const response = await fetch('https://openrouter.ai/api/v1/models', {
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
      const response = await fetch('https://openrouter.ai/api/v1/models', {
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

  // ── Sync IPC Handlers ─────────────────────────────────────────────

  ipcMain.handle('sync:getDeviceId', async (): Promise<string | null> => {
    return localDb?.getDeviceId() ?? null;
  });

  ipcMain.handle(
    'sync:registerDevice',
    async (): Promise<{ deviceId: string; deviceName: string }> => {
      if (!localDb) throw new Error('DB not initialized');
      if (!syncEngine) throw new Error('Sync engine not initialized');

      return {
        deviceId: syncEngine.getDeviceId(),
        deviceName: syncEngine.getDeviceName(),
      };
    }
  );

  ipcMain.handle('sync:syncAll', async (): Promise<{ success: boolean }> => {
    if (!syncEngine) throw new Error('Sync engine not initialized');
    await syncEngine.syncAll();
    return { success: true };
  });

  ipcMain.handle(
    'sync:acquireLease',
    async (_event: IpcMainInvokeEvent, conversationId: string): Promise<{ success: boolean; error?: string }> => {
      if (!syncEngine) throw new Error('Sync engine not initialized');
      return syncEngine.acquireLease(conversationId);
    }
  );

  ipcMain.handle(
    'sync:releaseLease',
    async (_event: IpcMainInvokeEvent, conversationId: string): Promise<{ success: boolean }> => {
      if (!syncEngine) throw new Error('Sync engine not initialized');
      return syncEngine.releaseLease(conversationId);
    }
  );

  ipcMain.handle(
    'sync:takeoverLease',
    async (_event: IpcMainInvokeEvent, conversationId: string): Promise<{ success: boolean; error?: string }> => {
      if (!syncEngine) throw new Error('Sync engine not initialized');
      return syncEngine.takeoverLease(conversationId);
    }
  );

  ipcMain.handle(
    'sync:getLease',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      if (!syncEngine) throw new Error('Sync engine not initialized');
      return syncEngine.getLease(conversationId);
    }
  );

  createWindow();

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
  syncEngine?.stop();
  localDb?.close();
});
