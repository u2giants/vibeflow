/** MCP Tool Registry — discovers and caches tools from connected MCP servers. */

import type { McpToolInfo } from '../shared-types';

export class McpToolRegistry {
  private toolsByServer: Map<string, McpToolInfo[]> = new Map();

  /** Set the discovered tools for a server. */
  setServerTools(serverId: string, tools: McpToolInfo[]): void {
    this.toolsByServer.set(serverId, tools);
  }

  /** Get the discovered tools for a server. */
  getServerTools(serverId: string): McpToolInfo[] {
    return this.toolsByServer.get(serverId) ?? [];
  }

  /** Get all discovered tools across all servers. */
  getAllTools(): Array<McpToolInfo & { serverId: string }> {
    const result: Array<McpToolInfo & { serverId: string }> = [];
    for (const [serverId, tools] of this.toolsByServer) {
      for (const tool of tools) {
        result.push({ ...tool, serverId });
      }
    }
    return result;
  }

  /** Clear tools for a server. */
  clearServerTools(serverId: string): void {
    this.toolsByServer.delete(serverId);
  }

  /** Clear all tools. */
  clearAll(): void {
    this.toolsByServer.clear();
  }
}
