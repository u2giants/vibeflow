/**
 * Conversations IPC handlers: conversations:list, conversations:create, conversations:getMessages, conversations:sendMessage
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import keytar from 'keytar';
import type { CreateConversationArgs, SendMessageArgs, Message, MissionStartArgs, Mission } from '../../lib/shared-types';
import { localDb, mainWindow, syncEngine, KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY, orchestrationEngine, changeEngine, verificationEngine } from './state';
import { getCurrentUserId } from './helpers';
import { runOrchestrator } from '../../lib/orchestrator/orchestrator';
import { MissionOrchestrator } from '../mission-orchestrator';

export function registerConversationsHandlers(): void {
  ipcMain.handle('conversations:list', async (_event, projectId: string) => {
    if (!localDb) return [];
    return localDb.listConversations(projectId);
  });

  ipcMain.handle('conversations:create', async (_event, args: CreateConversationArgs) => {
    if (!localDb) throw new Error('DB not initialized');
    const userId = await getCurrentUserId();
    const conv = {
      id: crypto.randomUUID(),
      projectId: args.projectId,
      userId,
      title: args.title,
      runState: 'idle' as const,
      ownerDeviceId: null,
      ownerDeviceName: null,
      leaseExpiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localDb.createConversation(conv);

    if (syncEngine) {
      syncEngine.pushConversation(conv).catch(err =>
        console.warn('[main] pushConversation failed (non-fatal):', err)
      );
    }

    return conv;
  });

  ipcMain.handle('conversations:getMessages', async (_event, conversationId: string) => {
    if (!localDb) return [];
    return localDb.listMessages(conversationId);
  });

  ipcMain.handle('conversations:sendMessage', async (event, args: SendMessageArgs) => {
    if (!localDb) throw new Error('DB not initialized');

    // ── Mission mode fork ───────────────────────────────────────────────
    // When missionMode is true, route through the mission lifecycle orchestrator
    // instead of the standard chat path.
    if (args.missionMode === true) {
      if (!orchestrationEngine || !changeEngine || !verificationEngine) {
        throw new Error('Mission services not initialized');
      }
      const webContents = mainWindow?.webContents ?? event.sender as any;
      const now = new Date().toISOString();
      const missionId = crypto.randomUUID();

      const missionStartArgs: MissionStartArgs = {
        projectId: (args as any).projectId ?? '',
        title: args.content.slice(0, 80),
        operatorRequest: args.content,
        conversationId: args.conversationId,
      };

      const mission: Mission = {
        id: missionId,
        projectId: missionStartArgs.projectId,
        title: missionStartArgs.title,
        operatorRequest: missionStartArgs.operatorRequest,
        clarifiedConstraints: [],
        status: 'draft',
        owner: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      localDb.insertMission(mission);

      localDb.upsertMissionLifecycleState({
        missionId,
        currentStep: 1,
        lifecycleStatus: 'idle',
        riskAssessment: null,
        workspaceRunId: null,
        verificationRunId: null,
        deployWorkflowId: null,
        watchSessionId: null,
        updatedAt: now,
      });

      const orchestrator = new MissionOrchestrator(
        localDb,
        orchestrationEngine,
        changeEngine,
        verificationEngine,
        null,
        webContents,
      );

      orchestrator.run(missionId).catch((err: unknown) => {
        console.error(`[conversations:sendMessage] Mission ${missionId} orchestrator error:`, err);
      });

      // Return early — push events notify the renderer of progress
      return { missionId } as any;
    }

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: args.conversationId,
      role: 'user',
      content: args.content,
      modeId: null,
      modelId: null,
      createdAt: new Date().toISOString(),
    };
    localDb.insertMessage(userMsg);

    if (syncEngine) {
      syncEngine.pushMessage(userMsg).catch(err =>
        console.warn('[main] pushMessage (user) failed (non-fatal):', err)
      );
    }

    // Get conversation history
    const history = localDb.listMessages(args.conversationId);

    // Resolve mode — use modeId from args if provided, otherwise default to orchestrator
    const allModes = localDb.listModes();
    const requestedMode = args.modeId
      ? allModes.find(m => m.id === args.modeId) ?? allModes.find(m => m.slug === 'orchestrator')
      : allModes.find(m => m.slug === 'orchestrator');
    if (!requestedMode) throw new Error('No mode found');

    // Get API key
    const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OPENROUTER_KEY);
    if (!apiKey) throw new Error('OpenRouter API key not set');

    const sendExecEvent = (text: string, type: 'info' | 'delegation' | 'specialist' | 'error') => {
      event.sender.send('conversations:executionEvent', { conversationId: args.conversationId, text, type });
    };

    sendExecEvent(`Running ${requestedMode.name}...`, 'info');

    // Stream orchestrator response
    let fullContent = '';
    await runOrchestrator(history, requestedMode, apiKey, {
      onToken: (token) => {
        event.sender.send('conversations:streamToken', { conversationId: args.conversationId, token });
      },
      onDone: (content) => {
        fullContent = content;
      },
      onError: (error) => {
        event.sender.send('conversations:streamError', { conversationId: args.conversationId, error });
      },
    });

    // Parse delegation tags: <delegate mode="slug">task description</delegate>
    const delegationPattern = /<delegate\s+mode="([^"]+)">([\s\S]*?)<\/delegate>/gi;
    const delegations: Array<{ modeSlug: string; task: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = delegationPattern.exec(fullContent)) !== null) {
      delegations.push({ modeSlug: match[1], task: match[2].trim() });
    }

    // If delegations found, run each specialist
    if (delegations.length > 0) {
      for (const delegation of delegations) {
        const specialistMode = allModes.find(m => m.slug === delegation.modeSlug);
        if (!specialistMode) {
          sendExecEvent(`Unknown mode: ${delegation.modeSlug}`, 'error');
          continue;
        }

        sendExecEvent(`Delegating to ${specialistMode.name}: ${delegation.task.slice(0, 80)}${delegation.task.length > 80 ? '...' : ''}`, 'delegation');

        // Build specialist history: include original conversation + orchestrator's delegation
        const specialistMessages: Message[] = [
          ...history,
          {
            id: crypto.randomUUID(),
            conversationId: args.conversationId,
            role: 'assistant',
            content: `I am delegating this task to you: ${delegation.task}`,
            modeId: requestedMode.id,
            modelId: requestedMode.modelId,
            createdAt: new Date().toISOString(),
          }
        ];

        let specialistContent = '';
        await runOrchestrator(specialistMessages, specialistMode, apiKey, {
          onToken: (token) => {
            // Stream specialist tokens too
            event.sender.send('conversations:streamToken', { conversationId: args.conversationId, token });
          },
          onDone: (content) => {
            specialistContent = content;
          },
          onError: (error) => {
            sendExecEvent(`${specialistMode.name} error: ${error}`, 'error');
          },
        });

        if (specialistContent) {
          sendExecEvent(`${specialistMode.name} completed`, 'specialist');
          // Save specialist response as assistant message
          const specialistMsg: Message = {
            id: crypto.randomUUID(),
            conversationId: args.conversationId,
            role: 'assistant',
            content: `**[${specialistMode.name}]** ${specialistContent}`,
            modeId: specialistMode.id,
            modelId: specialistMode.modelId,
            createdAt: new Date().toISOString(),
          };
          localDb.insertMessage(specialistMsg);
          if (syncEngine) {
            syncEngine.pushMessage(specialistMsg).catch(err =>
              console.warn('[main] pushMessage (specialist) failed (non-fatal):', err)
            );
          }
        }
      }
    }

    // Save orchestrator/primary assistant message
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: args.conversationId,
      role: 'assistant',
      content: fullContent,
      modeId: requestedMode.id,
      modelId: requestedMode.modelId,
      createdAt: new Date().toISOString(),
    };
    localDb.insertMessage(assistantMsg);

    if (syncEngine) {
      syncEngine.pushMessage(assistantMsg).catch(err =>
        console.warn('[main] pushMessage (assistant) failed (non-fatal):', err)
      );
    }

    event.sender.send('conversations:streamDone', { conversationId: args.conversationId });
    return assistantMsg;
  });
}
