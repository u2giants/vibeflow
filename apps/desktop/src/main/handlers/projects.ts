/**
 * Projects IPC handlers: projects:list, projects:create, projects:getSelfMaintenance,
 * projects:getVibeFlowRepoPath, projects:pickVibeFlowRepoPath, projects:createSelfMaintenance,
 * projects:listAll, projects:getConfig, projects:saveConfig, projects:copyCredential
 */

import { ipcMain, dialog, app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import keytar from 'keytar';
import type { CreateProjectArgs, ProjectConfig } from '../../lib/shared-types';
import { localDb, syncEngine, KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH, changeEngine, container as state } from './state';
import { getCurrentUserId } from './helpers';
import { SecretsStore } from '../../lib/secrets/secrets-store';
import { DriftDetector } from '../../lib/drift-detector';
import { EvidenceCaptureEngine } from '../../lib/runtime-execution/evidence-capture-engine';
import { WatchEngine } from '../../lib/observability/watch-engine';
import { RuntimeExecutionService } from '../../lib/runtime-execution/runtime-execution-service';
import { BrowserAutomationService } from '../../lib/runtime-execution/browser-automation-service';
import { VerificationEngine } from '../../lib/verification/verification-engine';
import { ValidityPipeline } from '../../lib/change-engine/validity-pipeline';

export function registerProjectsHandlers(): void {
  ipcMain.handle('projects:list', async (): Promise<unknown[]> => {
    if (!localDb) return [];
    const userId = await getCurrentUserId();
    return localDb.listProjects(userId);
  });

  ipcMain.handle(
    'projects:create',
    async (_event: IpcMainInvokeEvent, args: CreateProjectArgs): Promise<unknown> => {
      if (!localDb) throw new Error('Local DB not initialized');

      const userId = await getCurrentUserId();
      const now = new Date().toISOString();
      const project = {
        id: crypto.randomUUID(),
        userId,
        name: args.name,
        description: args.description ?? null,
        isSelfMaintenance: false,
        setupComplete: !!args.wizardPayload,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      };

      localDb.insertProject(project);

      if (syncEngine) {
        syncEngine.pushProject(project).catch(err =>
          console.warn('[main] pushProject failed (non-fatal):', err)
        );
      }

      // ── Wizard payload processing ──────────────────────────────────────
      if (args.wizardPayload) {
        const payload = args.wizardPayload;

        // 1. Save non-secret config
        if (payload.config) {
          localDb.upsertProjectConfig({
            projectId: project.id,
            ...payload.config,
            updatedAt: now,
          });
        }

        // 2. Store each secret in keytar
        for (const secret of payload.secrets ?? []) {
          if (secret.value) {
            await keytar.setPassword(KEYTAR_SERVICE, `project-${project.id}-${secret.credentialType}`, secret.value);
          }
        }

        // 3. If GitHub PAT provided, auto-create GitHub MCP server
        const githubSecret = payload.secrets?.find(s => s.credentialType === 'github-pat');
        if (githubSecret?.value) {
          const githubMcpConfig = {
            id: `mcp-github-${project.id}`,
            name: 'GitHub',
            description: 'GitHub MCP server for repo access, PRs, issues, and Actions',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: githubSecret.value },
            transport: 'stdio' as const,
            authMethod: null,
            scope: 'project',
            enabled: true,
            projectId: project.id,
            health: 'unknown' as const,
            lastHealthCheckAt: null,
            discoveredTools: [],
            createdAt: now,
            updatedAt: now,
          };
          localDb.upsertMcpServer(githubMcpConfig);
        }

        // 4. If SSH target provided, create SshTarget record
        if (payload.sshTarget) {
          const sshTarget = {
            id: `ssh-${project.id}-${Date.now()}`,
            userId,
            name: payload.sshTarget.name || payload.sshTarget.hostname,
            hostname: payload.sshTarget.hostname,
            username: payload.sshTarget.user,
            port: payload.sshTarget.port ?? 22,
            identityFile: payload.sshTarget.identityFile,
            projectId: project.id,
            createdAt: now,
          };
          localDb.insertSshTarget(sshTarget);
        }

        // 5. If custom MCP servers provided, create McpServerConfig records
        for (const mcp of payload.mcpServers ?? []) {
          const mcpConfig = {
            id: `mcp-custom-${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: mcp.name,
            description: mcp.description || '',
            command: mcp.command,
            args: mcp.args ?? [],
            env: mcp.env ?? {},
            transport: mcp.transport,
            authMethod: null,
            scope: 'project',
            enabled: true,
            projectId: project.id,
            health: 'unknown' as const,
            lastHealthCheckAt: null,
            discoveredTools: [],
            createdAt: now,
            updatedAt: now,
          };
          localDb.upsertMcpServer(mcpConfig);
        }
      }

      return project;
    }
  );

  ipcMain.handle('projects:getSelfMaintenance', async (): Promise<unknown | null> => {
    if (!localDb) return null;
    return localDb.getSelfMaintenanceProject();
  });

  ipcMain.handle('projects:getVibeFlowRepoPath', async (): Promise<string | null> => {
    if (app.isPackaged) {
      return await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH) ?? null;
    }
    return path.resolve(__dirname, '../../../..');
  });

  ipcMain.handle('projects:pickVibeFlowRepoPath', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select VibeFlow source code folder',
      message: 'Choose the folder where you cloned the VibeFlow repository',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const repoPath = result.filePaths[0];
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_VIBEFLOW_REPO_PATH, repoPath);
    return repoPath;
  });

  // ── New Project Wizard handlers ──────────────────────────────────────

  ipcMain.handle('projects:listAll', async (): Promise<unknown[]> => {
    if (!localDb) return [];
    // listProjects requires a userId; pass empty string to get all rows — the DB query
    // filters by user_id = '', which returns only unauthenticated rows. Instead, get
    // the current user's projects plus any with no user by querying directly if possible.
    // The safest cross-version approach: fetch for current user + '' fallback.
    const userId = await getCurrentUserId();
    const userProjects = localDb.listProjects(userId);
    const anonProjects = userId ? localDb.listProjects('') : [];
    // Deduplicate by id
    const seen = new Set<string>();
    const all: unknown[] = [];
    for (const p of [...userProjects, ...anonProjects]) {
      if (!seen.has((p as { id: string }).id)) {
        seen.add((p as { id: string }).id);
        all.push(p);
      }
    }
    return all;
  });

  ipcMain.handle('projects:getConfig', async (_e: IpcMainInvokeEvent, projectId: string): Promise<unknown> => {
    if (!localDb) return null;
    return localDb.getProjectConfig(projectId);
  });

  ipcMain.handle('projects:saveConfig', async (_e: IpcMainInvokeEvent, config: ProjectConfig): Promise<void> => {
    if (!localDb) throw new Error('DB not initialized');
    localDb.upsertProjectConfig({ ...config, updatedAt: new Date().toISOString() });
  });

  ipcMain.handle('projects:copyCredential', async (_e: IpcMainInvokeEvent, sourceProjectId: string, credentialType: string): Promise<string | null> => {
    const value = await keytar.getPassword(KEYTAR_SERVICE, `project-${sourceProjectId}-${credentialType}`);
    return value ?? null;
  });

  ipcMain.handle('projects:createSelfMaintenance', async (): Promise<unknown> => {
    // Lazy-initialize DB if it failed during startup (e.g. better-sqlite3 native module issue)
    if (!localDb) {
      try {
        const { LocalDb } = await import('../../lib/storage');
        const dbPath = path.join(app.getPath('userData'), 'vibeflow-cache.sqlite');
        state.localDb = new LocalDb(dbPath);
        await state.localDb.init();
        const { ChangeEngine } = await import('../../lib/change-engine');
        state.changeEngine = new ChangeEngine(state.localDb);
        const secretsStore = new SecretsStore(state.localDb);
        const driftDetector = new DriftDetector(state.localDb, secretsStore);
        state.evidenceEngine = new EvidenceCaptureEngine(state.localDb);
        state.watchEngine = new WatchEngine(state.localDb, driftDetector, state.evidenceEngine, state.mainWindow);
        const lazyScreenshotDir = path.join(app.getPath('userData'), 'screenshots');
        state.runtimeService = new RuntimeExecutionService(state.localDb, state.evidenceEngine);
        state.browserService = new BrowserAutomationService(state.localDb, state.evidenceEngine, lazyScreenshotDir);
        const lazyValidityPipeline = new ValidityPipeline();
        state.verificationEngine = new VerificationEngine(state.localDb, lazyValidityPipeline, state.evidenceEngine, state.browserService);
        const { DEFAULT_MODES } = await import('../../lib/modes/default-modes');
        state.localDb.seedDefaultModes(DEFAULT_MODES);
        state.localDb.migrateDefaultModelId('anthropic/claude-sonnet-4-5', 'anthropic/claude-sonnet-4-6');
        console.log('[main] LocalDb lazy-initialized in createSelfMaintenance');
      } catch (err) {
        console.error('[main] LocalDb lazy-init failed:', err);
        throw new Error('Local DB could not be initialized. Please restart the app.');
      }
    }

    // Check if already exists
    const existing = localDb!.getSelfMaintenanceProject();
    if (existing) return existing;

    const project = {
      id: crypto.randomUUID(),
      userId: '',
      name: 'VibeFlow (Self-Maintenance)',
      description: 'Work on the VibeFlow IDE itself',
      isSelfMaintenance: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    };

    localDb!.insertProject(project);
    return project;
  });

  // ── projects:pickFolder ────────────────────────────────────────────────────
  // Opens a native folder picker; returns the selected path or null.
  ipcMain.handle('projects:pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select project folder',
      message: 'Choose the folder where this project\'s code lives',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // ── projects:updateWizard ─────────────────────────────────────────────────
  // Updates an existing project's config + secrets from a re-run of the wizard.
  // Does NOT re-create the project record — only updates name, description,
  // config, and keytar secrets. Empty secret values are treated as "no change".
  ipcMain.handle(
    'projects:updateWizard',
    async (_e: IpcMainInvokeEvent, projectId: string, args: import('../../lib/shared-types').CreateProjectArgs): Promise<void> => {
      if (!localDb) throw new Error('DB not initialized');
      const now = new Date().toISOString();

      // Update name/description on the project row
      const userId = await getCurrentUserId();
      const projects = localDb.listProjects(userId);
      const existing = projects.find(p => p.id === projectId);
      if (existing) {
        localDb.insertProject({
          ...existing,
          name: args.name,
          description: args.description ?? null,
          setupComplete: true,
          updatedAt: now,
        });
      }

      if (args.wizardPayload) {
        const payload = args.wizardPayload;

        // Update non-secret config
        if (payload.config) {
          localDb.upsertProjectConfig({ projectId, ...payload.config, updatedAt: now });
        }

        // Update secrets — only write non-empty values (empty = "don't change")
        for (const secret of payload.secrets ?? []) {
          if (secret.value?.trim()) {
            await keytar.setPassword(KEYTAR_SERVICE, `project-${projectId}-${secret.credentialType}`, secret.value);
          }
        }

        // Re-create/update GitHub MCP if PAT provided
        const githubSecret = payload.secrets?.find(s => s.credentialType === 'github-pat');
        if (githubSecret?.value) {
          const mcpId = `mcp-github-${projectId}`;
          localDb.upsertMcpServer({
            id: mcpId,
            name: 'GitHub',
            description: 'GitHub MCP server for repo access, PRs, issues, and Actions',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: githubSecret.value },
            transport: 'stdio' as const,
            authMethod: null,
            scope: 'project',
            enabled: true,
            projectId,
            health: 'unknown' as const,
            lastHealthCheckAt: null,
            discoveredTools: [],
            createdAt: now,
            updatedAt: now,
          });
        }

        // SSH target update
        if (payload.sshTarget) {
          localDb.upsertSshTarget({
            id: `ssh-${projectId}-main`,
            userId,
            name: payload.sshTarget.name || payload.sshTarget.hostname,
            hostname: payload.sshTarget.hostname,
            username: payload.sshTarget.user,
            port: payload.sshTarget.port ?? 22,
            identityFile: payload.sshTarget.identityFile,
            projectId,
            createdAt: now,
          });
        }

        // Additional custom MCP servers
        for (const mcp of payload.mcpServers ?? []) {
          localDb.upsertMcpServer({
            id: `mcp-custom-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: mcp.name,
            description: mcp.description || '',
            command: mcp.command,
            args: mcp.args ?? [],
            env: mcp.env ?? {},
            transport: mcp.transport,
            authMethod: null,
            scope: 'project',
            enabled: true,
            projectId,
            health: 'unknown' as const,
            lastHealthCheckAt: null,
            discoveredTools: [],
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    },
  );

  // ── projects:delete ───────────────────────────────────────────────────────
  ipcMain.handle('projects:delete', async (_e: IpcMainInvokeEvent, projectId: string): Promise<void> => {
    if (!localDb) throw new Error('DB not initialized');
    const userId = await getCurrentUserId();
    const projects = localDb.listProjects(userId);
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');
    if (project.isSelfMaintenance) throw new Error('Cannot delete the self-maintenance project');

    const credentialTypes = [
      'github-pat', 'coolify-token', 'railway-key', 'supabase-service-role',
      'cloudflare-token', 'brevo-key', 'clawdtalk-key', 'google-oauth-secret', 'azure-oauth-secret',
    ];
    for (const ct of credentialTypes) {
      await keytar.deletePassword(KEYTAR_SERVICE, `project-${projectId}-${ct}`);
    }

    localDb.deleteProject(projectId);
  });
}
