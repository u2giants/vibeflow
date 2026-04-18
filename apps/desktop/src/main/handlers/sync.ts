/**
 * Sync IPC handlers: sync:getStatus, sync:getDeviceId, sync:registerDevice, sync:syncAll,
 * sync:acquireLease, sync:releaseLease, sync:takeoverLease, sync:getLease
 */

import { ipcMain } from 'electron';
import * as os from 'os';
import { localDb, syncEngine } from './state';

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:getStatus', async (): Promise<string> => {
    return syncEngine?.getStatus() ?? 'offline';
  });

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
      const deviceName = os.hostname();
      // Also register with Supabase if sync engine is running
      if (syncEngine) {
        try {
          await syncEngine.registerDevice();
        } catch (err) {
          console.warn('[main] sync:registerDevice Supabase registration failed (non-fatal):', err);
        }
      }
      return { deviceId, deviceName };
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
}
