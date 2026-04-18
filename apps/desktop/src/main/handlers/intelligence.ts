/**
 * Project Intelligence IPC handlers: projectIntelligence:*, contextPacks:*
 */

import { ipcMain } from 'electron';
import { localDb, mainWindow } from './state';
import { getProjectRepoPath } from './helpers';
import { IndexingPipeline, detectFramework, ImpactAnalyzer, TopologyBuilder, ContextPackAssembler } from '../../lib/project-intelligence';

export function registerIntelligenceHandlers(): void {
  // ── Project Intelligence IPC Handlers (Component 11) ──────────────

  ipcMain.handle('projectIntelligence:getIndex', async (_event, projectId: string) => {
    if (!localDb) return null;
    return localDb.getProjectIndex(projectId);
  });

  ipcMain.handle('projectIntelligence:triggerIndex', async (_event, projectId: string, options?: { fullReindex: boolean }) => {
    if (!localDb) throw new Error('DB not initialized');

    // Get project path — for self-maintenance use VibeFlow repo, otherwise use a default
    const repoPath = await getProjectRepoPath(projectId);

    const pipeline = new IndexingPipeline(localDb, projectId, repoPath, (current, total) => {
      if (mainWindow) {
        mainWindow.webContents.send('projectIntelligence:indexProgress', { current, total });
      }
    });

    const result = await pipeline.run(options);
    return { success: true, fileCount: result.fileCount };
  });

  ipcMain.handle('projectIntelligence:getIndexStatus', async (_event, projectId: string) => {
    if (!localDb) return { indexed: false, fileCount: 0, staleness: 'unknown', indexedAt: null };
    const index = localDb.getProjectIndex(projectId);
    const fileCount = localDb.listFileRecords(projectId).length;
    return {
      indexed: !!index,
      fileCount,
      staleness: index?.staleness ?? 'unknown',
      indexedAt: index?.indexedAt ?? null,
    };
  });

  ipcMain.handle('projectIntelligence:getFiles', async (_event, projectId: string, filter?: { language?: string; isGenerated?: boolean }) => {
    if (!localDb) return [];
    return localDb.listFileRecords(projectId, filter);
  });

  ipcMain.handle('projectIntelligence:getFile', async (_event, projectId: string, path: string) => {
    if (!localDb) return null;
    return localDb.getFileRecord(projectId, path);
  });

  ipcMain.handle('projectIntelligence:getSymbols', async (_event, projectId: string, filter?: { fileId?: string; kind?: string }) => {
    if (!localDb) return [];
    return localDb.listSymbolRecords(projectId, filter);
  });

  ipcMain.handle('projectIntelligence:getSymbol', async (_event, projectId: string, id: string) => {
    if (!localDb) return null;
    return localDb.getSymbolRecord(projectId, id);
  });

  ipcMain.handle('projectIntelligence:getImpactAnalysis', async (_event, projectId: string, targetPath: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const analyzer = new ImpactAnalyzer(localDb, projectId);
    return analyzer.analyze(targetPath);
  });

  ipcMain.handle('projectIntelligence:getTopology', async (_event, projectId: string) => {
    if (!localDb) return { nodes: [], edges: [] };
    const stack = detectFramework(await getProjectRepoPath(projectId));
    const builder = new TopologyBuilder(localDb, projectId);
    return builder.build(stack);
  });

  ipcMain.handle('projectIntelligence:getConfigVariables', async (_event, projectId: string) => {
    if (!localDb) return [];
    return localDb.listConfigVariableRecords(projectId);
  });

  ipcMain.handle('projectIntelligence:getMissingConfig', async (_event, projectId: string, environment: string) => {
    if (!localDb) return [];
    const all = localDb.listConfigVariableRecords(projectId);
    return all.filter(c => c.missingEnvironments.includes(environment));
  });

  ipcMain.handle('projectIntelligence:getDetectedStack', async (_event, projectId: string) => {
    const repoPath = await getProjectRepoPath(projectId);
    return detectFramework(repoPath);
  });

  // ── Context Packs IPC Handlers (Component 11) ─────────────────────

  ipcMain.handle('contextPacks:createPack', async (_event, missionId: string, options?) => {
    if (!localDb) throw new Error('DB not initialized');

    // Get projectId from mission
    const mission = localDb.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const assembler = new ContextPackAssembler(localDb, mission.projectId);
    return assembler.assemble(missionId, options);
  });

  ipcMain.handle('contextPacks:getPack', async (_event, packId: string) => {
    if (!localDb) return null;
    return localDb.getContextPack(packId);
  });

  ipcMain.handle('contextPacks:getPackForMission', async (_event, missionId: string) => {
    if (!localDb) return null;
    return localDb.getContextPackForMission(missionId);
  });

  ipcMain.handle('contextPacks:updatePack', async (_event, packId: string, updates) => {
    if (!localDb) throw new Error('DB not initialized');
    const pack = localDb.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);
    if (updates.items) pack.items = updates.items;
    if (updates.warnings) pack.warnings = updates.warnings;
    pack.updatedAt = new Date().toISOString();
    localDb.upsertContextPack(pack);
    return pack;
  });

  ipcMain.handle('contextPacks:pinItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.pinItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:unpinItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.unpinItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:swapStaleItem', async (_event, packId: string, itemId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.swapStaleItem(packId, itemId);
  });

  ipcMain.handle('contextPacks:getDashboard', async (_event, packId: string) => {
    if (!localDb) throw new Error('DB not initialized');
    const assembler = new ContextPackAssembler(localDb, '');
    return assembler.getDashboard(packId);
  });
}
