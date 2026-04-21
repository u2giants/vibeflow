/**
 * Updater IPC handlers: updater:downloadUpdate, updater:installUpdate
 */

import { ipcMain, shell } from 'electron';
import { downloadUpdate, installUpdate } from '../../lib/updater/auto-updater';

const RELEASES_URL = 'https://github.com/u2giants/vibeflow/releases/latest';

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:downloadUpdate', async () => downloadUpdate());
  ipcMain.handle('updater:installUpdate', async () => installUpdate());
  ipcMain.handle('updater:openReleasePage', async () => shell.openExternal(RELEASES_URL));
}
