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
  modes: {
    list: () => ipcRenderer.invoke('modes:list'),
    updateSoul: (args) => ipcRenderer.invoke('modes:updateSoul', args),
    updateModel: (args) => ipcRenderer.invoke('modes:updateModel', args),
  },
  openrouter: {
    setApiKey: (key: string) => ipcRenderer.invoke('openrouter:setApiKey', key),
    getApiKey: () => ipcRenderer.invoke('openrouter:getApiKey'),
    listModels: () => ipcRenderer.invoke('openrouter:listModels'),
    testConnection: () => ipcRenderer.invoke('openrouter:testConnection'),
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
