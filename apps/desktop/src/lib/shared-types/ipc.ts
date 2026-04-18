/** IPC message types for Electron main ↔ renderer communication. */

import type { Project, SyncStatus, Account, Mode, OpenRouterModel, ConversationThread, Message, ProjectDevOpsConfig, DeployRun, SshTarget, McpConnection, PlanRecord, RoleAssignment, OrchestrationState, Capability, CapabilityHealth, CapabilityInvocationLog, McpServerConfig, McpToolInfo, McpInvocationResult, ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge, RouteRecord, ApiEndpointRecord, JobRecord, ServiceNode, ServiceEdge, ConfigVariableRecord, ContextPackEnriched, ContextItem, ContextWarning, ContextDashboard, DetectedStack, ImpactAnalysis, EvidenceItem, WorkspaceRun, PatchProposal, FileEdit, SemanticChangeGroup, Checkpoint, ChangeSet, DuplicateWarning, PatternReuseSuggestion, AuditRecord, RollbackPlan, RuntimeExecution, BrowserSession, EvidenceRecord, BeforeAfterComparison, VerificationRun, VerificationCheck, VerificationBundle, AcceptanceCriteria, SecretRecord, MigrationPlan, MigrationRiskClass, MigrationPreview, DatabaseSchemaInfo, MigrationHistoryEntry, Environment, DeployWorkflow, DeployStep, DriftReport, ServiceControlPlane, Incident, WatchSession, AnomalyEvent, SelfHealingAction, WatchDashboard, MemoryItem, MemoryCategory, MemoryRetrievalResult, MemoryDashboard, Skill, DecisionRecord, Mission, MissionLifecycleState, MissionStartArgs, ProjectConfig, WizardPayload } from './entities';

// ── Auth IPC ──────────────────────────────────────────────────────

export interface AuthSignInResult {
  success: boolean;
  error?: string;
  account?: Account;
}

export interface AuthChannel {
  signInWithGitHub: () => Promise<AuthSignInResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthSignInResult>;
  signOut: () => Promise<void>;
  getSession: () => Promise<{ email: string | null }>;
}

// ── Projects IPC ──────────────────────────────────────────────────

export interface CreateProjectArgs {
  name: string;
  description?: string;
  wizardPayload?: WizardPayload;
}

export interface ProjectsChannel {
  list: () => Promise<Project[]>;
  create: (args: CreateProjectArgs) => Promise<Project>;
  getSelfMaintenance: () => Promise<Project | null>;
  createSelfMaintenance: () => Promise<Project>;
  getVibeFlowRepoPath: () => Promise<string | null>;
  pickVibeFlowRepoPath: () => Promise<string | null>;
  listAll: () => Promise<Project[]>;
  getConfig: (projectId: string) => Promise<ProjectConfig | null>;
  saveConfig: (config: ProjectConfig) => Promise<void>;
  copyCredential: (sourceProjectId: string, credentialType: string) => Promise<string | null>;
}

// ── Build Metadata IPC ────────────────────────────────────────────

export interface BuildMetadataResult {
  version: string;
  commitSha: string;
  commitDate: string;
  releaseChannel: string;
}

export interface BuildMetadataChannel {
  get: () => Promise<BuildMetadataResult>;
}

// ── Modes IPC ─────────────────────────────────────────────────────

export interface UpdateModeSoulArgs {
  modeId: string;
  soul: string;
}

export interface UpdateModeModelArgs {
  modeId: string;
  modelId: string;
}

export interface UpdateModeConfigArgs {
  modeId: string;
  temperature?: number;
  approvalPolicy?: string;
  fallbackModelId?: string | null;
}

export interface ModesChannel {
  list: () => Promise<Mode[]>;
  updateSoul: (args: UpdateModeSoulArgs) => Promise<{ success: boolean }>;
  updateModel: (args: UpdateModeModelArgs) => Promise<{ success: boolean }>;
  updateConfig: (args: UpdateModeConfigArgs) => Promise<{ success: boolean }>;
}

// ── OpenRouter IPC ────────────────────────────────────────────────

export interface OpenRouterChannel {
  setApiKey: (key: string) => Promise<{ success: boolean }>;
  getApiKey: () => Promise<{ hasKey: boolean }>;
  listModels: () => Promise<OpenRouterModel[]>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
}

// ── Conversation IPC ────────────────────────────────────────────────

export interface CreateConversationArgs {
  projectId: string;
  title: string;
}

export interface SendMessageArgs {
  conversationId: string;
  content: string;
  modeId: string;
  /** When true, routes the message through the mission lifecycle instead of the chat path. */
  missionMode?: boolean;
}

export interface StreamTokenData {
  conversationId: string;
  token: string;
}

export interface StreamDoneData {
  conversationId: string;
}

export interface StreamErrorData {
  conversationId: string;
  error: string;
}

export interface ExecutionEventData {
  conversationId: string;
  text: string;
  type: 'info' | 'delegation' | 'specialist' | 'error';
}

export interface ConversationsChannel {
  list: (projectId: string) => Promise<ConversationThread[]>;
  create: (args: CreateConversationArgs) => Promise<ConversationThread>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  sendMessage: (args: SendMessageArgs) => Promise<Message>;
  onStreamToken: (callback: (data: StreamTokenData) => void) => void;
  onStreamDone: (callback: (data: StreamDoneData) => void) => void;
  onStreamError: (callback: (data: StreamErrorData) => void) => void;
  onExecutionEvent: (callback: (data: ExecutionEventData) => void) => void;
  removeStreamListeners: () => void;
}

// ── Sync IPC ──────────────────────────────────────────────────────

export interface SyncChannel {
  getDeviceId: () => Promise<string | null>;
  registerDevice: () => Promise<{ deviceId: string; deviceName: string }>;
  syncAll: () => Promise<{ success: boolean }>;
  acquireLease: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  releaseLease: (conversationId: string) => Promise<{ success: boolean }>;
  takeoverLease: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  getLease: (conversationId: string) => Promise<{ deviceId: string; deviceName: string; expiresAt: string } | null>;
}

// ── Tooling IPC ───────────────────────────────────────────────────

export interface FileReadResult {
  path: string;
  content: string;
  encoding: string;
  sizeBytes: number;
}

export interface FileWriteResult {
  path: string;
  bytesWritten: number;
}

export interface DirectoryListResult {
  path: string;
  entries: Array<{
    name: string;
    type: 'file' | 'directory' | 'symlink';
    sizeBytes: number;
    modifiedAt: string;
  }>;
}

export interface TerminalCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TerminalRunArgs {
  command: string;
  cwd: string;
  commandId: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  isRepo: boolean;
}

export interface GitCommitResult {
  success: boolean;
  commitSha: string | null;
  error: string | null;
}

export interface GitCommitArgs {
  repoPath: string;
  message: string;
}

export interface GitPushArgs {
  repoPath: string;
  remote: string;
  branch: string;
}

export interface SshHost {
  name: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string | null;
}

export interface SshConnectionTestResult {
  host: string;
  success: boolean;
  latencyMs: number | null;
  error: string | null;
}

// ── DevOps IPC ──────────────────────────────────────────────────────

export type DevOpsChannel =
  | 'devops:listTemplates'
  | 'devops:createTemplate'
  | 'devops:updateTemplate'
  | 'devops:deleteTemplate'
  | 'devops:getProjectConfig'
  | 'devops:saveProjectConfig'
  | 'devops:setGitHubToken'
  | 'devops:setCoolifyApiKey'
  | 'devops:listWorkflowRuns'
  | 'devops:deploy'
  | 'devops:restart'
  | 'devops:stop'
  | 'devops:healthCheck'
  | 'devops:listDeployRuns';

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  headSha: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface CoolifyDeployResult {
  success: boolean;
  deploymentId: string | null;
  error: string | null;
}

export interface HealthCheckResult {
  url: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  httpStatus: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  error: string | null;
}

export interface DevOpsApi {
  listTemplates: () => Promise<any[]>;
  createTemplate: (template: any) => Promise<any>;
  updateTemplate: (template: any) => Promise<{ success: boolean }>;
  deleteTemplate: (id: string) => Promise<{ success: boolean }>;
  getProjectConfig: (projectId: string) => Promise<ProjectDevOpsConfig | null>;
  saveProjectConfig: (config: ProjectDevOpsConfig) => Promise<{ success: boolean }>;
  setGitHubToken: (token: string) => Promise<{ success: boolean }>;
  setCoolifyApiKey: (apiKey: string) => Promise<{ success: boolean }>;
  listWorkflowRuns: (owner: string, repo: string) => Promise<WorkflowRun[]>;
  deploy: (appId: string, baseUrl: string) => Promise<CoolifyDeployResult>;
  restart: (appId: string, baseUrl: string) => Promise<{ success: boolean; error: string | null }>;
  stop: (appId: string, baseUrl: string) => Promise<{ success: boolean; error: string | null }>;
  healthCheck: (url: string) => Promise<HealthCheckResult>;
  listDeployRuns: (projectId: string) => Promise<DeployRun[]>;
}

// ── Tooling IPC ───────────────────────────────────────────────────

export interface ToolingChannel {
  files: {
    read: (filePath: string, projectRoot?: string) => Promise<FileReadResult>;
    write: (filePath: string, content: string, projectRoot?: string) => Promise<FileWriteResult>;
    list: (dirPath: string, projectRoot?: string) => Promise<DirectoryListResult>;
    exists: (filePath: string, projectRoot?: string) => Promise<boolean>;
  };
  terminal: {
    run: (args: TerminalRunArgs) => Promise<TerminalCommandResult>;
    kill: (commandId: string) => Promise<void>;
    onOutput: (callback: (data: { commandId: string; text: string; stream: string }) => void) => void;
    onDone: (callback: (data: { commandId: string; result: TerminalCommandResult }) => void) => void;
    removeListeners: () => void;
  };
  git: {
    status: (repoPath: string) => Promise<GitStatus>;
    diff: (repoPath: string, staged?: boolean) => Promise<string>;
    commit: (args: GitCommitArgs) => Promise<GitCommitResult>;
    push: (args: GitPushArgs) => Promise<{ success: boolean; error: string | null }>;
    log: (repoPath: string, limit?: number) => Promise<Array<{ sha: string; message: string; author: string; date: string }>>;
  };
  ssh: {
    discoverHosts: () => Promise<SshHost[]>;
    discoverKeys: () => Promise<string[]>;
    testConnection: (host: SshHost) => Promise<SshConnectionTestResult>;
  };
}

// ── Approval IPC ──────────────────────────────────────────────────

export type ApprovalChannel =
  | 'approval:requestAction'
  | 'approval:humanDecision'
  | 'approval:getQueue'
  | 'approval:getLog'
  | 'approval:pendingApproval';  // main → renderer event

export interface HumanDecisionArgs {
  actionId: string;
  decision: 'approved' | 'rejected';
  note: string | null;
}

export type ApprovalTier = 1 | 2 | 3;
export type ActionType =
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'terminal:run'
  | 'git:commit'
  | 'git:push-main'
  | 'git:push-branch'
  | 'deploy:trigger'
  | 'deploy:restart'
  | 'deploy:stop'
  | 'ssh:connect'
  // Component 19: expanded action types
  | 'migration:run'
  | 'migration:rollback'
  | 'config:change'
  | 'secret:rotate'
  | 'service:restart'
  | 'service:stop'
  | 'deploy:rollback'
  | 'incident:acknowledge'
  | 'incident:remediate'
  // Component 17: environment and deploy workflow actions
  | 'deploy:promote'
  | 'deploy:canary'
  | 'env:create'
  | 'env:destroy'
  | 'env:drift-detect'
  | 'env:promote'
  // Component 21: watch and self-healing actions
  | 'watch:start'
  | 'watch:stop'
  | 'self-heal:restart'
  | 'self-heal:rerun-check'
  | 'self-heal:disable-probe'
  // Component 20: memory and decision actions
  | 'memory:write'
  | 'memory:retire'
  | 'memory:summarize'
  | 'skill:invoke'
  | 'decision:record';

export interface ActionRequest {
  id: string;
  description: string;
  reason: string;
  affectedResources: string[];
  rollbackDifficulty: 'easy' | 'difficult' | 'impossible';
  requestingModeId: string;
  requestingModelId: string;
  conversationId: string;
  actionType: ActionType;
  payload: unknown;
  createdAt: string;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'escalated';

export interface ApprovalResult {
  actionId: string;
  decision: ApprovalDecision;
  tier: ApprovalTier;
  reviewerModel: string | null;
  reviewerReason: string | null;
  decidedAt: string;
}

export interface ApprovalApi {
  requestAction: (action: ActionRequest) => Promise<ApprovalResult>;
  humanDecision: (args: HumanDecisionArgs) => Promise<void>;
  getQueue: () => Promise<ActionRequest[]>;
  getLog: () => Promise<any[]>;
  onPendingApproval: (callback: (data: { type: string; action: ActionRequest; tier?: number; result?: ApprovalResult }) => void) => void;
  removePendingApprovalListener: () => void;
}

// ── Component 19: Audit IPC ──────────────────────────────────────────

export interface AuditHistoryFilter {
  missionId?: string;
  limit?: number;
}

export interface AuditChannel {
  getHistory: (filter?: AuditHistoryFilter) => Promise<AuditRecord[]>;
  getRecord: (id: string) => Promise<AuditRecord | null>;
  getCheckpoints: (missionId: string) => Promise<Checkpoint[]>;
}

// ── Component 19: Rollback IPC ───────────────────────────────────────

export interface RollbackPreviewResult {
  checkpointId: string;
  rollbackPlan: RollbackPlan;
  warning: string | null;
}

export interface RollbackInitiateResult {
  success: boolean;
  error: string | null;
}

export interface RollbackChannel {
  preview: (checkpointId: string) => Promise<RollbackPreviewResult>;
  initiate: (checkpointId: string) => Promise<RollbackInitiateResult>;
  getStatus: (checkpointId: string) => Promise<{ status: string; error: string | null }>;
}

// ── Handoff IPC ───────────────────────────────────────────────────

export type HandoffChannel =
  | 'handoff:generate'
  | 'handoff:list'
  | 'handoff:getIdiosyncrasies';

export interface GenerateHandoffArgs {
  conversationId: string;
  projectId: string;
  projectName: string;
  currentGoal: string;
  nextStep: string;
  warnings: string[];
  pendingBugs: string[];
  isSelfMaintenance?: boolean;
}

export interface HandoffResult {
  handoffDoc: string;
  handoffPrompt: string;
  filename: string;
  storageUrl: string | null;
  error: string | null;
}

export interface HandoffApi {
  generate: (args: GenerateHandoffArgs) => Promise<HandoffResult>;
  getIdiosyncrasies: () => Promise<string>;
}

// ── Updater IPC ────────────────────────────────────────────────────

export interface UpdaterChannel {
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => void;
  onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  removeListeners: () => void;
}

// ── SSH Targets IPC ────────────────────────────────────────────────

export interface CreateSshTargetArgs {
  projectId: string | null;
  name: string;
  hostname: string;
  username: string;
  port: number;
  identityFile: string | null;
}

export interface SshTargetsApi {
  list: (projectId: string | null) => Promise<SshTarget[]>;
  save: (args: CreateSshTargetArgs) => Promise<SshTarget>;
  delete: (id: string) => Promise<{ success: boolean }>;
}

// ── MCP Connections IPC (remote-style) ──────────────────────────────

export interface CreateMcpConnectionArgs {
  projectId: string | null;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  scope: 'global' | 'project';
}

export interface McpApi {
  list: (projectId: string | null) => Promise<McpConnection[]>;
  create: (args: CreateMcpConnectionArgs) => Promise<McpConnection>;
  update: (id: string, updates: Partial<CreateMcpConnectionArgs>) => Promise<{ success: boolean }>;
  delete: (id: string) => Promise<{ success: boolean }>;
}

// ── Orchestrator IPC ────────────────────────────────────────────────

export interface DecomposeMissionArgs {
  missionId: string;
  projectId: string;
}

export interface AssignRoleArgs {
  missionId: string;
  stepId: string;
  roleSlug: string;
}

export interface OrchestratorChannel {
  decomposeMission: (args: DecomposeMissionArgs) => Promise<PlanRecord>;
  assignRole: (args: AssignRoleArgs) => Promise<RoleAssignment>;
  getPlan: (missionId: string) => Promise<PlanRecord | null>;
  getState: () => Promise<OrchestrationState>;
}

// ── Capabilities IPC ────────────────────────────────────────────────

export interface CapabilitiesChannel {
  list: () => Promise<Capability[]>;
  get: (id: string) => Promise<Capability | null>;
  getHealth: () => Promise<Record<string, CapabilityHealth>>;
  getInvocationLog: (capabilityId: string, limit?: number) => Promise<CapabilityInvocationLog[]>;
}

// ── MCP IPC ─────────────────────────────────────────────────────────

export interface McpChannel {
  list: () => Promise<McpServerConfig[]>;
  add: (config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'health' | 'discoveredTools'>) => Promise<McpServerConfig>;
  update: (id: string, updates: Partial<McpServerConfig>) => Promise<McpServerConfig>;
  remove: (id: string) => Promise<{ success: boolean }>;
  enable: (id: string) => Promise<McpServerConfig>;
  disable: (id: string) => Promise<McpServerConfig>;
  testConnection: (id: string) => Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }>;
  executeTool: (serverId: string, toolName: string, parameters: Record<string, unknown>) => Promise<McpInvocationResult>;
  onHealthChanged: (callback: (data: { serverId: string; health: CapabilityHealth }) => void) => void;
  removeHealthChangedListener: () => void;
}

// ── Project Intelligence IPC ────────────────────────────────────────────────

export interface ProjectIntelligenceChannel {
  // Index management
  getIndex: (projectId: string) => Promise<ProjectIndex | null>;
  triggerIndex: (projectId: string, options?: { fullReindex: boolean }) => Promise<{ success: boolean; fileCount: number }>;
  getIndexStatus: (projectId: string) => Promise<{ indexed: boolean; fileCount: number; staleness: string; indexedAt: string | null }>;

  // File queries
  getFiles: (projectId: string, filter?: { language?: string; isGenerated?: boolean }) => Promise<FileRecord[]>;
  getFile: (projectId: string, path: string) => Promise<FileRecord | null>;

  // Symbol queries
  getSymbols: (projectId: string, filter?: { fileId?: string; kind?: string }) => Promise<SymbolRecord[]>;
  getSymbol: (projectId: string, id: string) => Promise<SymbolRecord | null>;

  // Impact analysis
  getImpactAnalysis: (projectId: string, targetPath: string) => Promise<ImpactAnalysis>;

  // Service topology
  getTopology: (projectId: string) => Promise<{ nodes: ServiceNode[]; edges: ServiceEdge[] }>;

  // Configuration
  getConfigVariables: (projectId: string) => Promise<ConfigVariableRecord[]>;
  getMissingConfig: (projectId: string, environment: string) => Promise<ConfigVariableRecord[]>;

  // Framework detection
  getDetectedStack: (projectId: string) => Promise<DetectedStack>;
}

// ── Context Packs IPC ───────────────────────────────────────────────────────

export interface ContextPackOptions {
  tokenBudget?: number;
  includeFiles?: boolean;
  includeSymbols?: boolean;
  includeRoutes?: boolean;
  includeServices?: boolean;
  includeConfig?: boolean;
}

export interface ContextPackUpdates {
  items?: ContextItem[];
  warnings?: ContextWarning[];
}

export interface ContextPacksChannel {
  createPack: (missionId: string, options?: ContextPackOptions) => Promise<ContextPackEnriched>;
  getPack: (packId: string) => Promise<ContextPackEnriched | null>;
  getPackForMission: (missionId: string) => Promise<ContextPackEnriched | null>;
  updatePack: (packId: string, updates: ContextPackUpdates) => Promise<ContextPackEnriched>;
  pinItem: (packId: string, itemId: string) => Promise<ContextPackEnriched>;
  unpinItem: (packId: string, itemId: string) => Promise<ContextPackEnriched>;
  swapStaleItem: (packId: string, itemId: string) => Promise<ContextPackEnriched>;
  getDashboard: (packId: string) => Promise<ContextDashboard>;
}

// ── Component 13: Change Engine IPC ───────────────────────────────────────

export interface CreateWorkspaceRunArgs {
  missionId: string;
  planStepId: string;
  projectRoot: string;
}

export interface ApplyPatchArgs {
  workspaceRunId: string;
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  newContent: string | null;
  rationale: string;
}

export interface CommitWorkspaceArgs {
  workspaceRunId: string;
  message: string;
}

export interface ChangeEngineChannel {
  createWorkspaceRun: (args: CreateWorkspaceRunArgs) => Promise<WorkspaceRun>;
  applyPatch: (args: ApplyPatchArgs) => Promise<FileEdit>;
  getChangeSet: (workspaceRunId: string) => Promise<ChangeSet | null>;
  runValidityChecks: (workspaceRunId: string) => Promise<EvidenceItem[]>;
  createCheckpoint: (workspaceRunId: string, label: string) => Promise<Checkpoint>;
  rollbackToCheckpoint: (checkpointId: string) => Promise<boolean>;
  getSemanticGroups: (workspaceRunId: string) => Promise<SemanticChangeGroup[]>;
  getDuplicateWarnings: (workspaceRunId: string) => Promise<DuplicateWarning[]>;
  commitWorkspace: (args: CommitWorkspaceArgs) => Promise<GitCommitResult>;
  cleanupWorkspace: (workspaceRunId: string) => Promise<boolean>;
  listWorkspaceRuns: (missionId?: string) => Promise<WorkspaceRun[]>;
  listCheckpoints: (workspaceRunId: string) => Promise<Checkpoint[]>;
}

// ── Component 15: Runtime Execution IPC ───────────────────────────────────────

export interface RuntimeStartArgs {
  missionId: string;
  workspaceRunId: string;
  planStepId: string | null;
  command: string;
  cwd: string;
}

export interface RuntimeExecutionChannel {
  start: (args: RuntimeStartArgs) => Promise<RuntimeExecution>;
  stop: (executionId: string) => Promise<void>;
  getStatus: (executionId: string) => Promise<RuntimeExecution | null>;
  getExecutions: (missionId: string) => Promise<RuntimeExecution[]>;
  getLogs: (executionId: string) => Promise<{ stdout: string; stderr: string }>;
}

// ── Component 15: Browser Automation IPC ─────────────────────────────────────

export interface BrowserSessionArgs {
  missionId: string;
  workspaceRunId: string;
  planStepId: string | null;
  baseUrl: string;
}

export interface BrowserScreenshotResult {
  path: string;
}

export interface BrowserAutomationChannel {
  startSession: (args: BrowserSessionArgs) => Promise<BrowserSession>;
  navigate: (sessionId: string, url: string) => Promise<void>;
  click: (sessionId: string, selector: string) => Promise<void>;
  fillForm: (sessionId: string, fields: Record<string, string>) => Promise<void>;
  uploadFile: (sessionId: string, selector: string, filePath: string) => Promise<void>;
  screenshot: (sessionId: string, name: string) => Promise<BrowserScreenshotResult>;
  getConsoleLogs: (sessionId: string) => Promise<string>;
  getNetworkTraces: (sessionId: string) => Promise<string>;
  getDomSnapshot: (sessionId: string, selector: string) => Promise<string>;
  closeSession: (sessionId: string) => Promise<void>;
}

// ── Component 15: Evidence Capture IPC ───────────────────────────────────────

export interface EvidenceChannel {
  getForMission: (missionId: string) => Promise<EvidenceRecord[]>;
  getForWorkspaceRun: (workspaceRunId: string) => Promise<EvidenceRecord[]>;
  compareBeforeAfter: (beforeId: string, afterId: string) => Promise<BeforeAfterComparison | null>;
}

// ── Component 16: Verification IPC ───────────────────────────────────────

export interface VerificationRunArgs {
  missionId: string;
  workspaceRunId?: string;
  changesetId?: string;
  candidateId?: string;
  bundleId?: string;
}

export interface VerificationChannel {
  run: (args: VerificationRunArgs) => Promise<VerificationRun>;
  getRun: (id: string) => Promise<VerificationRun | null>;
  getRunsForMission: (missionId: string) => Promise<VerificationRun[]>;
  getBundles: () => Promise<VerificationBundle[]>;
}

// ── Component 16: Acceptance IPC ─────────────────────────────────────────

export interface AcceptanceGenerateArgs {
  missionId: string;
}

export interface AcceptanceChannel {
  generate: (args: AcceptanceGenerateArgs) => Promise<AcceptanceCriteria>;
  get: (missionId: string) => Promise<AcceptanceCriteria | null>;
}

// ── Component 18: Secrets IPC ───────────────────────────────────────────────

export interface SecretsChannel {
  list: (projectId: string) => Promise<SecretRecord[]>;
  get: (id: string) => Promise<SecretRecord | null>;
  upsert: (record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>) => Promise<SecretRecord>;
  delete: (id: string) => Promise<{ success: boolean }>;
  getMissingForEnvironment: (projectId: string, environmentId: string) => Promise<SecretRecord[]>;
  getChangedSinceLastDeploy: (projectId: string) => Promise<SecretRecord[]>;
  verify: (id: string) => Promise<{ success: boolean; error?: string }>;
  getInventorySummary: (projectId: string) => Promise<{ total: number; missing: number; verified: number }>;
  // Cloud sync (Track A)
  setPassphrase: (passphrase: string) => Promise<{ success: boolean; error?: string }>;
  hasPassphrase: () => Promise<boolean>;
  clearPassphrase: () => Promise<{ success: boolean }>;
  syncUp: () => Promise<{ success: boolean; uploaded: number; error?: string }>;
  syncDown: () => Promise<{ success: boolean; restored: number; error?: string }>;
}

// ── Connection Test IPC ───────────────────────────────────────────────────────

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export interface ConnectionTestChannel {
  railway: (apiKey: string) => Promise<ConnectionTestResult>;
  brevo: (apiKey: string) => Promise<ConnectionTestResult>;
  clawdtalk: (apiKey: string) => Promise<ConnectionTestResult>;
}

// ── OAuth Automation IPC ─────────────────────────────────────────────────────

export interface OAuthChannel {
  createAzureApp: (args: {
    sp: { tenantId: string; clientId: string; clientSecret: string };
    appDisplayName: string;
    redirectUris: string[];
  }) => Promise<{ success: boolean; appId?: string; clientSecret?: string; tenantId?: string; error?: string }>;
}

// ── Component 18: Migration IPC ─────────────────────────────────────────────

export interface MigrationChannel {
  createPlan: (plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MigrationPlan>;
  getPlan: (id: string) => Promise<MigrationPlan | null>;
  listPlans: (projectId: string) => Promise<MigrationPlan[]>;
  generatePreview: (planId: string) => Promise<MigrationPreview>;
  classifyRisk: (sql: string) => Promise<{ riskClass: MigrationRiskClass; safeguards: Array<{ type: string; description: string; required: boolean; satisfied: boolean }> }>;
  getSchemaInfo: (projectId: string) => Promise<DatabaseSchemaInfo | null>;
  requireCheckpoint: (planId: string) => Promise<{ checkpointRequired: boolean; checkpointId?: string }>;
  listHistory: (projectId: string) => Promise<MigrationHistoryEntry[]>;
}

// ── Component 17: Deploy IPC ─────────────────────────────────────────────

export interface DeployInitiateArgs {
  candidateId: string;
  environmentId: string;
  projectId: string;
}

export interface DeployChannel {
  initiate: (args: DeployInitiateArgs) => Promise<DeployWorkflow>;
  getStatus: (workflowId: string) => Promise<DeployWorkflow | null>;
  getHistory: (projectId: string) => Promise<DeployWorkflow[]>;
  rollback: (workflowId: string) => Promise<{ success: boolean; error: string | null }>;
}

// ── Component 17: Environment IPC ─────────────────────────────────────────

export interface EnvironmentChannel {
  list: (projectId: string) => Promise<Environment[]>;
  get: (id: string) => Promise<Environment | null>;
  create: (env: Omit<Environment, 'id'>) => Promise<Environment>;
  update: (id: string, updates: Partial<Environment>) => Promise<Environment>;
  delete: (id: string) => Promise<{ success: boolean }>;
  createPreview: (projectId: string, branch: string) => Promise<Environment>;
  destroyPreview: (id: string) => Promise<{ success: boolean }>;
  promote: (fromEnvId: string, toEnvId: string, candidateId: string) => Promise<DeployWorkflow>;
}

// ── Component 17: Drift IPC ───────────────────────────────────────────────

export interface DriftChannel {
  detect: (projectId: string) => Promise<DriftReport[]>;
  getReports: (projectId: string) => Promise<DriftReport[]>;
  resolve: (reportId: string) => Promise<{ success: boolean }>;
}

// ── Component 21: Watch IPC ───────────────────────────────────────────────

export interface WatchStartSessionArgs {
  deployWorkflowId: string;
  environmentId: string;
  projectId: string;
}

export interface WatchChannel {
  startSession: (args: WatchStartSessionArgs) => Promise<WatchSession>;
  stopSession: (id: string) => Promise<{ success: boolean }>;
  getSession: (id: string) => Promise<WatchSession | null>;
  listSessions: (projectId: string) => Promise<WatchSession[]>;
  getDashboard: (projectId: string) => Promise<WatchDashboard>;
  onSessionStarted: (callback: (data: WatchSession) => void) => void;
  onSessionCompleted: (callback: (data: WatchSession) => void) => void;
  onAnomalyDetected: (callback: (data: AnomalyEvent) => void) => void;
  removeListeners: () => void;
}

// ── Component 21: Anomaly IPC ─────────────────────────────────────────────

export interface AnomalyChannel {
  list: (projectId: string) => Promise<AnomalyEvent[]>;
  acknowledge: (id: string, acknowledgedBy: string) => Promise<{ success: boolean }>;
}

// ── Component 21: Incident IPC (extends existing incident CRUD) ───────────

export interface IncidentChannel {
  list: (projectId: string) => Promise<Incident[]>;
  get: (id: string) => Promise<Incident | null>;
  resolve: (id: string) => Promise<{ success: boolean }>;
  dismiss: (id: string) => Promise<{ success: boolean }>;
  getRecommendation: (id: string) => Promise<string | null>;
  onOpened: (callback: (data: Incident) => void) => void;
  removeListeners: () => void;
}

// ── Component 21: Self-Healing IPC ────────────────────────────────────────

export interface SelfHealingExecuteArgs {
  actionType: SelfHealingAction['actionType'];
  incidentId?: string;
  anomalyId?: string;
  environmentId?: string;
  projectId?: string;
}

export interface SelfHealingChannel {
  list: (projectId: string) => Promise<SelfHealingAction[]>;
  execute: (args: SelfHealingExecuteArgs) => Promise<SelfHealingAction>;
  getStatus: (id: string) => Promise<SelfHealingAction | null>;
  onActionStarted: (callback: (data: SelfHealingAction) => void) => void;
  onActionCompleted: (callback: (data: SelfHealingAction) => void) => void;
  onApprovalRequired: (callback: (data: SelfHealingAction) => void) => void;
  removeListeners: () => void;
}

// ── Component 20: Memory IPC ──────────────────────────────────────

export interface MemoryChannel {
  list: (projectId: string, filters?: { category?: MemoryCategory; activeOnly?: boolean }) => Promise<MemoryItem[]>;
  get: (id: string) => Promise<MemoryItem | null>;
  search: (projectId: string, query: { tags?: string[]; category?: MemoryCategory; triggerMatch?: string }) => Promise<MemoryRetrievalResult>;
  create: (item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MemoryItem>;
  update: (id: string, updates: Partial<MemoryItem>) => Promise<MemoryItem>;
  retire: (id: string, reason: string) => Promise<{ success: boolean }>;
  reactivate: (id: string) => Promise<{ success: boolean }>;
  getStale: (projectId: string, daysThreshold?: number) => Promise<MemoryItem[]>;
  getDashboard: (projectId: string) => Promise<MemoryDashboard>;
  evictStale: (projectId: string, cutoffDate: string) => Promise<number>;
  summarizeGroup: (projectId: string, category: MemoryCategory) => Promise<MemoryItem>;
}

// ── Component 20: Skills IPC ──────────────────────────────────────

export interface SkillsChannel {
  list: (projectId: string, activeOnly?: boolean) => Promise<Skill[]>;
  get: (id: string) => Promise<Skill | null>;
  create: (skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<Skill>;
  update: (id: string, updates: Partial<Skill>) => Promise<Skill>;
  invoke: (id: string) => Promise<Skill>;
  retire: (id: string) => Promise<{ success: boolean }>;
}

// ── Component 20: Decisions IPC ───────────────────────────────────

export interface DecisionsChannel {
  list: (projectId: string, activeOnly?: boolean) => Promise<DecisionRecord[]>;
  get: (id: string) => Promise<DecisionRecord | null>;
  getByNumber: (projectId: string, number: number) => Promise<DecisionRecord | null>;
  create: (record: Omit<DecisionRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DecisionRecord>;
  update: (id: string, updates: Partial<DecisionRecord>) => Promise<DecisionRecord>;
  supersede: (id: string, supersededBy: string) => Promise<{ success: boolean }>;
  seedFromDocs: (projectId: string) => Promise<{ decisions: number; memories: number }>;
}

// ── Mission Lifecycle IPC (Phase 1 wiring) ────────────────────────────────

/**
 * Invoke channels (renderer → main).
 * All return Promises; wired via ipcMain.handle / ipcRenderer.invoke.
 */
export interface MissionsChannel {
  /** Create a new Mission + MissionLifecycleState and kick off the orchestrator. */
  start: (args: MissionStartArgs) => Promise<Mission>;
  /** Fetch a mission by ID. */
  get: (missionId: string) => Promise<Mission | null>;
  /** Fetch the current lifecycle state for a mission. */
  getLifecycleState: (missionId: string) => Promise<MissionLifecycleState | null>;
  /** Signal the orchestrator to cancel and set Mission.status = 'cancelled'. */
  cancel: (missionId: string) => Promise<void>;
  /** Reset MissionLifecycleState.currentStep to fromStep and resume orchestration. */
  retry: (args: { missionId: string; fromStep: number }) => Promise<void>;
}

/**
 * Push event payloads (main → renderer).
 * Sent via webContents.send / ipcRenderer.on.
 */

/** Emitted after step 3: plan decomposed and ready to display. */
export interface MissionPlanReadyEvent {
  missionId: string;
  plan: PlanRecord;
}

/** Emitted after step 4: context pack assembled and dashboard computed. */
export interface MissionContextReadyEvent {
  missionId: string;
  pack: ContextPackEnriched;
  dashboard: ContextDashboard;
}

/** Emitted at step 7 or 14: mission is paused awaiting human approval. */
export interface MissionAwaitingApprovalEvent {
  missionId: string;
  action: ActionRequest;
  tier: ApprovalTier;
}

/** Emitted during steps 8–9: incremental file edits as patches are applied. */
export interface MissionWorkspaceProgressEvent {
  missionId: string;
  workspaceRunId: string;
  fileEdits: FileEdit[];
}

/** Emitted after step 10–11: verification complete with full change set. */
export interface MissionVerificationCompleteEvent {
  missionId: string;
  run: VerificationRun;
  changeSet: ChangeSet;
}

/** Emitted during steps 12–15: deploy workflow step progress. */
export interface MissionDeployProgressEvent {
  missionId: string;
  workflow: DeployWorkflow;
}

/** Emitted at step 18: anomaly detected after deploy, rollback may be offered. */
export interface MissionAnomalyDetectedEvent {
  missionId: string;
  anomaly: AnomalyEvent;
  action: SelfHealingAction;
}

/** Emitted when the watch window closes cleanly — mission is complete. */
export interface MissionCompletedEvent {
  missionId: string;
  summary: string;
}

/** Emitted when the orchestrator encounters a terminal error. */
export interface MissionFailedEvent {
  missionId: string;
  reason: string;
  step: number;
}

// ── Full window API ──────────────────────────────────────────────

export interface VibeFlowAPI {
  auth: AuthChannel;
  projects: ProjectsChannel;
  buildMetadata: BuildMetadataChannel;
  syncStatus: {
    subscribe: (callback: (status: SyncStatus) => void) => () => void;
  };
  modes: ModesChannel;
  openrouter: OpenRouterChannel;
  conversations: ConversationsChannel;
  sync: SyncChannel;
  tooling: ToolingChannel;
  devops: DevOpsApi;
  approval: ApprovalApi;
  handoff: HandoffApi;
  updater: UpdaterChannel;
  orchestrator: OrchestratorChannel;
  capabilities: CapabilitiesChannel;
  mcp: McpChannel;
  projectIntelligence: ProjectIntelligenceChannel;
  contextPacks: ContextPacksChannel;
  changeEngine: ChangeEngineChannel;
  // Component 19: Audit and Rollback
  audit: AuditChannel;
  rollback: RollbackChannel;
  // Component 15: Runtime Execution, Browser Automation, Evidence
  runtime: RuntimeExecutionChannel;
  browser: BrowserAutomationChannel;
  evidence: EvidenceChannel;
  // Component 16: Verification and Acceptance
  verification: VerificationChannel;
  acceptance: AcceptanceChannel;
  // Component 18: Secrets and Migration
  secrets: SecretsChannel;
  oauth: OAuthChannel;
  connectionTest: ConnectionTestChannel;
  migration: MigrationChannel;
  // Component 17: Deploy, Environment, Drift
  deploy: DeployChannel;
  environment: EnvironmentChannel;
  drift: DriftChannel;
  // Component 21: Watch, Anomaly, Incident, Self-Healing
  watch: WatchChannel;
  anomaly: AnomalyChannel;
  incident: IncidentChannel;
  selfHealing: SelfHealingChannel;
  // Component 20: Memory, Skills, Decisions
  memory: MemoryChannel;
  skills: SkillsChannel;
  decisions: DecisionsChannel;
  // SSH Targets (from remote merge)
  sshTargets: SshTargetsApi;
  // Mission lifecycle (Phase 3 wiring)
  missions: MissionsChannel & {
    resolveApproval: (args: { missionId: string; approved: boolean }) => Promise<void>;
    onPlanReady: (cb: (data: MissionPlanReadyEvent) => void) => () => void;
    onContextReady: (cb: (data: MissionContextReadyEvent) => void) => () => void;
    onAwaitingApproval: (cb: (data: MissionAwaitingApprovalEvent) => void) => () => void;
    onWorkspaceProgress: (cb: (data: MissionWorkspaceProgressEvent) => void) => () => void;
    onVerificationComplete: (cb: (data: MissionVerificationCompleteEvent) => void) => () => void;
    onCompleted: (cb: (data: MissionCompletedEvent) => void) => () => void;
    onFailed: (cb: (data: MissionFailedEvent) => void) => () => void;
  };
}
