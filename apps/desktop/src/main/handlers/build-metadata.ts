/**
 * Build Metadata IPC handlers: buildMetadata:get
 */

import { ipcMain } from 'electron';
import { BUILD_METADATA } from '../../lib/build-metadata';

export function registerBuildMetadataHandlers(): void {
  ipcMain.handle('buildMetadata:get', async () => BUILD_METADATA);
}
