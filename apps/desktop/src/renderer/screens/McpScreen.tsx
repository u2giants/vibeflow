/** McpScreen — Manage MCP (Model Context Protocol) server connections. */

import { useState, useEffect, type CSSProperties } from 'react';
import type { McpConnection } from '../../lib/shared-types';

interface McpScreenProps {
  onBack: () => void;
  projectId?: string | null;
}

const emptyForm = {
  name: '',
  command: '',
  args: '',
  enabled: true,
  scope: 'project' as 'global' | 'project',
};

export default function McpScreen({ onBack, projectId = null }: McpScreenProps) {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    window.vibeflow.mcp.list(projectId).then(setConnections);
  }, [projectId]);

  const handleCreate = async () => {
    if (!form.name || !form.command) {
      setMsg('Name and command are required.');
      return;
    }
    setSaving(true);
    try {
      const argsArray = form.args
        .split(/\s+/)
        .map(a => a.trim())
        .filter(Boolean);
      const conn = await window.vibeflow.mcp.create({
        projectId,
        name: form.name,
        command: form.command,
        args: argsArray,
        enabled: form.enabled,
        scope: form.scope,
      });
      setConnections(prev => [...prev, conn]);
      setForm(emptyForm);
      setMsg('MCP server added ✅');
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg(`Error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (conn: McpConnection) => {
    await window.vibeflow.mcp.update(conn.id, { enabled: !conn.enabled });
    setConnections(prev =>
      prev.map(c => c.id === conn.id ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const handleDelete = async (id: string) => {
    await window.vibeflow.mcp.delete(id);
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 4,
    color: '#c9d1d9',
    fontSize: 13,
    boxSizing: 'border-box',
    marginTop: 2,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#161b22', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{ padding: '4px 8px', backgroundColor: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
        >
          ← Back
        </button>
        <h3 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>🔌 MCP Servers</h3>
      </div>

      <div style={{ padding: 16 }}>
        {/* Existing connections */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
          Configured ({connections.length})
        </h4>
        {connections.length === 0 ? (
          <div style={{ color: '#484f58', fontSize: 13, marginBottom: 16 }}>
            No MCP servers configured. Add one below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {connections.map(conn => (
              <div
                key={conn.id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#0d1117',
                  borderRadius: 6,
                  border: `1px solid ${conn.enabled ? '#238636' : '#30363d'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#58a6ff', fontWeight: 600, fontSize: 13 }}>{conn.name}</span>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 10,
                      backgroundColor: conn.enabled ? '#1a3a2a' : '#30363d',
                      color: conn.enabled ? '#3fb950' : '#8b949e',
                    }}>
                      {conn.enabled ? 'enabled' : 'disabled'}
                    </span>
                    <span style={{ fontSize: 10, color: '#484f58' }}>{conn.scope}</span>
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2, fontFamily: 'monospace' }}>
                    {conn.command} {conn.args.join(' ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleToggle(conn)}
                    style={{ padding: '3px 8px', backgroundColor: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    {conn.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    style={{ padding: '3px 8px', backgroundColor: 'transparent', color: '#f85149', border: '1px solid #f85149', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
          Add MCP Server
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8b949e' }}>Name</label>
            <input
              type="text"
              placeholder="My MCP Server"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b949e' }}>Command</label>
            <input
              type="text"
              placeholder="node, python, npx, etc."
              value={form.command}
              onChange={e => setForm(prev => ({ ...prev, command: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b949e' }}>Arguments (space-separated)</label>
            <input
              type="text"
              placeholder="server.js --port 3000"
              value={form.args}
              onChange={e => setForm(prev => ({ ...prev, args: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, color: '#8b949e' }}>Scope</label>
              <select
                value={form.scope}
                onChange={e => setForm(prev => ({ ...prev, scope: e.target.value as 'global' | 'project' }))}
                style={{ ...inputStyle, width: 'auto', padding: '5px 8px' }}
              >
                <option value="project">Project</option>
                <option value="global">Global</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
              <input
                type="checkbox"
                id="mcp-enabled"
                checked={form.enabled}
                onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <label htmlFor="mcp-enabled" style={{ fontSize: 13, color: '#c9d1d9' }}>Enabled</label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{ padding: '6px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
            >
              {saving ? 'Adding...' : 'Add Server'}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.includes('✅') ? '#3fb950' : '#f85149' }}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
