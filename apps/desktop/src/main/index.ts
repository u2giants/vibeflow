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
import { LocalDb } from '../lib/storage';
import { BUILD_METADATA } from '../lib/build-metadata';
import type {
  AuthSignInResult,
  CreateProjectArgs,
} from '../lib/shared-types';
import { SyncStatus } from '../lib/shared-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let mainWindow: BrowserWindow | null = null;
let localDb: LocalDb | null = null;
let supabase: SupabaseClient | null = null;

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
                .then(({ data, error: exchangeError }) => {
                  if (exchangeError) {
                    resolve({ success: false, error: exchangeError.message });
                    return;
                  }

                  resolve({
                    success: true,
                    account: {
                      id: data.session?.user?.id ?? '',
                      email: data.session?.user?.email ?? '',
                      displayName: data.session?.user?.user_metadata?.display_name ?? null,
                      createdAt: data.session?.user?.created_at ?? '',
                    },
                  });
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
  } catch (err) {
    console.error('[main] SQLite DB init failed (non-fatal):', err);
    localDb = null;
  }

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
  localDb?.close();
});
