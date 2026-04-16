/** MCP Tool Executor — executes tool calls on MCP servers. */

import type { McpServerConfig, McpInvocationResult } from '../shared-types';

/**
 * Executes MCP tool calls.
 *
 * NOTE: Full MCP protocol implementation requires @modelcontextprotocol/sdk.
 * This is a placeholder that returns a structured error until the SDK is integrated.
 * The infrastructure (registry, config, health, UI) is fully functional.
 */
export class McpToolExecutor {
  /**
   * Execute a tool call on an MCP server.
   * Returns a structured result with success/error.
   */
  async executeTool(
    _server: McpServerConfig,
    _toolName: string,
    _parameters: Record<string, unknown>
  ): Promise<McpInvocationResult> {
    const startTime = Date.now();

    // TODO: Implement actual MCP tool execution via @modelcontextprotocol/sdk
    // This requires spawning the MCP server process (stdio transport) or
    // connecting via SSE/HTTP, then calling tools/call with the parameters.

    return {
      toolName: _toolName,
      success: false,
      result: null,
      error: 'MCP tool execution not yet implemented — @modelcontextprotocol/sdk integration pending',
      latencyMs: Date.now() - startTime,
    };
  }
}
