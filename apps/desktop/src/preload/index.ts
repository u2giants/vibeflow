/**
 * Preload script — exposes safe IPC API to the renderer process.
 * Uses contextBridge to prevent direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { VibeFlowAPI, CreateConversationArgs, SendMessageArgs, StreamTokenData, StreamDoneData, StreamErrorData, TerminalRunArgs, GitCommitArgs, GitPushArgs, SshHost, ProjectDevOpsConfig, ActionRequest, HumanDecisionArgs, GenerateHandoffArgs, DecomposeMissionArgs, AssignRoleArgs, McpServerConfig, CapabilityHealth, ContextPackOptions, ContextPackUpdates, CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs } from '../lib/shared-types';
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
    getSelfMaintenance: () => ipcRenderer.invoke('projects:getSelfMaintenance'),
    createSelfMaintenance: () => ipcRenderer.invoke('projects:createSelfMaintenance'),
    getVibeFlowRepoPath: () => ipcRenderer.invoke('projects:getVibeFlowRepoPath'),
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
      ipcRenderer.removeAllListeners('conversations:streamToken');
      ipcRenderer.on('conversations:streamToken', (_event, data) => callback(data));
    },
    onStreamDone: (callback: (data: StreamDoneData) => void) => {
      ipcRenderer.removeAllListeners('conversations:streamDone');
      ipcRenderer.on('conversations:streamDone', (_event, data) => callback(data));
    },
    onStreamError: (callback: (data: StreamErrorData) => void) => {
      ipcRenderer.removeAllListeners('conversations:streamError');
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
  updater: {
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
    onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => {
      ipcRenderer.on('updater:update-available', (_event, info) => callback(info));
    },
    onDownloadProgress: (callback: (progress: { percent: number }) => void) => {
      ipcRenderer.on('updater:download-progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
      ipcRenderer.on('updater:update-downloaded', (_event, info) => callback(info));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('updater:update-available');
      ipcRenderer.removeAllListeners('updater:download-progress');
      ipcRenderer.removeAllListeners('updater:update-downloaded');
    },
  },
  // Component 12: Orchestrator IPC (stub — wired in Phase 4)
  orchestrator: {
    decomposeMission: (args: DecomposeMissionArgs) => ipcRenderer.invoke('orchestrator:decomposeMission', args),
    assignRole: (args: AssignRoleArgs) => ipcRenderer.invoke('orchestrator:assignRole', args),
    getPlan: (missionId: string) => ipcRenderer.invoke('orchestrator:getPlan', missionId),
    getState: () => ipcRenderer.invoke('orchestrator:getState'),
  },
  // Component 14: Capabilities and MCP
  capabilities: {
    list: () => ipcRenderer.invoke('capabilities:list'),
    get: (id: string) => ipcRenderer.invoke('capabilities:get', id),
    getHealth: () => ipcRenderer.invoke('capabilities:getHealth'),
    getInvocationLog: (capabilityId: string, limit?: number) => ipcRenderer.invoke('capabilities:getInvocationLog', capabilityId, limit ?? 50),
  },
  mcp: {
    list: () => ipcRenderer.invoke('mcp:list'),
    add: (config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'health' | 'discoveredTools'>) => ipcRenderer.invoke('mcp:add', config),
    update: (id: string, updates: Partial<McpServerConfig>) => ipcRenderer.invoke('mcp:update', id, updates),
    remove: (id: string) => ipcRenderer.invoke('mcp:remove', id),
    enable: (id: string) => ipcRenderer.invoke('mcp:enable', id),
    disable: (id: string) => ipcRenderer.invoke('mcp:disable', id),
    testConnection: (id: string) => ipcRenderer.invoke('mcp:testConnection', id),
    executeTool: (serverId: string, toolName: string, parameters: Record<string, unknown>) => ipcRenderer.invoke('mcp:executeTool', serverId, toolName, parameters),
    onHealthChanged: (callback: (data: { serverId: string; health: CapabilityHealth }) => void) => {
      ipcRenderer.on('mcp:healthChanged', (_event, data: { serverId: string; health: CapabilityHealth }) => callback(data));
    },
    removeHealthChangedListener: () => {
      ipcRenderer.removeAllListeners('mcp:healthChanged');
    },
  },
  // Component 11: Project Intelligence
  projectIntelligence: {
    getIndex: (projectId: string) => ipcRenderer.invoke('projectIntelligence:getIndex', projectId),
    triggerIndex: (projectId: string, options?: { fullReindex: boolean }) => ipcRenderer.invoke('projectIntelligence:triggerIndex', projectId, options),
    getIndexStatus: (projectId: string) => ipcRenderer.invoke('projectIntelligence:getIndexStatus', projectId),
    getFiles: (projectId: string, filter?: { language?: string; isGenerated?: boolean }) => ipcRenderer.invoke('projectIntelligence:getFiles', projectId, filter),
    getFile: (projectId: string, path: string) => ipcRenderer.invoke('projectIntelligence:getFile', projectId, path),
    getSymbols: (projectId: string, filter?: { fileId?: string; kind?: string }) => ipcRenderer.invoke('projectIntelligence:getSymbols', projectId, filter),
    getSymbol: (projectId: string, id: string) => ipcRenderer.invoke('projectIntelligence:getSymbol', projectId, id),
    getImpactAnalysis: (projectId: string, targetPath: string) => ipcRenderer.invoke('projectIntelligence:getImpactAnalysis', projectId, targetPath),
    getTopology: (projectId: string) => ipcRenderer.invoke('projectIntelligence:getTopology', projectId),
    getConfigVariables: (projectId: string) => ipcRenderer.invoke('projectIntelligence:getConfigVariables', projectId),
    getMissingConfig: (projectId: string, environment: string) => ipcRenderer.invoke('projectIntelligence:getMissingConfig', projectId, environment),
    getDetectedStack: (projectId: string) => ipcRenderer.invoke('projectIntelligence:getDetectedStack', projectId),
  },
  // Component 11: Context Packs
  contextPacks: {
    createPack: (missionId: string, options?: ContextPackOptions) => ipcRenderer.invoke('contextPacks:createPack', missionId, options),
    getPack: (packId: string) => ipcRenderer.invoke('contextPacks:getPack', packId),
    getPackForMission: (missionId: string) => ipcRenderer.invoke('contextPacks:getPackForMission', missionId),
    updatePack: (packId: string, updates: ContextPackUpdates) => ipcRenderer.invoke('contextPacks:updatePack', packId, updates),
    pinItem: (packId: string, itemId: string) => ipcRenderer.invoke('contextPacks:pinItem', packId, itemId),
    unpinItem: (packId: string, itemId: string) => ipcRenderer.invoke('contextPacks:unpinItem', packId, itemId),
    swapStaleItem: (packId: string, itemId: string) => ipcRenderer.invoke('contextPacks:swapStaleItem', packId, itemId),
    getDashboard: (packId: string) => ipcRenderer.invoke('contextPacks:getDashboard', packId),
  },
  // Component 13: Change Engine
  changeEngine: {
    createWorkspaceRun: (args: CreateWorkspaceRunArgs) => ipcRenderer.invoke('changeEngine:createWorkspaceRun', args),
    applyPatch: (args: ApplyPatchArgs) => ipcRenderer.invoke('changeEngine:applyPatch', args),
    getChangeSet: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:getChangeSet', workspaceRunId),
    runValidityChecks: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:runValidityChecks', workspaceRunId),
    createCheckpoint: (workspaceRunId: string, label: string) => ipcRenderer.invoke('changeEngine:createCheckpoint', workspaceRunId, label),
    rollbackToCheckpoint: (checkpointId: string) => ipcRenderer.invoke('changeEngine:rollbackToCheckpoint', checkpointId),
    getSemanticGroups: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:getSemanticGroups', workspaceRunId),
    getDuplicateWarnings: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:getDuplicateWarnings', workspaceRunId),
    commitWorkspace: (args: CommitWorkspaceArgs) => ipcRenderer.invoke('changeEngine:commitWorkspace', args),
    cleanupWorkspace: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:cleanupWorkspace', workspaceRunId),
    listWorkspaceRuns: (missionId?: string) => ipcRenderer.invoke('changeEngine:listWorkspaceRuns', missionId),
    listCheckpoints: (workspaceRunId: string) => ipcRenderer.invoke('changeEngine:listCheckpoints', workspaceRunId),
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
