import re

# Patch main/index.ts
with open('src/main/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
old_import = "import type { CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs } from '../lib/shared-types';"
new_import = """import type { CreateWorkspaceRunArgs, ApplyPatchArgs, CommitWorkspaceArgs, SecretRecord, MigrationPlan, MigrationRiskClass } from '../lib/shared-types';
import { SecretsStore } from '../lib/secrets/secrets-store';
import { classifyRisk, generatePreview, requiresCheckpoint } from '../lib/secrets/migration-safety';"""
content = content.replace(old_import, new_import)

# Add IPC handlers before createWindow()
old_create = "  createWindow();"
new_handlers = """  // ── Component 18: Secrets IPC ───────────────────────────────────────────────

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

  // ── Component 18: Migration IPC ─────────────────────────────────────────────

  ipcMain.handle('migration:createPlan', async (_event, plan: Omit<MigrationPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MigrationPlan> => {
    if (!localDb) throw new Error('Database not initialized');
    const fullPlan: MigrationPlan = { ...plan, id: `migration-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localDb.upsertMigrationPlan(fullPlan);
    return fullPlan;
  });

  ipcMain.handle('migration:getPlan', async (_event, id: string): Promise<MigrationPlan | null> => {
    if (!localDb) return null;
    return localDb.getMigrationPlan(id);
  });

  ipcMain.handle('migration:listPlans', async (_event, projectId: string): Promise<MigrationPlan[]> => {
    if (!localDb) return [];
    return localDb.listMigrationPlans(projectId);
  });

  ipcMain.handle('migration:generatePreview', async (_event, planId: string): Promise<any> => {
    if (!localDb) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: [] };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { planId, sqlPreview: '', affectedEntities: [], destructiveOperations: [], estimatedDowntime: null, warnings: ['Plan not found'] };
    return generatePreview(plan);
  });

  ipcMain.handle('migration:classifyRisk', async (_event, sql: string): Promise<{ riskClass: MigrationRiskClass; safeguards: any[] }> => {
    return classifyRisk(sql);
  });

  ipcMain.handle('migration:getSchemaInfo', async (_event, projectId: string): Promise<any | null> => {
    return { projectId, engine: 'sqlite', schemaSourceFiles: ['apps/desktop/src/lib/storage/local-db.ts'], migrationHistory: localDb ? localDb.listMigrationHistory(projectId) : [], tables: [], relationships: [], protectedEntities: [], highRiskDomains: [] };
  });

  ipcMain.handle('migration:requireCheckpoint', async (_event, planId: string): Promise<{ checkpointRequired: boolean; checkpointId?: string }> => {
    if (!localDb) return { checkpointRequired: false };
    const plan = localDb.getMigrationPlan(planId);
    if (!plan) return { checkpointRequired: false };
    return { checkpointRequired: requiresCheckpoint(plan.riskClass), checkpointId: plan.checkpointId ?? undefined };
  });

  ipcMain.handle('migration:listHistory', async (_event, projectId: string): Promise<any[]> => {
    if (!localDb) return [];
    return localDb.listMigrationHistory(projectId);
  });

  createWindow();"""

content = content.replace(old_create, new_handlers)

with open('src/main/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('main/index.ts patched')

# Patch preload/index.ts
with open('src/preload/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_acceptance = """  acceptance: {
    generate: (args) => ipcRenderer.invoke('acceptance:generate', args),
    get: (missionId: string) => ipcRenderer.invoke('acceptance:get', missionId),
  },
};"""

new_acceptance = """  acceptance: {
    generate: (args) => ipcRenderer.invoke('acceptance:generate', args),
    get: (missionId: string) => ipcRenderer.invoke('acceptance:get', missionId),
  },
  // Component 18: Secrets and Migration
  secrets: {
    list: (projectId: string) => ipcRenderer.invoke('secrets:list', projectId),
    get: (id: string) => ipcRenderer.invoke('secrets:get', id),
    upsert: (record: any) => ipcRenderer.invoke('secrets:upsert', record),
    delete: (id: string) => ipcRenderer.invoke('secrets:delete', id),
    getMissingForEnvironment: (projectId: string, environmentId: string) => ipcRenderer.invoke('secrets:getMissingForEnvironment', projectId, environmentId),
    getChangedSinceLastDeploy: (projectId: string) => ipcRenderer.invoke('secrets:getChangedSinceLastDeploy', projectId),
    verify: (id: string) => ipcRenderer.invoke('secrets:verify', id),
    getInventorySummary: (projectId: string) => ipcRenderer.invoke('secrets:getInventorySummary', projectId),
  },
  migration: {
    createPlan: (plan: any) => ipcRenderer.invoke('migration:createPlan', plan),
    getPlan: (id: string) => ipcRenderer.invoke('migration:getPlan', id),
    listPlans: (projectId: string) => ipcRenderer.invoke('migration:listPlans', projectId),
    generatePreview: (planId: string) => ipcRenderer.invoke('migration:generatePreview', planId),
    classifyRisk: (sql: string) => ipcRenderer.invoke('migration:classifyRisk', sql),
    getSchemaInfo: (projectId: string) => ipcRenderer.invoke('migration:getSchemaInfo', projectId),
    requireCheckpoint: (planId: string) => ipcRenderer.invoke('migration:requireCheckpoint', planId),
    listHistory: (projectId: string) => ipcRenderer.invoke('migration:listHistory', projectId),
  },
};"""

content = content.replace(old_acceptance, new_acceptance)

with open('src/preload/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('preload/index.ts patched')
