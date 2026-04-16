/** Capability adapters — wrap existing tooling services as registered capabilities. */

import type { Capability, CapabilityAction, CapabilityPermission, CapabilityInvocationLog } from '../shared-types';
import type { CapabilityRegistry } from './capability-registry';
import { FileService } from '../tooling/file-service';
import { TerminalService } from '../tooling/terminal-service';
import { GitService } from '../tooling/git-service';
import { SshService } from '../tooling/ssh-service';
import type { BrowserWindow } from 'electron';
import { classifyTerminalCommand } from './terminal-policy';
import type { ApprovalTier } from '../approval/approval-engine';

/** Map a capability permission to an approval tier. */
function permissionToTier(permission: CapabilityPermission): ApprovalTier {
  const tier1: CapabilityPermission[] = ['read-only'];
  const tier2: CapabilityPermission[] = ['local-write', 'repository-mutation'];
  if (tier1.includes(permission)) return 1;
  if (tier2.includes(permission)) return 2;
  return 3; // environment-mutation, service-mutation, deployment-action, destructive-action, privileged-host-action, secret-bearing-action
}

/** Generate a unique action id. */
function actionId(capId: string, action: string): string {
  return `${capId}:${action}`;
}

/** Create a base capability config. */
function baseCapability(id: string, name: string): Omit<Capability, 'actions' | 'createdAt' | 'updatedAt'> {
  const now = new Date().toISOString();
  return {
    id,
    name,
    type: 'direct',
    class: 'filesystem',
    owner: 'builtin',
    description: '',
    scope: '',
    authMethod: 'none',
    health: 'unknown',
    enabled: true,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    auditNotes: '',
    projectId: null,
    lastFailure: null,
    permissions: [],
  };
}

// ── File Capability Adapter ──────────────────────────────────────────

export function registerFileCapability(registry: CapabilityRegistry): void {
  const capId = 'builtin:filesystem';
  const actions: CapabilityAction[] = [
    {
      id: actionId(capId, 'read'),
      name: 'files:read',
      description: 'Read file contents from the project directory',
      parameterSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'write'),
      name: 'files:write',
      description: 'Write content to a file in the project directory',
      parameterSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      permission: 'local-write',
    },
    {
      id: actionId(capId, 'list'),
      name: 'files:list',
      description: 'List files and directories in the project directory',
      parameterSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'exists'),
      name: 'files:exists',
      description: 'Check if a file exists in the project directory',
      parameterSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      permission: 'read-only',
    },
  ];

  const capability: Capability = {
    ...baseCapability(capId, 'File System'),
    class: 'filesystem',
    description: 'Read and write files in the project directory with path traversal protection',
    scope: 'Project directory file operations',
    actions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registry.register(capability);
}

// ── Terminal Capability Adapter ──────────────────────────────────────

export function registerTerminalCapability(registry: CapabilityRegistry): void {
  const capId = 'builtin:terminal';
  const actions: CapabilityAction[] = [
    {
      id: actionId(capId, 'run'),
      name: 'terminal:run',
      description: 'Run a shell command in the project directory',
      parameterSchema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command', 'cwd'] },
      permission: 'local-write', // Will be re-classified at runtime by terminal policy
    },
    {
      id: actionId(capId, 'kill'),
      name: 'terminal:kill',
      description: 'Kill a running terminal command',
      parameterSchema: { type: 'object', properties: { commandId: { type: 'string' } }, required: ['commandId'] },
      permission: 'read-only',
    },
  ];

  const capability: Capability = {
    ...baseCapability(capId, 'Terminal'),
    class: 'terminal',
    description: 'Execute shell commands in the project directory with streaming output',
    scope: 'Shell command execution — commands are classified before execution',
    actions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registry.register(capability);
}

/** Classify a terminal command and return the required approval tier. */
export function classifyTerminalAction(command: string): { tier: ApprovalTier; reason: string } {
  const classification = classifyTerminalCommand(command);
  return { tier: classification.approvalTier, reason: classification.reason };
}

// ── Git Capability Adapter ───────────────────────────────────────────

export function registerGitCapability(registry: CapabilityRegistry): void {
  const capId = 'builtin:git';
  const actions: CapabilityAction[] = [
    {
      id: actionId(capId, 'status'),
      name: 'git:status',
      description: 'Get the current git status (branch, staged/unstaged/untracked files)',
      parameterSchema: { type: 'object', properties: { repoPath: { type: 'string' } }, required: ['repoPath'] },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'diff'),
      name: 'git:diff',
      description: 'Get the current git diff',
      parameterSchema: { type: 'object', properties: { repoPath: { type: 'string' }, staged: { type: 'boolean' } }, required: ['repoPath'] },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'commit'),
      name: 'git:commit',
      description: 'Stage all changes and create a git commit',
      parameterSchema: { type: 'object', properties: { repoPath: { type: 'string' }, message: { type: 'string' } }, required: ['repoPath', 'message'] },
      permission: 'repository-mutation',
    },
    {
      id: actionId(capId, 'push'),
      name: 'git:push',
      description: 'Push commits to a remote git repository',
      parameterSchema: { type: 'object', properties: { repoPath: { type: 'string' }, remote: { type: 'string' }, branch: { type: 'string' } }, required: ['repoPath'] },
      permission: 'repository-mutation',
    },
    {
      id: actionId(capId, 'log'),
      name: 'git:log',
      description: 'Get recent git commit history',
      parameterSchema: { type: 'object', properties: { repoPath: { type: 'string' }, limit: { type: 'number' } }, required: ['repoPath'] },
      permission: 'read-only',
    },
  ];

  const capability: Capability = {
    ...baseCapability(capId, 'Git'),
    class: 'git',
    description: 'Git version control operations: status, diff, commit, push, log',
    scope: 'Local git repository operations',
    actions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registry.register(capability);
}

// ── SSH Capability Adapter ───────────────────────────────────────────

export function registerSshCapability(registry: CapabilityRegistry): void {
  const capId = 'builtin:ssh';
  const actions: CapabilityAction[] = [
    {
      id: actionId(capId, 'discover-hosts'),
      name: 'ssh:discover-hosts',
      description: 'Discover SSH hosts from ~/.ssh/config',
      parameterSchema: { type: 'object', properties: {} },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'discover-keys'),
      name: 'ssh:discover-keys',
      description: 'Discover SSH private keys in ~/.ssh/',
      parameterSchema: { type: 'object', properties: {} },
      permission: 'read-only',
    },
    {
      id: actionId(capId, 'test-connection'),
      name: 'ssh:test-connection',
      description: 'Test SSH connection to a host',
      parameterSchema: { type: 'object', properties: { host: { type: 'object' } }, required: ['host'] },
      permission: 'read-only',
    },
  ];

  const capability: Capability = {
    ...baseCapability(capId, 'SSH'),
    class: 'ssh',
    description: 'SSH host discovery, key discovery, and connection testing',
    scope: 'SSH configuration and connectivity',
    actions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registry.register(capability);
}

// ── Bootstrap: Register all builtin capabilities ─────────────────────

export function registerBuiltinCapabilities(registry: CapabilityRegistry): void {
  registerFileCapability(registry);
  registerTerminalCapability(registry);
  registerGitCapability(registry);
  registerSshCapability(registry);
}
