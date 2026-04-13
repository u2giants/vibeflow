/** Core entity interfaces shared across all VibeFlow packages. */

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isSelfMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface ConversationThread {
  id: string;
  projectId: string;
  userId?: string;
  title: string;
  runState: RunState;
  ownerDeviceId: string | null;
  ownerDeviceName: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modeId: string | null;
  modelId: string | null;
  createdAt: string;
}

export interface ExecutionEvent {
  id: string;
  conversationId: string;
  type: 'mode-start' | 'mode-end' | 'tool-call' | 'tool-result' | 'thinking' | 'info';
  modeId: string | null;
  content: string;
  createdAt: string;
}

export type RunState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'waiting_for_second_model_review'
  | 'waiting_for_human_approval'
  | 'waiting_for_user_input'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'abandoned'
  | 'recoverable';

export type SyncStatus = 'synced' | 'syncing' | 'degraded' | 'offline';

export interface DeviceInfo {
  id: string;
  name: string;
  userId: string;
  lastSeenAt: string;
}

export interface ConversationLease {
  conversationId: string;
  deviceId: string;
  deviceName: string;
  acquiredAt: string;
  expiresAt: string;
  heartbeatIntervalSeconds: number;
}

// ── Mode System ─────────────────────────────────────────────────────

export type ApprovalPolicy = 'auto' | 'second-model' | 'human';

export interface Mode {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  soul: string;
  modelId: string;
  fallbackModelId: string | null;
  temperature: number;
  approvalPolicy: ApprovalPolicy;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  supportsTools: boolean;
}

// ── SSH Targets ─────────────────────────────────────────────────────

export interface SshTarget {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  hostname: string;
  username: string;
  port: number;
  identityFile: string | null;
  createdAt: string;
}

// ── MCP Connections ──────────────────────────────────────────────────

export interface McpConnection {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  scope: 'global' | 'project';
  createdAt: string;
  updatedAt: string;
}

// ── DevOps ─────────────────────────────────────────────────────

export interface ProjectDevOpsConfig {
  projectId: string;
  templateId: string;
  githubOwner: string;
  githubRepo: string;
  coolifyAppId: string;
  coolifyBaseUrl: string;
  imageName: string;
  healthCheckUrl: string;
  updatedAt: string;
}

export interface DeployRun {
  id: string;
  projectId: string;
  templateId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  commitSha: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}
