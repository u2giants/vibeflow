/**
 * Modes IPC handlers: modes:list, modes:updateSoul, modes:updateModel, modes:updateConfig
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { UpdateModeSoulArgs, UpdateModeModelArgs, UpdateModeConfigArgs } from '../../lib/shared-types';
import { localDb, syncEngine } from './state';

export function registerModesHandlers(): void {
  ipcMain.handle('modes:list', async () => {
    if (!localDb) return [];
    return localDb.listModes();
  });

  ipcMain.handle(
    'modes:updateSoul',
    async (_event: IpcMainInvokeEvent, args: UpdateModeSoulArgs) => {
      if (!localDb) throw new Error('DB not initialized');
      localDb.updateModeSoul(args.modeId, args.soul);
      const updatedMode = localDb.listModes().find(m => m.id === args.modeId);
      if (syncEngine && updatedMode) {
        syncEngine.pushMode(updatedMode).catch(err =>
          console.warn('[main] pushMode failed (non-fatal):', err)
        );
      }
      return { success: true };
    }
  );

  ipcMain.handle(
    'modes:updateModel',
    async (_event: IpcMainInvokeEvent, args: UpdateModeModelArgs) => {
      if (!localDb) throw new Error('DB not initialized');
      localDb.updateModeModel(args.modeId, args.modelId);
      const updatedMode = localDb.listModes().find(m => m.id === args.modeId);
      if (syncEngine && updatedMode) {
        syncEngine.pushMode(updatedMode).catch(err =>
          console.warn('[main] pushMode failed (non-fatal):', err)
        );
      }
      return { success: true };
    }
  );

  ipcMain.handle(
    'modes:updateConfig',
    async (_event: IpcMainInvokeEvent, args: UpdateModeConfigArgs) => {
      if (!localDb) throw new Error('DB not initialized');
      const existing = localDb.listModes().find(m => m.id === args.modeId);
      if (!existing) throw new Error('Mode not found');
      const temperature = args.temperature ?? existing.temperature;
      const approvalPolicy = args.approvalPolicy ?? existing.approvalPolicy;
      const fallbackModelId = args.fallbackModelId !== undefined ? args.fallbackModelId : existing.fallbackModelId;
      localDb.updateModeConfig(args.modeId, temperature, approvalPolicy, fallbackModelId);
      const updatedMode = localDb.listModes().find(m => m.id === args.modeId);
      if (syncEngine && updatedMode) {
        syncEngine.pushMode(updatedMode).catch(err =>
          console.warn('[main] pushMode failed (non-fatal):', err)
        );
      }
      return { success: true };
    }
  );
}
