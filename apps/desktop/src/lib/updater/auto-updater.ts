/**
 * Auto-updater using electron-updater for GitHub Releases.
 * Only runs in packaged builds — never in dev mode.
 * All errors are non-fatal: the app must not crash if update checks fail.
 */

import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';
import type { BrowserWindow } from 'electron';

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Configure for GitHub Releases
  autoUpdater.autoDownload = false; // Don't auto-download — let user decide
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[updater] Update available:', info.version);
    mainWindow.webContents.send('updater:update-available', {
      version: info.version,
      releaseDate: info.releaseDate?.toISOString() ?? '',
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No update available');
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    mainWindow.webContents.send('updater:download-progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[updater] Update downloaded:', info.version);
    mainWindow.webContents.send('updater:update-downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[updater] Error:', err.message);
    // Don't crash the app on updater errors
  });

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.warn('[updater] Check failed (non-fatal):', err.message);
    });
  }, 5000);
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err: Error) => {
    console.error('[updater] Download failed:', err.message);
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
