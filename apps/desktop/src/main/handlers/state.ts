/**
 * Shared state for Electron main process.
 * All module-level variables live here to avoid a 2,400-line index.ts.
 */

import type { BrowserWindow } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocalDb } from '../../lib/storage';
import type { SyncEngine } from '../../lib/sync/sync-engine';
import { FileService } from '../../lib/tooling/file-service';
import { TerminalService } from '../../lib/tooling/terminal-service';
import { GitService } from '../../lib/tooling/git-service';
import { SshService } from '../../lib/tooling/ssh-service';
import { CapabilityRegistry } from '../../lib/capability-fabric/capability-registry';
import { McpConnectionManager } from '../../lib/mcp-manager/mcp-connection-manager';
import { McpToolExecutor } from '../../lib/mcp-manager/mcp-tool-executor';
import type { OrchestrationEngine } from '../../lib/orchestrator/orchestration-engine';
import type { ChangeEngine } from '../../lib/change-engine';
import type { WatchEngine } from '../../lib/observability/watch-engine';
import type { EvidenceCaptureEngine } from '../../lib/runtime-execution/evidence-capture-engine';
import type { RuntimeExecutionService } from '../../lib/runtime-execution/runtime-execution-service';
import type { BrowserAutomationService } from '../../lib/runtime-execution/browser-automation-service';
import type { VerificationEngine } from '../../lib/verification/verification-engine';

export const KEYTAR_SERVICE = 'vibeflow';
export const KEYTAR_OPENROUTER_KEY = 'openrouter-api-key';
export const KEYTAR_GITHUB_TOKEN = 'github-token';
export const KEYTAR_VIBEFLOW_REPO_PATH = 'vibeflow-repo-path';
export const KEYTAR_COOLIFY_KEY = 'coolify-api-key';

export let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
export let localDb: LocalDb | null = null;
export let supabase: SupabaseClient | null = null;
export let syncEngine: SyncEngine | null = null;
export const fileService = new FileService();
export const terminalService = new TerminalService();
export const gitService = new GitService();
export const sshService = new SshService();
export const capabilityRegistry = new CapabilityRegistry();
export const mcpConnectionManager = new McpConnectionManager();
export const mcpToolExecutor = new McpToolExecutor();
export let orchestrationEngine: OrchestrationEngine | null = null;
export let changeEngine: ChangeEngine | null = null;
export let watchEngine: WatchEngine | null = null;
export let evidenceEngine: EvidenceCaptureEngine | null = null;
export let runtimeService: RuntimeExecutionService | null = null;
export let browserService: BrowserAutomationService | null = null;
export let verificationEngine: VerificationEngine | null = null;
