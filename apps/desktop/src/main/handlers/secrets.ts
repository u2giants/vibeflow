/**
 * Secrets IPC handlers: secrets:*
 * Includes both the secret-record metadata handlers and the cloud sync handlers.
 */

import { ipcMain } from 'electron';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const keytar = require('keytar') as { getPassword: (s: string, a: string) => Promise<string | null>; setPassword: (s: string, a: string, p: string) => Promise<void> };
import type { SecretRecord } from '../../lib/shared-types';
import { localDb, secretsSync } from './state';
import { KEYTAR_SERVICE } from './state';

/** Map of integration slug → keytar credential type suffix (mirrors wizard naming). */
const INTEGRATION_CRED_TYPES: Record<string, string> = {
  github:        'github-pat',
  coolify:       'coolify-token',
  railway:       'railway-key',
  supabase:      'supabase-service-role',
  cloudflare:    'cloudflare-token',
  brevo:         'brevo-key',
  clawdtalk:     'clawdtalk-key',
  'google-oauth': 'google-oauth-secret',
  'azure-oauth':  'azure-oauth-secret',
};

export function registerSecretsHandlers(): void {
  ipcMain.handle('secrets:list', async (_event, projectId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.listSecretRecords(projectId);
  });

  ipcMain.handle('secrets:get', async (_event, id: string): Promise<SecretRecord | null> => {
    if (!localDb) return null;
    return localDb.getSecretRecord(id);
  });

  ipcMain.handle('secrets:upsert', async (_event, record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>): Promise<SecretRecord> => {
    if (!localDb) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const full: SecretRecord = { ...record, createdAt: now, updatedAt: now };
    localDb.upsertSecretRecord(full);
    return full;
  });

  ipcMain.handle('secrets:delete', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.deleteSecretRecord(id);
    return { success: true };
  });

  ipcMain.handle('secrets:getMissingForEnvironment', async (_event, projectId: string, environmentId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.getMissingSecretsForEnvironment(projectId, environmentId);
  });

  ipcMain.handle('secrets:getChangedSinceLastDeploy', async (_event, projectId: string): Promise<SecretRecord[]> => {
    if (!localDb) return [];
    return localDb.getChangedSecretsSinceLastDeploy(projectId);
  });

  ipcMain.handle('secrets:verify', async (_event, id: string): Promise<{ success: boolean; error?: string }> => {
    if (!localDb) return { success: false, error: 'Database not initialized' };
    return localDb.verifySecret(id);
  });

  ipcMain.handle('secrets:getInventorySummary', async (_event, projectId: string): Promise<{ total: number; missing: number; verified: number }> => {
    if (!localDb) return { total: 0, missing: 0, verified: 0 };
    return localDb.getSecretInventorySummary(projectId);
  });

  // ── Cloud sync handlers ───────────────────────────────────────────────────

  ipcMain.handle('secrets:setPassphrase', async (_event, passphrase: string): Promise<{ success: boolean; error?: string }> => {
    const state = require('./state');
    if (!state.secretsSync) return { success: false, error: 'Secrets sync not initialized — sign in first' };
    state.secretsSync.setPassphrase(passphrase);
    return { success: true };
  });

  ipcMain.handle('secrets:hasPassphrase', async (): Promise<boolean> => {
    const state = require('./state');
    return state.secretsSync?.hasPassphrase() ?? false;
  });

  ipcMain.handle('secrets:clearPassphrase', async (): Promise<{ success: boolean }> => {
    const state = require('./state');
    state.secretsSync?.clearPassphrase();
    return { success: true };
  });

  ipcMain.handle('secrets:syncUp', async (): Promise<{ success: boolean; uploaded: number; error?: string }> => {
    const state = require('./state');
    if (!state.secretsSync) return { success: false, uploaded: 0, error: 'Secrets sync not initialized — sign in first' };
    if (!state.secretsSync.hasPassphrase()) return { success: false, uploaded: 0, error: 'Set a passphrase first' };
    if (!localDb) return { success: false, uploaded: 0, error: 'Database not initialized' };

    // Gather all keytar secrets across all projects
    const userId = await (await import('./helpers')).getCurrentUserId();
    const projects = localDb.listProjects(userId);
    const secrets: Array<{ projectId: string; credentialType: string; value: string }> = [];

    for (const project of projects) {
      const config = localDb.getProjectConfig(project.id);
      const integrations: string[] = config?.enabledIntegrations ?? [];
      for (const integration of integrations) {
        const credType = INTEGRATION_CRED_TYPES[integration];
        if (!credType) continue;
        const value = await keytar.getPassword(KEYTAR_SERVICE, `project-${project.id}-${credType}`);
        if (value) secrets.push({ projectId: project.id, credentialType: credType, value });
      }
    }

    return state.secretsSync.syncUp(secrets);
  });

  ipcMain.handle('secrets:syncDown', async (): Promise<{ success: boolean; restored: number; error?: string }> => {
    const state = require('./state');
    if (!state.secretsSync) return { success: false, restored: 0, error: 'Secrets sync not initialized — sign in first' };
    if (!state.secretsSync.hasPassphrase()) return { success: false, restored: 0, error: 'Set a passphrase first' };

    const result = await state.secretsSync.syncDown();
    if (!result.success || !result.secrets) return { success: false, restored: 0, error: result.error };

    let restored = 0;
    for (const s of result.secrets) {
      await keytar.setPassword(KEYTAR_SERVICE, `project-${s.projectId}-${s.credentialType}`, s.value);
      restored++;
    }

    return { success: true, restored };
  });
}
