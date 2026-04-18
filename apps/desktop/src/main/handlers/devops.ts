/**
 * DevOps IPC handlers: devops:*
 */

import { ipcMain } from 'electron';
import keytar from 'keytar';
import { localDb, KEYTAR_SERVICE, KEYTAR_GITHUB_TOKEN, KEYTAR_COOLIFY_KEY } from './state';
import { BUILT_IN_TEMPLATES } from '../../lib/devops/devops-templates';
import { GitHubActionsClient } from '../../lib/devops/github-actions-client';
import { CoolifyClient } from '../../lib/devops/coolify-client';
import { runHealthCheck } from '../../lib/devops/health-check';
import type { ProjectDevOpsConfig } from '../../lib/shared-types';

export function registerDevOpsHandlers(): void {
  ipcMain.handle('devops:listTemplates', () =>
    localDb ? localDb.listDevOpsTemplates() : BUILT_IN_TEMPLATES
  );

  ipcMain.handle('devops:createTemplate', (_event, template: any) => {
    if (!localDb) throw new Error('DB not initialized');
    const t = {
      ...template,
      id: template.id ?? crypto.randomUUID(),
      isBuiltIn: false,
    };
    localDb.upsertDevOpsTemplate(t);
    return t;
  });

  ipcMain.handle('devops:updateTemplate', (_event, template: any) => {
    if (!localDb) throw new Error('DB not initialized');
    localDb.upsertDevOpsTemplate(template);
    return { success: true };
  });

  ipcMain.handle('devops:deleteTemplate', (_event, id: string) => {
    if (!localDb) throw new Error('DB not initialized');
    localDb.deleteDevOpsTemplate(id);
    return { success: true };
  });

  ipcMain.handle('devops:getProjectConfig', (_event, projectId: string) => {
    return localDb?.getProjectDevOpsConfig(projectId) ?? null;
  });

  ipcMain.handle('devops:saveProjectConfig', (_event, config: ProjectDevOpsConfig) => {
    localDb?.saveProjectDevOpsConfig(config);
    return { success: true };
  });

  ipcMain.handle('devops:setGitHubToken', async (_event, token: string) => {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_GITHUB_TOKEN, token);
    return { success: true };
  });

  ipcMain.handle('devops:setCoolifyApiKey', async (_event, apiKey: string) => {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY, apiKey);
    return { success: true };
  });

  ipcMain.handle('devops:listWorkflowRuns', async (_event, owner: string, repo: string) => {
    const token = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_GITHUB_TOKEN);
    if (!token) throw new Error('GitHub token not set');
    const client = new GitHubActionsClient(token);
    return client.listWorkflowRuns(owner, repo);
  });

  ipcMain.handle('devops:deploy', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.deploy(appId);
  });

  ipcMain.handle('devops:restart', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.restart(appId);
  });

  ipcMain.handle('devops:stop', async (_event, appId: string, baseUrl: string) => {
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_COOLIFY_KEY);
    if (!apiKey) throw new Error('Coolify API key not set');
    const client = new CoolifyClient(apiKey, baseUrl);
    return client.stop(appId);
  });

  ipcMain.handle('devops:healthCheck', async (_event, url: string) => {
    return runHealthCheck(url);
  });

  ipcMain.handle('devops:listDeployRuns', (_event, projectId: string) => {
    return localDb?.listDeployRuns(projectId) ?? [];
  });
}
