/**
 * Capabilities IPC handlers: capabilities:*, mcp:*, sshTargets:*
 */

import { ipcMain } from 'electron';
import type { CreateSshTargetArgs, CreateMcpConnectionArgs } from '../../lib/shared-types';
import { capabilityRegistry, mcpConnectionManager, mcpToolExecutor, localDb } from './state';
import { getCurrentUserId } from './helpers';

export function registerCapabilitiesHandlers(): void {
  // ── Capabilities IPC Handlers ─────────────────────────────────────

  ipcMain.handle('capabilities:list', () => {
    return capabilityRegistry.list();
  });

  ipcMain.handle('capabilities:get', (_event, id: string) => {
    return capabilityRegistry.get(id);
  });

  ipcMain.handle('capabilities:getHealth', () => {
    return capabilityRegistry.getHealth();
  });

  ipcMain.handle('capabilities:getInvocationLog', (_event, capabilityId: string, limit: number = 50) => {
    return capabilityRegistry.getInvocationLog(capabilityId, limit);
  });

  // ── MCP IPC Handlers ──────────────────────────────────────────────

  ipcMain.handle('mcp:list', () => {
    return mcpConnectionManager.listServers();
  });

  ipcMain.handle('mcp:add', (_event, config) => {
    return mcpConnectionManager.addServer(config);
  });

  ipcMain.handle('mcp:update', (_event, id: string, updates) => {
    const result = mcpConnectionManager.updateServer(id, updates);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:remove', (_event, id: string) => {
    const success = mcpConnectionManager.removeServer(id);
    return { success };
  });

  ipcMain.handle('mcp:enable', (_event, id: string) => {
    const result = mcpConnectionManager.enableServer(id);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:disable', (_event, id: string) => {
    const result = mcpConnectionManager.disableServer(id);
    if (!result) throw new Error(`MCP server ${id} not found`);
    return result;
  });

  ipcMain.handle('mcp:testConnection', async (_event, id: string) => {
    return mcpConnectionManager.testConnection(id);
  });

  ipcMain.handle('mcp:executeTool', async (_event, serverId: string, toolName: string, parameters: Record<string, unknown>) => {
    const server = mcpConnectionManager.getServer(serverId);
    if (!server) throw new Error(`MCP server ${serverId} not found`);
    return mcpToolExecutor.executeTool(server, toolName, parameters);
  });

  // ── SSH Targets IPC Handlers (from remote merge) ──────────────────

  ipcMain.handle('sshTargets:list', async (_event, projectId: string | null) => {
    if (!localDb) return [];
    return localDb.listSshTargets(projectId);
  });

  ipcMain.handle('sshTargets:save', async (_event, args: CreateSshTargetArgs) => {
    if (!localDb) throw new Error('DB not initialized');
    const userId = await getCurrentUserId();
    const target = {
      id: crypto.randomUUID(),
      userId,
      projectId: args.projectId,
      name: args.name,
      hostname: args.hostname,
      username: args.username,
      port: args.port,
      identityFile: args.identityFile,
      createdAt: new Date().toISOString(),
    };
    localDb.insertSshTarget(target);
    return target;
  });

  ipcMain.handle('sshTargets:delete', async (_event, id: string) => {
    if (!localDb) throw new Error('DB not initialized');
    localDb.deleteSshTarget(id);
    return { success: true };
  });
}
