/** MCP Connection Tester — tests whether an MCP server is reachable. */

import type { McpServerConfig, McpToolInfo } from '../shared-types';
import { spawn, type ChildProcess } from 'child_process';

export class McpConnectionTester {
  /**
   * Test an MCP server connection.
   *
   * For stdio transport: spawns the command and checks if it starts successfully.
   * For SSE/HTTP transport: attempts an HTTP connection.
   *
   * NOTE: Full MCP tool discovery requires @modelcontextprotocol/sdk.
   * This implementation tests basic connectivity and returns placeholder tools.
   */
  async testConnection(config: McpServerConfig): Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }> {
    const startTime = Date.now();

    try {
      if (config.transport === 'stdio') {
        return this.testStdioConnection(config);
      } else if (config.transport === 'sse' || config.transport === 'http') {
        return this.testHttpConnection(config);
      }

      return { success: false, error: `Unsupported transport: ${config.transport}`, tools: [] };
    } catch (err) {
      return {
        success: false,
        error: `Connection test failed: ${err instanceof Error ? err.message : String(err)}`,
        tools: [],
      };
    }
  }

  private async testStdioConnection(config: McpServerConfig): Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }> {
    return new Promise((resolve) => {
      const env = { ...process.env, ...config.env };
      let proc: ChildProcess;

      try {
        proc = spawn(config.command, config.args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to spawn process: ${err instanceof Error ? err.message : String(err)}`,
          tools: [],
        });
        return;
      }

      let stderr = '';
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Give the process a moment to start, then check if it's still running
      setTimeout(() => {
        if (proc.killed || proc.exitCode !== null) {
          resolve({
            success: false,
            error: `Process exited with code ${proc.exitCode}: ${stderr.trim()}`,
            tools: [],
          });
        } else {
          // Process is running — connection successful
          proc.kill();
          resolve({
            success: true,
            error: null,
            // TODO: Discover actual tools via MCP protocol
            tools: this.getPlaceholderTools(config),
          });
        }
      }, 3000);

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Process error: ${err.message}`,
          tools: [],
        });
      });
    });
  }

  private async testHttpConnection(config: McpServerConfig): Promise<{ success: boolean; error: string | null; tools: McpToolInfo[] }> {
    // For SSE/HTTP, we'd connect via HTTP. For now, validate the config.
    const baseUrl = config.args[0] ?? '';
    if (!baseUrl) {
      return { success: false, error: 'No server URL provided in args', tools: [] };
    }

    try {
      const response = await fetch(baseUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (response.ok || response.status === 404) {
        // Server is reachable (404 is fine — means HTTP server is running)
        return {
          success: true,
          error: null,
          tools: this.getPlaceholderTools(config),
        };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, tools: [] };
    } catch (err) {
      return {
        success: false,
        error: `HTTP connection failed: ${err instanceof Error ? err.message : String(err)}`,
        tools: [],
      };
    }
  }

  /** Return placeholder tools until actual MCP protocol discovery is implemented. */
  private getPlaceholderTools(config: McpServerConfig): McpToolInfo[] {
    return [
      {
        name: 'placeholder_tool',
        description: `Placeholder tool — actual tool discovery from "${config.name}" requires @modelcontextprotocol/sdk integration`,
        parameterSchema: { type: 'object', properties: {} },
      },
    ];
  }
}
