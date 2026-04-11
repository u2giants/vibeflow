# @vibeflow/mcp-manager

## What This Package Does

This package manages MCP (Model Context Protocol) server connections. MCP allows AI Modes to use external tools and data sources through a standard protocol. This package handles connecting to MCP servers, listing available tools, and executing MCP tool calls.

## What It Exports

- `McpConnectionManager` — add, edit, remove, enable/disable MCP server connections
- `McpToolRegistry` — lists available tools from all connected MCP servers
- `McpToolExecutor` — executes a tool call on the appropriate MCP server
- `McpConnectionTester` — tests whether an MCP server is reachable and responding

## Who Depends On It

- `@vibeflow/core-orchestrator` (tool execution during Mode runs)
- `apps/desktop` renderer (MCP settings panel)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/storage`

## Notes

- MCP connection metadata (server URL, name, enabled/disabled) is synced to Supabase
- Sensitive connection credentials are stored in keytar, not synced
- MCP tool calls are logged in the execution stream with full provenance
- Each MCP connection can be enabled/disabled globally or per-project
