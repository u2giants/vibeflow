/**
 * Preload script — exposes safe IPC API to the renderer process.
 * Uses contextBridge to prevent direct Node.js access.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { VibeFlowAPI, CreateConversationArgs, SendMessageArgs, StreamTokenData, StreamDoneData, StreamErrorData, TerminalRunArgs, GitCommitArgs, GitPushArgs, SshHost, ProjectDevOpsConfig, ActionRequest, HumanDecisionArgs, GenerateHandoffArgs, DecomposeMissionArgs, AssignRoleArgs, McpServerConfig, CapabilityHealth, ContextPackOptions, ContextPackUpdates, CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs, AuditHistoryFilter, RuntimeStartArgs, BrowserSessionArgs, SecretRecord, MigrationPlan, MigrationRiskClass, Environment, DeployWorkflow, DriftReport, DeployInitiateArgs, WatchStartSessionArgs, SelfHealingExecuteArgs, UpdateModeConfigArgs, ExecutionEventData, CreateSshTargetArgs } from '../lib/shared-types';
import { SyncStatus } from '../lib/shared-types';

const api: VibeFlowAPI = {
  auth: {
    signInWithGitHub: () => ipcRenderer.invoke('auth:signInWithGitHub'),
    signInWithEmail: (email: string, password: string) => ipcRenderer.invoke('auth:signInWithEmail', email, password),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (args) => ipcRenderer.invoke('projects:create', args),
    getSelfMaintenance: () => ipcRenderer.invoke('projects:getSelfMaintenance'),
    createSelfMaintenance: () => ipcRenderer.invoke('projects:createSelfMaintenance'),
    getVibeFlowRepoPath: () => ipcRenderer.invoke('projects:getVibeFlowRepoPath'),
    pickVibeFlowRepoPath: () => ipcRenderer.invoke('projects:pickVibeFlowRepoPath'),
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
    updateConfig: (args: UpdateModeConfigArgs) => ipcRenderer.invoke('modes:updateConfig', args),
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
    onExecutionEvent: (callback: (data: ExecutionEventData) => void) => {
      ipcRenderer.removeAllListeners('conversations:executionEvent');
      ipcRenderer.on('conversations:executionEvent', (_event, data) => callback(data));
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('conversations:streamToken');
      ipcRenderer.removeAllListeners('conversations:streamDone');
      ipcRenderer.removeAllListeners('conversations:streamError');
      ipcRenderer.removeAllListeners('conversations:executionEvent');
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
    createTemplate: (template: any) => ipcRenderer.invoke('devops:createTemplate', template),
    updateTemplate: (template: any) => ipcRenderer.invoke('devops:updateTemplate', template),
    deleteTemplate: (id: string) => ipcRenderer.invoke('devops:deleteTemplate', id),
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
  // Component 12: Orchestrator IPC
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
  // Component 15: Runtime Execution, Browser Automation, Evidence
  runtime: {
    start: (args: RuntimeStartArgs) => ipcRenderer.invoke('runtime:start', args),
    stop: (executionId: string) => ipcRenderer.invoke('runtime:stop', executionId),
    getStatus: (executionId: string) => ipcRenderer.invoke('runtime:getStatus', executionId),
    getExecutions: (missionId: string) => ipcRenderer.invoke('runtime:getExecutions', missionId),
    getLogs: (executionId: string) => ipcRenderer.invoke('runtime:getLogs', executionId),
  },
  browser: {
    startSession: (args: BrowserSessionArgs) => ipcRenderer.invoke('browser:startSession', args),
    navigate: (sessionId: string, url: string) => ipcRenderer.invoke('browser:navigate', sessionId, url),
    click: (sessionId: string, selector: string) => ipcRenderer.invoke('browser:click', sessionId, selector),
    fillForm: (sessionId: string, fields: Record<string, string>) => ipcRenderer.invoke('browser:fillForm', sessionId, fields),
    uploadFile: (sessionId: string, selector: string, filePath: string) => ipcRenderer.invoke('browser:uploadFile', sessionId, selector, filePath),
    screenshot: (sessionId: string, name: string) => ipcRenderer.invoke('browser:screenshot', sessionId, name),
    getConsoleLogs: (sessionId: string) => ipcRenderer.invoke('browser:getConsoleLogs', sessionId),
    getNetworkTraces: (sessionId: string) => ipcRenderer.invoke('browser:getNetworkTraces', sessionId),
    getDomSnapshot: (sessionId: string, selector: string) => ipcRenderer.invoke('browser:getDomSnapshot', sessionId, selector),
    closeSession: (sessionId: string) => ipcRenderer.invoke('browser:closeSession', sessionId),
  },
  evidence: {
    getForMission: (missionId: string) => ipcRenderer.invoke('evidence:getForMission', missionId),
    getForWorkspaceRun: (workspaceRunId: string) => ipcRenderer.invoke('evidence:getForWorkspaceRun', workspaceRunId),
    compareBeforeAfter: (beforeId: string, afterId: string) => ipcRenderer.invoke('evidence:compareBeforeAfter', beforeId, afterId),
  },
  // Component 16: Verification and Acceptance
  verification: {
    run: (args) => ipcRenderer.invoke('verification:run', args),
    getRun: (id: string) => ipcRenderer.invoke('verification:getRun', id),
    getRunsForMission: (missionId: string) => ipcRenderer.invoke('verification:getRunsForMission', missionId),
    getBundles: () => ipcRenderer.invoke('verification:getBundles'),
  },
  acceptance: {
    generate: (args) => ipcRenderer.invoke('acceptance:generate', args),
    get: (missionId: string) => ipcRenderer.invoke('acceptance:get', missionId),
  },
  // Component 19: Audit and Rollback
  audit: {
    getHistory: (filter?: AuditHistoryFilter) => ipcRenderer.invoke('audit:getHistory', filter),
    getRecord: (id: string) => ipcRenderer.invoke('audit:getRecord', id),
    getCheckpoints: (missionId: string) => ipcRenderer.invoke('audit:getCheckpoints', missionId),
  },
  rollback: {
    preview: (checkpointId: string) => ipcRenderer.invoke('rollback:preview', checkpointId),
    initiate: (checkpointId: string) => ipcRenderer.invoke('rollback:initiate', checkpointId),
    getStatus: (checkpointId: string) => ipcRenderer.invoke('rollback:getStatus', checkpointId),
  },
  // Component 18: Secrets and Migration
  secrets: {
    list: (projectId: string) => ipcRenderer.invoke('secrets:list', projectId),
    get: (id: string) => ipcRenderer.invoke('secrets:get', id),
    upsert: (record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>) => ipcRenderer.invoke('secrets:upsert', record),
    delete: (id: string) => ipcRenderer.invoke('secrets:delete', id),
    getMissingForEnvironment: (projectId: string, environmentId: string) => ipcRenderer.invoke('secrets:getMissingForEnvironment', projectId, environmentId),
    getChangedSinceLastDeploy: (projectId: string) => ipcRenderer.invoke('secrets:getChangedSinceLastDeploy', projectId),
    verify: (id: string) => ipcRenderer.invoke('secrets:verify', id),
    getInventorySummary: (projectId: string) => ipcRenderer.invoke('secrets:getInventorySummary', projectId),
  },
  migration: {
    createPlan: (plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>) => ipcRenderer.invoke('migration:createPlan', plan),
    getPlan: (id: string) => ipcRenderer.invoke('migration:getPlan', id),
    listPlans: (projectId: string) => ipcRenderer.invoke('migration:listPlans', projectId),
    generatePreview: (planId: string) => ipcRenderer.invoke('migration:generatePreview', planId),
    classifyRisk: (sql: string) => ipcRenderer.invoke('migration:classifyRisk', sql),
    getSchemaInfo: (projectId: string) => ipcRenderer.invoke('migration:getSchemaInfo', projectId),
    requireCheckpoint: (planId: string) => ipcRenderer.invoke('migration:requireCheckpoint', planId),
    listHistory: (projectId: string) => ipcRenderer.invoke('migration:listHistory', projectId),
  },
  // Component 17: Deploy, Environment, Drift
  deploy: {
    initiate: (args: DeployInitiateArgs) => ipcRenderer.invoke('deploy:initiate', args),
    getStatus: (workflowId: string) => ipcRenderer.invoke('deploy:getStatus', workflowId),
    getHistory: (projectId: string) => ipcRenderer.invoke('deploy:getHistory', projectId),
    rollback: (workflowId: string) => ipcRenderer.invoke('deploy:rollback', workflowId),
  },
  environment: {
    list: (projectId: string) => ipcRenderer.invoke('environment:list', projectId),
    get: (id: string) => ipcRenderer.invoke('environment:get', id),
    create: (env: Omit<Environment, 'id'>) => ipcRenderer.invoke('environment:create', env),
    update: (id: string, updates: Partial<Environment>) => ipcRenderer.invoke('environment:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('environment:delete', id),
    createPreview: (projectId: string, branch: string) => ipcRenderer.invoke('environment:createPreview', projectId, branch),
    destroyPreview: (id: string) => ipcRenderer.invoke('environment:destroyPreview', id),
    promote: (fromEnvId: string, toEnvId: string, candidateId: string) => ipcRenderer.invoke('environment:promote', fromEnvId, toEnvId, candidateId),
  },
  drift: {
    detect: (projectId: string) => ipcRenderer.invoke('drift:detect', projectId),
    getReports: (projectId: string) => ipcRenderer.invoke('drift:getReports', projectId),
    resolve: (reportId: string) => ipcRenderer.invoke('drift:resolve', reportId),
  },
  // Component 21: Watch, Anomaly, Incident, Self-Healing
  watch: {
    startSession: (args: WatchStartSessionArgs) => ipcRenderer.invoke('watch:startSession', args),
    stopSession: (id: string) => ipcRenderer.invoke('watch:stopSession', id),
    getSession: (id: string) => ipcRenderer.invoke('watch:getSession', id),
    listSessions: (projectId: string) => ipcRenderer.invoke('watch:listSessions', projectId),
    getDashboard: (projectId: string) => ipcRenderer.invoke('watch:getDashboard', projectId),
    onSessionStarted: (cb) => { ipcRenderer.removeAllListeners('watch:sessionStarted'); ipcRenderer.on('watch:sessionStarted', (_e, d) => cb(d)); },
    onSessionCompleted: (cb) => { ipcRenderer.removeAllListeners('watch:sessionCompleted'); ipcRenderer.on('watch:sessionCompleted', (_e, d) => cb(d)); },
    onAnomalyDetected: (cb) => { ipcRenderer.removeAllListeners('watch:anomalyDetected'); ipcRenderer.on('watch:anomalyDetected', (_e, d) => cb(d)); },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('watch:sessionStarted');
      ipcRenderer.removeAllListeners('watch:sessionCompleted');
      ipcRenderer.removeAllListeners('watch:anomalyDetected');
    },
  },
  anomaly: {
    list: (projectId: string) => ipcRenderer.invoke('anomaly:list', projectId),
    acknowledge: (id: string, acknowledgedBy: string) => ipcRenderer.invoke('anomaly:acknowledge', id, acknowledgedBy),
  },
  incident: {
    list: (projectId: string) => ipcRenderer.invoke('incident:list', projectId),
    get: (id: string) => ipcRenderer.invoke('incident:get', id),
    resolve: (id: string) => ipcRenderer.invoke('incident:resolve', id),
    dismiss: (id: string) => ipcRenderer.invoke('incident:dismiss', id),
    getRecommendation: (id: string) => ipcRenderer.invoke('incident:getRecommendation', id),
    onOpened: (cb) => { ipcRenderer.removeAllListeners('incident:opened'); ipcRenderer.on('incident:opened', (_e, d) => cb(d)); },
    removeListeners: () => { ipcRenderer.removeAllListeners('incident:opened'); },
  },
  selfHealing: {
    list: (projectId: string) => ipcRenderer.invoke('selfHealing:list', projectId),
    execute: (args: SelfHealingExecuteArgs) => ipcRenderer.invoke('selfHealing:execute', args),
    getStatus: (id: string) => ipcRenderer.invoke('selfHealing:getStatus', id),
    onActionStarted: (cb) => { ipcRenderer.removeAllListeners('selfHealing:actionStarted'); ipcRenderer.on('selfHealing:actionStarted', (_e, d) => cb(d)); },
    onActionCompleted: (cb) => { ipcRenderer.removeAllListeners('selfHealing:actionCompleted'); ipcRenderer.on('selfHealing:actionCompleted', (_e, d) => cb(d)); },
    onApprovalRequired: (cb) => { ipcRenderer.removeAllListeners('selfHealing:approvalRequired'); ipcRenderer.on('selfHealing:approvalRequired', (_e, d) => cb(d)); },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('selfHealing:actionStarted');
      ipcRenderer.removeAllListeners('selfHealing:actionCompleted');
      ipcRenderer.removeAllListeners('selfHealing:approvalRequired');
    },
  },
  // Component 20: Memory, Skills, Decisions
  memory: {
    list: (projectId, filters) => ipcRenderer.invoke('memory:list', projectId, filters),
    get: (id) => ipcRenderer.invoke('memory:get', id),
    search: (projectId, query) => ipcRenderer.invoke('memory:search', projectId, query),
    create: (item) => ipcRenderer.invoke('memory:create', item),
    update: (id, updates) => ipcRenderer.invoke('memory:update', id, updates),
    retire: (id, reason) => ipcRenderer.invoke('memory:retire', id, reason),
    reactivate: (id) => ipcRenderer.invoke('memory:reactivate', id),
    getStale: (projectId, days) => ipcRenderer.invoke('memory:getStale', projectId, days),
    getDashboard: (projectId) => ipcRenderer.invoke('memory:getDashboard', projectId),
    evictStale: (projectId, cutoff) => ipcRenderer.invoke('memory:evictStale', projectId, cutoff),
    summarizeGroup: (projectId, category) => ipcRenderer.invoke('memory:summarizeGroup', projectId, category),
  },
  skills: {
    list: (projectId, activeOnly) => ipcRenderer.invoke('skills:list', projectId, activeOnly),
    get: (id) => ipcRenderer.invoke('skills:get', id),
    create: (skill) => ipcRenderer.invoke('skills:create', skill),
    update: (id, updates) => ipcRenderer.invoke('skills:update', id, updates),
    invoke: (id) => ipcRenderer.invoke('skills:invoke', id),
    retire: (id) => ipcRenderer.invoke('skills:retire', id),
  },
  decisions: {
    list: (projectId, activeOnly) => ipcRenderer.invoke('decisions:list', projectId, activeOnly),
    get: (id) => ipcRenderer.invoke('decisions:get', id),
    getByNumber: (projectId, number) => ipcRenderer.invoke('decisions:getByNumber', projectId, number),
    create: (record) => ipcRenderer.invoke('decisions:create', record),
    update: (id, updates) => ipcRenderer.invoke('decisions:update', id, updates),
    supersede: (id, supersededBy) => ipcRenderer.invoke('decisions:supersede', id, supersededBy),
    seedFromDocs: (projectId) => ipcRenderer.invoke('decisions:seedFromDocs', projectId),
  },
  // SSH Targets (from remote merge)
  sshTargets: {
    list: (projectId: string | null) => ipcRenderer.invoke('sshTargets:list', projectId),
    save: (args: CreateSshTargetArgs) => ipcRenderer.invoke('sshTargets:save', args),
    delete: (id: string) => ipcRenderer.invoke('sshTargets:delete', id),
  },
};

contextBridge.exposeInMainWorld('vibeflow', api);
