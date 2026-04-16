/** MCP Health Monitor — periodic health checks for MCP servers. */

import type { McpServerConfig, CapabilityHealth } from '../shared-types';
import type { McpConnectionManager } from './mcp-connection-manager';
import { McpConnectionTester } from './mcp-connection-tester';

export class McpHealthMonitor {
  private connectionManager: McpConnectionManager;
  private tester: McpConnectionTester;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(connectionManager: McpConnectionManager, intervalMs: number = 60_000) {
    this.connectionManager = connectionManager;
    this.tester = new McpConnectionTester();
    this.intervalMs = intervalMs;
  }

  /** Start periodic health checks. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.runHealthCheck(), this.intervalMs);
    // Run immediately on start
    this.runHealthCheck();
  }

  /** Stop periodic health checks. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run a single health check cycle. */
  private async runHealthCheck(): Promise<void> {
    const servers = this.connectionManager.listServers();
    for (const server of servers) {
      if (!server.enabled) {
        this.connectionManager.updateServer(server.id, { health: 'offline' });
        continue;
      }

      try {
        const result = await this.tester.testConnection(server);
        const newHealth: CapabilityHealth = result.success ? 'healthy' : 'degraded';
        this.connectionManager.updateServer(server.id, {
          health: newHealth,
          lastHealthCheckAt: new Date().toISOString(),
          discoveredTools: result.tools,
        });
      } catch {
        this.connectionManager.updateServer(server.id, {
          health: 'degraded',
          lastHealthCheckAt: new Date().toISOString(),
        });
      }
    }
  }
}
