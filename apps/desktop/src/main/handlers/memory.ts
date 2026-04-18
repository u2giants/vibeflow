/**
 * Memory IPC handlers: memory:*, skills:*, decisions:*
 */

import { ipcMain } from 'electron';
import type { MemoryItem, MemoryCategory, Skill, DecisionRecord } from '../../lib/shared-types';
import { localDb } from './state';
import { MemoryRetriever, MemoryLifecycle, seedDecisionsFromDocs, seedIdiosyncrasiesFromDocs } from '../../lib/memory';

export function registerMemoryHandlers(): void {
  // ── Component 20: Memory IPC ──────────────────────────────────────────────

  ipcMain.handle('memory:list', async (_event, projectId: string, filters?: { category?: MemoryCategory; activeOnly?: boolean }): Promise<MemoryItem[]> => {
    if (!localDb) return [];
    return localDb.listMemoryItems(projectId, filters);
  });

  ipcMain.handle('memory:get', async (_event, id: string): Promise<MemoryItem | null> => {
    if (!localDb) return null;
    return localDb.getMemoryItem(id);
  });

  ipcMain.handle('memory:search', async (_event, projectId: string, query: { tags?: string[]; category?: MemoryCategory; triggerMatch?: string }) => {
    if (!localDb) return { items: [], skills: [], decisions: [], retrievalReason: 'DB not initialized', triggerMatch: '', totalTokenEstimate: 0 };
    const retriever = new MemoryRetriever(localDb, projectId);
    const items = localDb.searchMemoryItems(projectId, query);
    const skills = query.triggerMatch
      ? localDb.listSkills(projectId, true).filter(s => s.triggerConditions.some(tc => query.triggerMatch!.toLowerCase().includes(tc.toLowerCase())))
      : localDb.listSkills(projectId, true);
    const decisions = localDb.listDecisionRecords(projectId, true);
    return {
      items,
      skills,
      decisions,
      retrievalReason: query.triggerMatch ? `Trigger: ${query.triggerMatch.slice(0, 50)}` : 'Tag/category search',
      triggerMatch: query.triggerMatch ?? '',
      totalTokenEstimate: items.length * 150 + skills.length * 200 + decisions.length * 150,
    };
  });

  ipcMain.handle('memory:create', async (_event, item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> => {
    if (!localDb) throw new Error('Database not initialized');
    const lifecycle = new MemoryLifecycle(localDb);
    const { item: created, warnings } = lifecycle.writeManual(item);
    if (warnings.length > 0) console.warn('[main] Memory creation redaction warnings:', warnings);
    return created;
  });

  ipcMain.handle('memory:update', async (_event, id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> => {
    if (!localDb) throw new Error('Database not initialized');
    const existing = localDb.getMemoryItem(id);
    if (!existing) throw new Error('Memory item not found');
    const updated: MemoryItem = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    localDb.upsertMemoryItem(updated);
    return updated;
  });

  ipcMain.handle('memory:retire', async (_event, id: string, reason: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const lifecycle = new MemoryLifecycle(localDb);
    lifecycle.retire(id, reason);
    return { success: true };
  });

  ipcMain.handle('memory:reactivate', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.reactivateMemoryItem(id);
    return { success: true };
  });

  ipcMain.handle('memory:getStale', async (_event, projectId: string, daysThreshold?: number): Promise<MemoryItem[]> => {
    if (!localDb) return [];
    return localDb.getStaleMemories(projectId, daysThreshold);
  });

  ipcMain.handle('memory:getDashboard', async (_event, projectId: string) => {
    if (!localDb) return { totalMemories: 0, memoriesByCategory: {}, activeMemories: 0, retiredMemories: 0, staleMemories: 0, totalSkills: 0, activeSkills: 0, totalDecisions: 0, activeDecisions: 0, lastWriteAt: null, lastReviewAt: null };
    return localDb.getMemoryDashboard(projectId);
  });

  ipcMain.handle('memory:evictStale', async (_event, projectId: string, cutoffDate: string): Promise<number> => {
    if (!localDb) return 0;
    const lifecycle = new MemoryLifecycle(localDb);
    return lifecycle.evictStale(projectId, cutoffDate);
  });

  ipcMain.handle('memory:summarizeGroup', async (_event, projectId: string, category: MemoryCategory): Promise<MemoryItem> => {
    if (!localDb) throw new Error('Database not initialized');
    const items = localDb.listMemoryItems(projectId, { category, activeOnly: true });
    const now = new Date().toISOString();
    const summary: MemoryItem = {
      id: `mem-summary-${Date.now()}`,
      projectId,
      category,
      title: `Summary: ${category} (${items.length} items)`,
      scope: 'auto-summarized',
      tags: [...new Set(items.flatMap(i => i.tags))],
      description: `Auto-generated summary of ${items.length} ${category} items.`,
      freeFormNotes: null,
      examples: [],
      triggerConditions: [...new Set(items.flatMap(i => i.triggerConditions))],
      freshnessNotes: `Summarized from ${items.length} items on ${now}`,
      sourceMaterial: 'auto-summarize',
      owner: 'system',
      reviewer: null,
      lastReviewedAt: null,
      revisionHistory: [{ revisionNumber: 1, changedAt: now, changedBy: 'system', changeSummary: 'Auto-summarized', conversationId: null }],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    localDb.upsertMemoryItem(summary);
    // Retire originals
    for (const item of items) {
      localDb.retireMemoryItem(item.id);
    }
    return summary;
  });

  // ── Component 20: Skills IPC ──────────────────────────────────────────────

  ipcMain.handle('skills:list', async (_event, projectId: string, activeOnly?: boolean): Promise<Skill[]> => {
    if (!localDb) return [];
    return localDb.listSkills(projectId, activeOnly);
  });

  ipcMain.handle('skills:get', async (_event, id: string): Promise<Skill | null> => {
    if (!localDb) return null;
    return localDb.getSkill(id);
  });

  ipcMain.handle('skills:create', async (_event, skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Skill> => {
    if (!localDb) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const full: Skill = { ...skill, id: `skill-${Date.now()}`, version: 1, versionHistory: [{ version: 1, changedAt: now, changedBy: skill.owner ?? 'operator', changeSummary: 'Created' }], createdAt: now, updatedAt: now };
    localDb.upsertSkill(full);
    return full;
  });

  ipcMain.handle('skills:update', async (_event, id: string, updates: Partial<Skill>): Promise<Skill> => {
    if (!localDb) throw new Error('Database not initialized');
    const existing = localDb.getSkill(id);
    if (!existing) throw new Error('Skill not found');
    const updated: Skill = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    localDb.upsertSkill(updated);
    return updated;
  });

  ipcMain.handle('skills:invoke', async (_event, id: string): Promise<Skill> => {
    if (!localDb) throw new Error('Database not initialized');
    const result = localDb.invokeSkill(id);
    if (!result) throw new Error('Skill not found');
    return result;
  });

  ipcMain.handle('skills:retire', async (_event, id: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    const existing = localDb.getSkill(id);
    if (!existing) return { success: false };
    existing.isActive = false;
    existing.updatedAt = new Date().toISOString();
    localDb.upsertSkill(existing);
    return { success: true };
  });

  // ── Component 20: Decisions IPC ───────────────────────────────────────────

  ipcMain.handle('decisions:list', async (_event, projectId: string, activeOnly?: boolean): Promise<DecisionRecord[]> => {
    if (!localDb) return [];
    return localDb.listDecisionRecords(projectId, activeOnly);
  });

  ipcMain.handle('decisions:get', async (_event, id: string): Promise<DecisionRecord | null> => {
    if (!localDb) return null;
    return localDb.getDecisionRecord(id);
  });

  ipcMain.handle('decisions:getByNumber', async (_event, projectId: string, number: number): Promise<DecisionRecord | null> => {
    if (!localDb) return null;
    return localDb.getDecisionByNumber(projectId, number);
  });

  ipcMain.handle('decisions:create', async (_event, record: Omit<DecisionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DecisionRecord> => {
    if (!localDb) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const full: DecisionRecord = { ...record, id: `dec-${Date.now()}`, createdAt: now, updatedAt: now };
    localDb.upsertDecisionRecord(full);
    return full;
  });

  ipcMain.handle('decisions:update', async (_event, id: string, updates: Partial<DecisionRecord>): Promise<DecisionRecord> => {
    if (!localDb) throw new Error('Database not initialized');
    const existing = localDb.getDecisionRecord(id);
    if (!existing) throw new Error('Decision not found');
    const updated: DecisionRecord = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    localDb.upsertDecisionRecord(updated);
    return updated;
  });

  ipcMain.handle('decisions:supersede', async (_event, id: string, supersededBy: string): Promise<{ success: boolean }> => {
    if (!localDb) return { success: false };
    localDb.supersedeDecision(id, supersededBy);
    return { success: true };
  });

  ipcMain.handle('decisions:seedFromDocs', async (_event, projectId: string): Promise<{ decisions: number; memories: number }> => {
    if (!localDb) return { decisions: 0, memories: 0 };
    try {
      const decisions = seedDecisionsFromDocs(localDb, projectId);
      const memories = seedIdiosyncrasiesFromDocs(localDb, projectId);
      return { decisions, memories };
    } catch (err) {
      console.error('[main] Seed from docs failed:', err);
      return { decisions: 0, memories: 0 };
    }
  });
}
