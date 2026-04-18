/**
 * Updater IPC handlers: updater:downloadUpdate, updater:installUpdate
 */

import { ipcMain } from 'electron';
import { downloadUpdate, installUpdate } from '../../lib/updater/auto-updater';

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:downloadUpdate', async () => downloadUpdate());
  ipcMain.handle('updater:installUpdate', async () => installUpdate());
}
