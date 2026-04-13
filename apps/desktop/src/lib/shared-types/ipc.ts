/** IPC message types for Electron main ↔ renderer communication. */

import type { Project, SyncStatus, Account, Mode, OpenRouterModel, ConversationThread, Message, ProjectDevOpsConfig, DeployRun, SshTarget, McpConnection } from './entities';

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
}

export interface ProjectsChannel {
  list: () => Promise<Project[]>;
  create: (args: CreateProjectArgs) => Promise<Project>;
  getSelfMaintenance: () => Promise<Project | null>;
  createSelfMaintenance: () => Promise<Project>;
  getVibeFlowRepoPath: () => Promise<string | null>;
  pickVibeFlowRepoPath: () => Promise<string | null>;
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
  | 'ssh:connect';

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

// ── MCP IPC ────────────────────────────────────────────────────────

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
  sshTargets: SshTargetsApi;
  mcp: McpApi;
}
