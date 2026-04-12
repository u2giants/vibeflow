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
  title: string;
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

export enum RunState {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
}

export enum SyncStatus {
  Offline = 'offline',
  Connecting = 'connecting',
  Connected = 'connected',
  Syncing = 'syncing',
  Error = 'error',
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
