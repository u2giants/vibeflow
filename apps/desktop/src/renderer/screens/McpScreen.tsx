/** McpScreen — Manage MCP (Model Context Protocol) server connections. */

import { useState, useEffect } from 'react';
import type { McpConnection } from '../../lib/shared-types';
import { C, R } from '../theme';

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
  const [backHov, setBackHov] = useState(false);
  const [addHov, setAddHov] = useState(false);

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

  const labelStyle = {
    fontSize: 11,
    color: C.text3,
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'block' as const,
    marginBottom: 5,
  };

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    backgroundColor: C.bg5,
    color: C.text1,
    border: `1px solid ${C.border2}`,
    borderRadius: R.md,
    outline: 'none',
    fontSize: 13,
    boxSizing: 'border-box' as const,
    marginTop: 2,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.bg0, overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.bg1,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHov(true)}
          onMouseLeave={() => setBackHov(false)}
          style={{
            padding: '5px 12px',
            backgroundColor: backHov ? C.bg4 : 'transparent',
            color: C.text2,
            border: `1px solid ${C.border2}`,
            borderRadius: R.md,
            cursor: 'pointer',
            fontSize: 13,
            transition: 'background 0.15s',
          }}
        >
          ← Back
        </button>
        <h3 style={{ margin: 0, color: C.text1, fontSize: 16, fontWeight: 600 }}>MCP Servers</h3>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Existing connections */}
        <div style={{
          fontSize: 11, color: C.text3, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        }}>
          Configured ({connections.length})
        </div>

        {connections.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            backgroundColor: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            color: C.text3,
            fontSize: 13,
            marginBottom: 20,
          }}>
            No MCP servers configured. Add one below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {connections.map(conn => (
              <div
                key={conn.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: C.bg2,
                  borderRadius: R.xl,
                  border: `1px solid ${conn.enabled ? C.greenBd : C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: C.text1, fontWeight: 600, fontSize: 13 }}>{conn.name}</span>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 7px',
                      borderRadius: R.full,
                      backgroundColor: conn.enabled ? C.greenBg : C.bg4,
                      color: conn.enabled ? C.green : C.text3,
                      border: `1px solid ${conn.enabled ? C.greenBd : C.border}`,
                      fontWeight: 600,
                    }}>
                      {conn.enabled ? 'enabled' : 'disabled'}
                    </span>
                    <span style={{ fontSize: 10, color: C.text3 }}>{conn.scope}</span>
                  </div>
                  <div style={{ color: C.text3, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conn.command} {conn.args.join(' ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleToggle(conn)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'transparent',
                      color: C.text2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {conn.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'transparent',
                      color: C.red,
                      border: `1px solid ${C.redBd}`,
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <div style={{
          fontSize: 11, color: C.text3, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        }}>
          Add MCP Server
        </div>
        <div style={{
          padding: 16,
          backgroundColor: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          maxWidth: 520,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                placeholder="My MCP Server"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Command</label>
              <input
                type="text"
                placeholder="node, python, npx, etc."
                value={form.command}
                onChange={e => setForm(prev => ({ ...prev, command: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Arguments (space-separated)</label>
              <input
                type="text"
                placeholder="server.js --port 3000"
                value={form.args}
                onChange={e => setForm(prev => ({ ...prev, args: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Scope</label>
                <select
                  value={form.scope}
                  onChange={e => setForm(prev => ({ ...prev, scope: e.target.value as 'global' | 'project' }))}
                  style={{
                    padding: '7px 10px',
                    backgroundColor: C.bg5,
                    color: C.text1,
                    border: `1px solid ${C.border2}`,
                    borderRadius: R.md,
                    outline: 'none',
                    fontSize: 13,
                    cursor: 'pointer',
                    marginTop: 2,
                  }}
                >
                  <option value="project">Project</option>
                  <option value="global">Global</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                <input
                  type="checkbox"
                  id="mcp-enabled"
                  checked={form.enabled}
                  onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  style={{ accentColor: C.accent, width: 14, height: 14 }}
                />
                <label htmlFor="mcp-enabled" style={{ fontSize: 13, color: C.text2, cursor: 'pointer' }}>
                  Enabled
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              <button
                onClick={handleCreate}
                disabled={saving}
                onMouseEnter={() => setAddHov(true)}
                onMouseLeave={() => setAddHov(false)}
                style={{
                  padding: '7px 18px',
                  backgroundColor: saving ? C.bg4 : addHov ? C.accentHov : C.accent,
                  color: saving ? C.text3 : '#fff',
                  border: 'none',
                  borderRadius: R.md,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
              >
                {saving ? 'Adding...' : 'Add Server'}
              </button>
              {msg && (
                <span style={{ fontSize: 12, color: msg.includes('✅') ? C.green : C.red }}>
                  {msg}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
