/** McpScreen — MCP server management screen. */

import { useState, useEffect } from 'react';
import type { McpServerConfig, McpToolInfo } from '../../lib/shared-types';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#238636',
  degraded: '#d29922',
  unauthorized: '#f85149',
  misconfigured: '#f85149',
  offline: '#8b949e',
  unknown: '#484f58',
};

type McpScreenView = 'list' | 'add' | 'edit';

export default function McpScreen() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<McpScreenView>('list');
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error: string | null; tools: McpToolInfo[] } | null>(null);
  const [testing, setTesting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [formScope, setFormScope] = useState('');

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    try {
      const list = await window.vibeflow.mcp.list();
      setServers(list);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormCommand('');
    setFormArgs('');
    setFormTransport('stdio');
    setFormScope('');
    setEditingServer(null);
    setTestResult(null);
  }

  function startAdd() {
    resetForm();
    setView('add');
  }

  function startEdit(server: McpServerConfig) {
    setEditingServer(server);
    setFormName(server.name);
    setFormDescription(server.description);
    setFormCommand(server.command);
    setFormArgs(server.args.join(' '));
    setFormTransport(server.transport);
    setFormScope(server.scope);
    setView('edit');
  }

  async function handleSave() {
    if (!formName || !formCommand) return;

    const config = {
      name: formName,
      description: formDescription || `This server lets the system interact with ${formName}`,
      command: formCommand,
      args: formArgs.split(' ').filter(Boolean),
      transport: formTransport,
      scope: formScope || 'MCP server for external tool access',
      enabled: true,
      projectId: null,
      authMethod: null,
      env: {},
      lastHealthCheckAt: null,
    };

    try {
      if (view === 'edit' && editingServer) {
        await window.vibeflow.mcp.update(editingServer.id, config);
      } else {
        await window.vibeflow.mcp.add(config);
      }
      setView('list');
      resetForm();
      await loadServers();
    } catch (err) {
      console.error('Failed to save MCP server:', err);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this MCP server?')) return;
    try {
      await window.vibeflow.mcp.remove(id);
      await loadServers();
    } catch (err) {
      console.error('Failed to remove MCP server:', err);
    }
  }

  async function handleToggle(server: McpServerConfig) {
    try {
      if (server.enabled) {
        await window.vibeflow.mcp.disable(server.id);
      } else {
        await window.vibeflow.mcp.enable(server.id);
      }
      await loadServers();
    } catch (err) {
      console.error('Failed to toggle MCP server:', err);
    }
  }

  async function handleTest(id: string) {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.vibeflow.mcp.testConnection(id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: String(err), tools: [] });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#8b949e' }}>Loading MCP servers...</div>;
  }

  return (
    <div style={{ padding: 24, color: '#c9d1d9', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>🔌 MCP Servers</h2>
          <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: 13 }}>
            Manage MCP server connections. Each server lets the system talk to external tools and services.
          </p>
        </div>
        {view === 'list' && (
          <button onClick={startAdd} style={primaryBtnStyle}>
            + Add MCP Server
          </button>
        )}
      </div>

      {view === 'list' && (
        <>
          {servers.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#8b949e' }}>
              No MCP servers configured. Click "Add MCP Server" to get started.
            </div>
          )}
          {servers.map((server) => (
            <div
              key={server.id}
              style={{
                padding: 16,
                marginBottom: 8,
                backgroundColor: '#161b22',
                borderRadius: 6,
                border: `1px solid ${HEALTH_COLORS[server.health]}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: HEALTH_COLORS[server.health],
                  }}
                  title={server.health}
                />
                <strong style={{ fontSize: 15 }}>{server.name}</strong>
                <span style={{ fontSize: 11, color: '#8b949e' }}>
                  {server.transport} · {server.discoveredTools.length} tools
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: server.enabled ? '#238636' : '#8b949e' }}>
                  {server.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p style={{ margin: '8px 0', fontSize: 13, color: '#8b949e' }}>{server.description}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => handleTest(server.id)} disabled={testing} style={btnStyle}>
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={() => startEdit(server)} style={btnStyle}>Edit</button>
                <button onClick={() => handleToggle(server)} style={btnStyle}>
                  {server.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleRemove(server.id)} style={{ ...btnStyle, color: '#f85149' }}>Remove</button>
              </div>
            </div>
          ))}

          {/* Test result */}
          {testResult && (
            <div style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: '#161b22',
              borderRadius: 6,
              border: `1px solid ${testResult.success ? '#238636' : '#f85149'}`,
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: testResult.success ? '#238636' : '#f85149' }}>
                {testResult.success ? '✅ Connection Successful' : '❌ Connection Failed'}
              </h4>
              {testResult.error && <p style={{ margin: '4px 0', color: '#f85149', fontSize: 13 }}>{testResult.error}</p>}
              {testResult.tools.length > 0 && (
                <div>
                  <strong>Discovered Tools:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                    {testResult.tools.map((tool) => (
                      <li key={tool.name} style={{ fontSize: 12, color: '#8b949e' }}>
                        <strong>{tool.name}</strong> — {tool.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(view === 'add' || view === 'edit') && (
        <div style={{ maxWidth: 600 }}>
          <button onClick={() => { setView('list'); resetForm(); }} style={btnStyle}>
            ← Back to Servers
          </button>
          <h3 style={{ margin: '16px 0 8px 0' }}>{view === 'add' ? 'Add' : 'Edit'} MCP Server</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Name *</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., GitHub MCP Server"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description (plain English) *</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="This server lets the system talk to GitHub and do repository operations"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Command *</label>
            <input
              value={formCommand}
              onChange={(e) => setFormCommand(e.target.value)}
              placeholder="e.g., npx, python, node"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Arguments</label>
            <input
              value={formArgs}
              onChange={(e) => setFormArgs(e.target.value)}
              placeholder="e.g., -y @modelcontextprotocol/server-github"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Transport</label>
            <select value={formTransport} onChange={(e) => setFormTransport(e.target.value as 'stdio' | 'sse' | 'http')} style={inputStyle}>
              <option value="stdio">stdio (spawn process)</option>
              <option value="sse">SSE (Server-Sent Events)</option>
              <option value="http">HTTP (JSON-RPC)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Scope</label>
            <input
              value={formScope}
              onChange={(e) => setFormScope(e.target.value)}
              placeholder="e.g., GitHub repository operations"
              style={inputStyle}
            />
          </div>

          <button onClick={handleSave} style={primaryBtnStyle}>
            {view === 'add' ? 'Add Server' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 13,
  color: '#8b949e',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#0d1117',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  backgroundColor: '#21262d',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: '#238636',
  borderColor: '#238636',
  color: '#fff',
};
