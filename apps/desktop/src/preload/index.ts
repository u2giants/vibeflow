/**
 * Preload script — exposes safe IPC API to the renderer process.
 * Uses contextBridge to prevent direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { VibeFlowAPI, CreateConversationArgs, SendMessageArgs, StreamTokenData, StreamDoneData, StreamErrorData, TerminalRunArgs, GitCommitArgs, GitPushArgs, SshHost, ProjectDevOpsConfig, ActionRequest, HumanDecisionArgs, GenerateHandoffArgs } from '../lib/shared-types';
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
      // Initial status
      callback('offline' as SyncStatus);
      const handler = (_event: unknown, status: string) => {
        callback(status as SyncStatus);
      };
      ipcRenderer.on('sync:statusChanged', handler);
      return () => {
        ipcRenderer.removeListener('sync:statusChanged', handler);
      };
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
  sync: {
    getDeviceId: () => ipcRenderer.invoke('sync:getDeviceId'),
    registerDevice: () => ipcRenderer.invoke('sync:registerDevice'),
    syncAll: () => ipcRenderer.invoke('sync:syncAll'),
    acquireLease: (conversationId: string) => ipcRenderer.invoke('sync:acquireLease', conversationId),
    releaseLease: (conversationId: string) => ipcRenderer.invoke('sync:releaseLease', conversationId),
    takeoverLease: (conversationId: string) => ipcRenderer.invoke('sync:takeoverLease', conversationId),
    getLease: (conversationId: string) => ipcRenderer.invoke('sync:getLease', conversationId),
  },
  tooling: {
    files: {
      read: (filePath: string, projectRoot?: string) => ipcRenderer.invoke('files:read', filePath, projectRoot),
      write: (filePath: string, content: string, projectRoot?: string) => ipcRenderer.invoke('files:write', filePath, content, projectRoot),
      list: (dirPath: string, projectRoot?: string) => ipcRenderer.invoke('files:list', dirPath, projectRoot),
      exists: (filePath: string, projectRoot?: string) => ipcRenderer.invoke('files:exists', filePath, projectRoot),
    },
    terminal: {
      run: (args: TerminalRunArgs) => ipcRenderer.invoke('terminal:run', args),
      kill: (commandId: string) => ipcRenderer.invoke('terminal:kill', commandId),
      onOutput: (callback: (data: { commandId: string; text: string; stream: string }) => void) => {
        ipcRenderer.on('terminal:output', (_event, data) => callback(data));
      },
      onDone: (callback: (data: { commandId: string; result: any }) => void) => {
        ipcRenderer.on('terminal:done', (_event, data) => callback(data));
      },
      removeListeners: () => {
        ipcRenderer.removeAllListeners('terminal:output');
        ipcRenderer.removeAllListeners('terminal:done');
      },
    },
    git: {
      status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
      diff: (repoPath: string, staged: boolean = false) => ipcRenderer.invoke('git:diff', repoPath, staged),
      commit: (args: GitCommitArgs) => ipcRenderer.invoke('git:commit', args),
      push: (args: GitPushArgs) => ipcRenderer.invoke('git:push', args),
      log: (repoPath: string, limit: number = 10) => ipcRenderer.invoke('git:log', repoPath, limit),
    },
    ssh: {
      discoverHosts: () => ipcRenderer.invoke('ssh:discoverHosts'),
      discoverKeys: () => ipcRenderer.invoke('ssh:discoverKeys'),
      testConnection: (host: SshHost) => ipcRenderer.invoke('ssh:testConnection', host),
    },
  },
  devops: {
    listTemplates: () => ipcRenderer.invoke('devops:listTemplates'),
    getProjectConfig: (projectId: string) => ipcRenderer.invoke('devops:getProjectConfig', projectId),
    saveProjectConfig: (config: ProjectDevOpsConfig) => ipcRenderer.invoke('devops:saveProjectConfig', config),
    setGitHubToken: (token: string) => ipcRenderer.invoke('devops:setGitHubToken', token),
    setCoolifyApiKey: (apiKey: string) => ipcRenderer.invoke('devops:setCoolifyApiKey', apiKey),
    listWorkflowRuns: (owner: string, repo: string) => ipcRenderer.invoke('devops:listWorkflowRuns', owner, repo),
    deploy: (appId: string, baseUrl: string) => ipcRenderer.invoke('devops:deploy', appId, baseUrl),
    restart: (appId: string, baseUrl: string) => ipcRenderer.invoke('devops:restart', appId, baseUrl),
    stop: (appId: string, baseUrl: string) => ipcRenderer.invoke('devops:stop', appId, baseUrl),
    healthCheck: (url: string) => ipcRenderer.invoke('devops:healthCheck', url),
    listDeployRuns: (projectId: string) => ipcRenderer.invoke('devops:listDeployRuns', projectId),
  },
  approval: {
    requestAction: (action: ActionRequest) => ipcRenderer.invoke('approval:requestAction', action),
    humanDecision: (args: HumanDecisionArgs) => ipcRenderer.invoke('approval:humanDecision', args),
    getQueue: () => ipcRenderer.invoke('approval:getQueue'),
    getLog: () => ipcRenderer.invoke('approval:getLog'),
    onPendingApproval: (callback: (data: { type: string; action: ActionRequest; tier?: number; result?: any }) => void) => {
      ipcRenderer.on('approval:pendingApproval', (_event, data) => callback(data));
    },
    removePendingApprovalListener: () => {
      ipcRenderer.removeAllListeners('approval:pendingApproval');
    },
  },
  handoff: {
    generate: (args: GenerateHandoffArgs) => ipcRenderer.invoke('handoff:generate', args),
    getIdiosyncrasies: () => ipcRenderer.invoke('handoff:getIdiosyncrasies'),
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
