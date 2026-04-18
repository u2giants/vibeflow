/**
 * Migration IPC handlers: migration:*
 */

import { ipcMain } from 'electron';
import type { MigrationPlan, MigrationRiskClass } from '../../lib/shared-types';
import { localDb } from './state';
import { generatePreview, classifyRisk, requiresCheckpoint } from '../../lib/secrets/migration-safety';

export function registerMigrationHandlers(): void {
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
}
