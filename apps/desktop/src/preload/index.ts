/**
 * Preload script — exposes safe IPC API to the renderer process.
 * Uses contextBridge to prevent direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { VibeFlowAPI, CreateConversationArgs, SendMessageArgs, StreamTokenData, StreamDoneData, StreamErrorData } from '../lib/shared-types';
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
  conversations: {
    list: (projectId: string) => ipcRenderer.invoke('conversations:list', projectId),
    create: (args: CreateConversationArgs) => ipcRenderer.invoke('conversations:create', args),
    getMessages: (conversationId: string) => ipcRenderer.invoke('conversations:getMessages', conversationId),
    sendMessage: (args: SendMessageArgs) => ipcRenderer.invoke('conversations:sendMessage', args),
    onStreamToken: (callback: (data: StreamTokenData) => void) => {
      ipcRenderer.on('conversations:streamToken', (_event, data) => callback(data));
    },
    onStreamDone: (callback: (data: StreamDoneData) => void) => {
      ipcRenderer.on('conversations:streamDone', (_event, data) => callback(data));
    },
    onStreamError: (callback: (data: StreamErrorData) => void) => {
      ipcRenderer.on('conversations:streamError', (_event, data) => callback(data));
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('conversations:streamToken');
      ipcRenderer.removeAllListeners('conversations:streamDone');
      ipcRenderer.removeAllListeners('conversations:streamError');
    },
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
