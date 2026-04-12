/** IPC message types for Electron main ↔ renderer communication. */

import type { Project, SyncStatus, Account, Mode, OpenRouterModel, ConversationThread, Message } from './entities';

// ── Auth IPC ──────────────────────────────────────────────────────

export interface AuthSignInResult {
  success: boolean;
  error?: string;
  account?: Account;
}

export interface AuthChannel {
  signInWithGitHub: () => Promise<AuthSignInResult>;
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

export interface ModesChannel {
  list: () => Promise<Mode[]>;
  updateSoul: (args: UpdateModeSoulArgs) => Promise<{ success: boolean }>;
  updateModel: (args: UpdateModeModelArgs) => Promise<{ success: boolean }>;
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

export interface ConversationsChannel {
  list: (projectId: string) => Promise<ConversationThread[]>;
  create: (args: CreateConversationArgs) => Promise<ConversationThread>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  sendMessage: (args: SendMessageArgs) => Promise<Message>;
  onStreamToken: (callback: (data: StreamTokenData) => void) => void;
  onStreamDone: (callback: (data: StreamDoneData) => void) => void;
  onStreamError: (callback: (data: StreamErrorData) => void) => void;
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
}
