/**
 * Helper functions used across IPC handlers.
 */

import * as os from 'os';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localDb, supabase, container as state } from './state';
import { SyncEngine } from '../../lib/sync/sync-engine';
import { SecretsSync } from '../../lib/secrets/secrets-sync';

export function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !anonKey) {
    console.error('[main] Supabase not configured: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing');
    return null;
  }

  const client = createClient(supabaseUrl, anonKey);
  state.supabase = client;
  return client;
}

export async function getCurrentUserId(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) return '';
  const { data } = await client.auth.getSession();
  return data.session?.user?.id ?? '';
}

/** Get the repo path for a project. For self-maintenance, use VibeFlow repo. */
export async function getProjectRepoPath(projectId: string): Promise<string> {
  if (!localDb) return process.cwd();
  const userId = await getCurrentUserId();
  const project = localDb.listProjects(userId).find(p => p.id === projectId);
  if (project?.isSelfMaintenance) {
    if (app.isPackaged) return app.getAppPath();
    return path.resolve(__dirname, '../../../..');
  }
  return process.cwd();
}

export async function initSyncEngine(userId: string): Promise<void> {
  if (!state.localDb) {
    console.warn('[main] Cannot init sync: LocalDb not initialized');
    if (state.mainWindow) {
      state.mainWindow.webContents.send('sync:statusChanged', 'offline');
    }
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[main] Supabase not configured — sync disabled');
    if (state.mainWindow) {
      state.mainWindow.webContents.send('sync:statusChanged', 'offline');
    }
    return;
  }

  let deviceId = state.localDb.getDeviceId();
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    state.localDb.setDeviceId(deviceId);
    console.log('[main] Generated new device ID:', deviceId);
  }

  const deviceName = os.hostname();

  state.syncEngine = new SyncEngine(client, deviceId, deviceName, userId, state.localDb);

  state.syncEngine.on((event) => {
    if (event.type === 'sync-status-changed' && state.mainWindow) {
      state.mainWindow.webContents.send('sync:statusChanged', event.data);
    }
  });

  try {
    await state.syncEngine.start();
    console.log('[main] Sync engine started for user:', userId);
  } catch (err) {
    console.error('[main] Sync engine start failed:', err);
    if (state.mainWindow) {
      state.mainWindow.webContents.send('sync:statusChanged', 'degraded');
    }
  }

  state.secretsSync = new SecretsSync(client, userId);
}

export function createWindow(): void {
  state.mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    state.mainWindow!.loadURL('http://localhost:5173');
  } else {
    state.mainWindow!.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}
