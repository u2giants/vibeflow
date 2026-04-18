/**
 * Handoff IPC handlers: handoff:*
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { localDb, mainWindow } from './state';
import { getSupabaseClient } from './helpers';
import { generateHandoffDoc, generateHandoffPrompt } from '../../lib/handoff/handoff-generator';
import { HandoffStorage } from '../../lib/handoff/handoff-storage';
import type { GenerateHandoffArgs, HandoffResult } from '../../lib/shared-types';

export function registerHandoffHandlers(): void {
  ipcMain.handle('handoff:generate', async (_event, args: GenerateHandoffArgs): Promise<HandoffResult> => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

      // Read current idiosyncrasies.md
      const isPackaged = __dirname.includes('app.asar');
      const idiosyncrasiesPath = isPackaged
        ? path.join(process.resourcesPath, 'docs', 'idiosyncrasies.md')
        : path.join(__dirname, '../../../../docs/idiosyncrasies.md');
      let idiosyncrasies = '';
      try {
        idiosyncrasies = fs.readFileSync(idiosyncrasiesPath, 'utf-8');
      } catch {
        idiosyncrasies = 'Could not read idiosyncrasies.md';
      }

      // Get conversation messages
      const messages = localDb?.listMessages(args.conversationId) ?? [];

      // Get orchestrator mode
      const orchestratorMode = localDb?.listModes().find(m => m.slug === 'orchestrator');

      const timestamp = new Date().toISOString();
      const filename = `handoff-${timestamp.replace(/[:.]/g, '-').slice(0, 19)}.md`;

      // Component 22: Extended handoff context with mission/plan/evidence
      const missions = localDb?.listMissions(args.projectId) ?? [];
      const latestMission = missions.length > 0 ? missions[0] : null;
      const plan = latestMission ? localDb?.getPlan(latestMission.id) ?? null : null;
      const evidence = latestMission ? localDb?.listEvidenceItems(latestMission.id) ?? [] : [];

      const missionState = latestMission
        ? { id: latestMission.id, title: latestMission.title, status: latestMission.status }
        : undefined;

      const planState = plan
        ? {
            completedSteps: plan.steps.filter((s) => s.status === 'completed').length,
            totalSteps: plan.steps.length,
            nextStep: plan.steps.find((s) => s.status === 'pending')?.title ?? 'No pending steps',
          }
        : undefined;

      const evidenceSummary = evidence.length > 0
        ? {
            passed: evidence.filter((e) => e.status === 'pass').length,
            failed: evidence.filter((e) => e.status === 'fail').length,
            warnings: evidence.filter((e) => e.status === 'warning').length,
          }
        : undefined;

      const ctx = {
        conversationId: args.conversationId,
        projectId: args.projectId,
        projectName: args.projectName,
        messages,
        orchestratorMode: orchestratorMode!,
        currentGoal: args.currentGoal,
        whatWasTried: [],
        whatWorked: [],
        whatFailed: [],
        pendingBugs: args.pendingBugs,
        nextStep: args.nextStep,
        warnings: args.warnings,
        idiosyncrasies,
        timestamp,
        isSelfMaintenance: args.isSelfMaintenance ?? false,
        vibeFlowRepoPath: args.isSelfMaintenance ? path.resolve(__dirname, '../../../..') : undefined,
        missionState,
        planState,
        evidenceSummary,
        blockedItems: undefined,
      };

      const handoffDoc = generateHandoffDoc(ctx);
      const handoffPrompt = generateHandoffPrompt(ctx);

      // Save to Supabase Storage (optional — works without it)
      let storageUrl: string | null = null;
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data: { user } } = await client.auth.getUser();
          if (user) {
            const storage = new HandoffStorage(supabaseUrl, supabaseAnonKey);
            const result = await storage.saveHandoffDoc(user.id, args.projectId, filename, handoffDoc);
            storageUrl = result.url;
          }
        }
      } catch (err) {
        console.warn('[main] Handoff storage save failed (non-fatal):', err);
      }

      return { handoffDoc, handoffPrompt, filename, storageUrl, error: null };
    } catch (err) {
      return { handoffDoc: '', handoffPrompt: '', filename: '', storageUrl: null, error: String(err) };
    }
  });

  ipcMain.handle('handoff:getIdiosyncrasies', () => {
    const isPackaged = __dirname.includes('app.asar');
    const idiosyncrasiesPath = isPackaged
      ? path.join(process.resourcesPath, 'docs', 'idiosyncrasies.md')
      : path.join(__dirname, '../../../../docs/idiosyncrasies.md');
    try {
      return fs.readFileSync(idiosyncrasiesPath, 'utf-8');
    } catch {
      return 'Could not read idiosyncrasies.md';
    }
  });
}
