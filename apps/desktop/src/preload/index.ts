/**
 * Preload script — exposes safe IPC API to the renderer process.
 * Uses contextBridge to prevent direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { VibeFlowAPI } from '../lib/shared-types';
import { SyncStatus } from '../lib/shared-types';

const api: VibeFlowAPI = {
  auth: {
    signInWithGitHub: () => ipcRenderer.invoke('auth:signInWithGitHub'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (args) => ipcRenderer.invoke('projects:create', args),
  },
  buildMetadata: {
    get: () => ipcRenderer.invoke('buildMetadata:get'),
  },
  syncStatus: {
    subscribe: (callback) => {
      // TODO: Implement real sync status events from main process
      callback(SyncStatus.Offline);
      return () => {};
    },
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
