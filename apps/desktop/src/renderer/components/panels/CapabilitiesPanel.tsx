/** CapabilitiesPanel — real panel showing capability registry, health, and MCP connections. */

import { useState, useEffect } from 'react';
import type { Capability, CapabilityHealth, McpServerConfig } from '../../../lib/shared-types';

const HEALTH_COLORS: Record<CapabilityHealth, string> = {
  healthy: '#238636',
  degraded: '#d29922',
  unauthorized: '#f85149',
  misconfigured: '#f85149',
  offline: '#8b949e',
  unknown: '#484f58',
};

const HEALTH_LABELS: Record<CapabilityHealth, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unauthorized: 'Unauthorized',
  misconfigured: 'Misconfigured',
  offline: 'Offline',
  unknown: 'Unknown',
};

const CLASS_ICONS: Record<string, string> = {
  filesystem: '📁',
  git: '🔀',
  terminal: '💻',
  browser: '🌐',
  mcp: '🔌',
  'direct-api': '🔗',
  ssh: '🔐',
  secrets: '🔑',
  'logs-metrics': '📊',
  'build-package': '📦',
};

interface CapabilitiesPanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

export default function CapabilitiesPanel({ mission, projectId }: CapabilitiesPanelProps) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [caps, servers] = await Promise.all([
        window.vibeflow.capabilities.list(),
        window.vibeflow.mcp.list(),
      ]);
      setCapabilities(caps);
      setMcpServers(servers);
    } catch (err) {
      console.error('Failed to load capabilities:', err);
    } finally {
      setLoading(false);
    }
  }

  const classes = ['all', ...Array.from(new Set(capabilities.map((c) => c.class)))];
  const healths = ['all', 'healthy', 'degraded', 'unauthorized', 'misconfigured', 'offline', 'unknown'];

  const filtered = capabilities.filter((c) => {
    if (filterClass !== 'all' && c.class !== filterClass) return false;
    if (filterHealth !== 'all' && c.health !== filterHealth) return false;
    return true;
  });

  const healthyCount = capabilities.filter((c) => c.health === 'healthy').length;
  const unhealthyCount = capabilities.filter((c) => c.health !== 'healthy' && c.health !== 'unknown').length;

  if (loading) {
    return <div style={{ padding: 16, color: '#8b949e' }}>Loading capabilities...</div>;
  }

  return (
    <div style={{ padding: 12, fontSize: 13, color: '#c9d1d9', overflow: 'auto', height: '100%' }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #30363d' }}>
        <span>🔌 <strong>{capabilities.length}</strong> capabilities</span>
        <span style={{ color: '#238636' }}>✅ {healthyCount} healthy</span>
        {unhealthyCount > 0 && <span style={{ color: '#f85149' }}>⚠️ {unhealthyCount} issues</span>}
        <span>🔌 {mcpServers.length} MCP servers</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          style={selectStyle}
        >
          {classes.map((cls) => (
            <option key={cls} value={cls}>
              {cls === 'all' ? 'All Classes' : `${CLASS_ICONS[cls] ?? ''} ${cls}`}
            </option>
          ))}
        </select>
        <select
          value={filterHealth}
          onChange={(e) => setFilterHealth(e.target.value)}
          style={selectStyle}
        >
          {healths.map((h) => (
            <option key={h} value={h}>
              {h === 'all' ? 'All Health' : HEALTH_LABELS[h as CapabilityHealth]}
            </option>
          ))}
        </select>
        <button
          onClick={() => window.vibeflow.mcp.list().then(setMcpServers)}
          style={{ ...btnStyle, marginLeft: 'auto' }}
        >
          Refresh
        </button>
      </div>

      {/* MCP Servers section */}
      {mcpServers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#58a6ff' }}>🔌 MCP Servers</h4>
          {mcpServers.map((server) => (
            <div
              key={server.id}
              style={{
                padding: 8,
                marginBottom: 4,
                backgroundColor: '#161b22',
                borderRadius: 4,
                border: `1px solid ${HEALTH_COLORS[server.health]}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HealthBadge health={server.health} />
                <strong>{server.name}</strong>
                <span style={{ color: '#8b949e', fontSize: 11 }}>
                  {server.discoveredTools.length} tools
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: server.enabled ? '#238636' : '#8b949e' }}>
                  {server.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div style={{ color: '#8b949e', fontSize: 11, marginTop: 4 }}>{server.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Capabilities list */}
      <h4 style={{ margin: '0 0 8px 0', color: '#58a6ff' }}>⚡ Capabilities</h4>
      {filtered.length === 0 && (
        <div style={{ color: '#8b949e', padding: 16, textAlign: 'center' }}>
          No capabilities match the current filters.
        </div>
      )}
      {filtered.map((cap) => (
        <div
          key={cap.id}
          style={{
            padding: 8,
            marginBottom: 4,
            backgroundColor: '#161b22',
            borderRadius: 4,
            border: `1px solid ${HEALTH_COLORS[cap.health]}`,
            cursor: 'pointer',
          }}
          onClick={() => setExpandedId(expandedId === cap.id ? null : cap.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HealthBadge health={cap.health} />
            <span>{CLASS_ICONS[cap.class] ?? '⚡'}</span>
            <strong>{cap.name}</strong>
            <span style={{ color: '#8b949e', fontSize: 11 }}>{cap.class}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: cap.enabled ? '#238636' : '#8b949e' }}>
              {cap.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div style={{ color: '#8b949e', fontSize: 11, marginTop: 4 }}>{cap.description}</div>

          {/* Expanded detail */}
          {expandedId === cap.id && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #30363d' }}>
              <div style={{ marginBottom: 4 }}><strong>Scope:</strong> {cap.scope}</div>
              <div style={{ marginBottom: 4 }}><strong>Auth:</strong> {cap.authMethod ?? 'None'}</div>
              <div style={{ marginBottom: 4 }}><strong>Owner:</strong> {cap.owner}</div>
              {cap.lastSuccessAt && (
                <div style={{ marginBottom: 4, color: '#238636' }}>
                  ✅ Last success: {new Date(cap.lastSuccessAt).toLocaleString()}
                </div>
              )}
              {cap.lastFailureAt && (
                <div style={{ marginBottom: 4, color: '#f85149' }}>
                  ❌ Last failure: {new Date(cap.lastFailureAt).toLocaleString()} — {cap.lastFailureReason}
                </div>
              )}
              {cap.actions.length > 0 && (
                <div>
                  <strong>Actions ({cap.actions.length}):</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                    {cap.actions.map((action) => (
                      <li key={action.id} style={{ fontSize: 11, color: '#8b949e' }}>
                        {action.name} — {action.description}
                        <span style={{ marginLeft: 8, color: getPermissionColor(action.permission) }}>
                          {action.permission}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HealthBadge({ health }: { health: CapabilityHealth }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: HEALTH_COLORS[health],
      }}
      title={HEALTH_LABELS[health]}
    />
  );
}

function getPermissionColor(permission: string): string {
  if (permission === 'read-only') return '#238636';
  if (permission === 'local-write' || permission === 'repository-mutation') return '#d29922';
  return '#f85149';
}

const selectStyle: React.CSSProperties = {
  backgroundColor: '#161b22',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
};

const btnStyle: React.CSSProperties = {
  backgroundColor: '#21262d',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
