/** MCP Connection Manager — manages MCP server lifecycle. */

import type { McpServerConfig, McpToolInfo, CapabilityHealth } from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpConnectionTester } from './mcp-connection-tester';

export type McpHealthChangeCallback = (serverId: string, health: CapabilityHealth) => void;

export class McpConnectionManager {
  private servers: Map<string, McpServerConfig> = new Map();
  public db: LocalDb | null = null;
  private toolRegistry: McpToolRegistry;
  private connectionTester: McpConnectionTester;
  private healthListeners: McpHealthChangeCallback[] = [];

  constructor(db?: LocalDb) {
    this.db = db ?? null;
    this.toolRegistry = new McpToolRegistry();
    this.connectionTester = new McpConnectionTester();
  }

  /** Load all MCP server configs from the database. */
  loadFromDb(): void {
    if (!this.db) return;
    const configs = this.db.listMcpServers();
    this.servers.clear();
    for (const config of configs) {
      this.servers.set(config.id, config);
    }
  }

  /** Add a new MCP server. */
  addServer(config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'health' | 'discoveredTools'>): McpServerConfig {
    const now = new Date().toISOString();
    const server: McpServerConfig = {
      ...config,
      id: crypto.randomUUID(),
      health: 'unknown',
      discoveredTools: [],
      createdAt: now,
      updatedAt: now,
    };
    this.servers.set(server.id, server);
    this.persistServer(server);
    return server;
  }

  /** Update an existing MCP server config. */
  updateServer(id: string, updates: Partial<McpServerConfig>): McpServerConfig | null {
    const existing = this.servers.get(id);
    if (!existing) return null;
    const updated: McpServerConfig = {
      ...existing,
      ...updates,
      id, // prevent id change
      updatedAt: new Date().toISOString(),
    };
    this.servers.set(id, updated);
    this.persistServer(updated);
    return updated;
  }

  /** Remove an MCP server. */
  removeServer(id: string): boolean {
    const existed = this.servers.delete(id);
    if (existed && this.db) {
      this.db.deleteMcpServer(id);
    }
    this.toolRegistry.clearServerTools(id);
    return existed;
  }

  /** Enable an MCP server. */
  enableServer(id: string): McpServerConfig | null {
    return this.updateServer(id, { enabled: true });
  }

  /** Disable an MCP server. */
  disableServer(id: string): McpServerConfig | null {
    return this.updateServer(id, { enabled: false, health: 'offline' });
  }

  /** Test connection to an MCP server and discover tools. */
  async testConnection(id: string): Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }> {
    const server = this.servers.get(id);
    if (!server) {
      return { success: false, error: 'Server not found', tools: [] };
    }

    const result = await this.connectionTester.testConnection(server);

    if (result.success) {
      // Cache discovered tools
      this.toolRegistry.setServerTools(id, result.tools);
      this.updateServer(id, {
        health: 'healthy',
        lastHealthCheckAt: new Date().toISOString(),
        discoveredTools: result.tools,
      });
      this.emitHealthChange(id, 'healthy');
    } else {
      this.updateServer(id, {
        health: 'misconfigured',
        lastHealthCheckAt: new Date().toISOString(),
      });
      this.emitHealthChange(id, 'misconfigured');
    }

    return result;
  }

  /** Get all registered MCP servers. */
  listServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  /** Get a single MCP server by id. */
  getServer(id: string): McpServerConfig | null {
    return this.servers.get(id) ?? null;
  }

  /** Get the tool registry. */
  getToolRegistry(): McpToolRegistry {
    return this.toolRegistry;
  }

  /** Subscribe to health change events. */
  onHealthChange(callback: McpHealthChangeCallback): void {
    this.healthListeners.push(callback);
  }

  /** Unsubscribe from health change events. */
  offHealthChange(callback: McpHealthChangeCallback): void {
    this.healthListeners = this.healthListeners.filter((l) => l !== callback);
  }

  private emitHealthChange(serverId: string, health: CapabilityHealth): void {
    for (const listener of this.healthListeners) {
      try {
        listener(serverId, health);
      } catch (err) {
        console.error('[McpConnectionManager] Health change listener error:', err);
      }
    }
  }

  private persistServer(config: McpServerConfig): void {
    if (!this.db) return;
    try {
      this.db.upsertMcpServer(config);
    } catch (err) {
      console.error('[McpConnectionManager] Failed to persist server:', err);
    }
  }
}
