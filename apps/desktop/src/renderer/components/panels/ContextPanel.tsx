/** ContextPanel — context pack dashboard for Component 11. */

import { useState, useEffect } from 'react';
import type { ContextDashboard, ContextItem, ContextWarning, DetectedStack, ImpactAnalysis } from '../../../lib/shared-types';

interface ContextPanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

export default function ContextPanel({ mission, projectId }: ContextPanelProps) {
  const [dashboard, setDashboard] = useState<ContextDashboard | null>(null);
  const [stack, setStack] = useState<DetectedStack | null>(null);
  const [indexStatus, setIndexStatus] = useState<{ indexed: boolean; fileCount: number; staleness: string; indexedAt: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Get index status
      const status = await window.vibeflow.projectIntelligence.getIndexStatus('');
      setIndexStatus(status);

      // Get detected stack
      const detectedStack = await window.vibeflow.projectIntelligence.getDetectedStack('');
      setStack(detectedStack);

      // Try to get context pack for current mission (if any)
      // For now, show index status and stack info
      setDashboard(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load context data');
    } finally {
      setLoading(false);
    }
  }

  async function handleReindex() {
    setLoading(true);
    try {
      await window.vibeflow.projectIntelligence.triggerIndex('', { fullReindex: true });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ color: '#484f58', fontSize: 13, padding: 16 }}>
        <p>Loading context data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#dc2626', fontSize: 13, padding: 16 }}>
        <p>Error: {error}</p>
        <button onClick={loadData} style={{ marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 13, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Context Dashboard</h3>
        <button
          onClick={handleReindex}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {indexStatus?.indexed ? 'Reindex' : 'Index Project'}
        </button>
      </div>

      {/* Index Status */}
      <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Project Index</h4>
        {indexStatus ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Status: </span>
              <span style={{
                color: indexStatus.staleness === 'fresh' ? '#16a34a' : indexStatus.staleness === 'stale' ? '#ca8a04' : '#6b7280',
                fontWeight: 500,
              }}>
                {indexStatus.staleness === 'fresh' ? '✅ Fresh' : indexStatus.staleness === 'stale' ? '⚠️ Stale' : '❓ Unknown'}
              </span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Files: </span>
              <span>{indexStatus.fileCount}</span>
            </div>
            {indexStatus.indexedAt && (
              <div>
                <span style={{ color: '#6b7280' }}>Indexed: </span>
                <span>{new Date(indexStatus.indexedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6b7280' }}>No index found. Click "Index Project" to scan.</p>
        )}
      </div>

      {/* Detected Stack */}
      {stack && (
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>
            Detected Stack
            <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>
              ({Math.round(stack.confidence * 100)}% confidence)
            </span>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stack.frontend.length > 0 && (
              <div>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Frontend</span>
                <div style={{ fontSize: 12 }}>{stack.frontend.join(', ')}</div>
              </div>
            )}
            {stack.backend.length > 0 && (
              <div>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Backend</span>
                <div style={{ fontSize: 12 }}>{stack.backend.join(', ')}</div>
              </div>
            )}
            {stack.database.length > 0 && (
              <div>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Database</span>
                <div style={{ fontSize: 12 }}>{stack.database.join(', ')}</div>
              </div>
            )}
            {stack.testFramework.length > 0 && (
              <div>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Testing</span>
                <div style={{ fontSize: 12 }}>{stack.testFramework.join(', ')}</div>
              </div>
            )}
            {stack.deployment.length > 0 && (
              <div>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Deployment</span>
                <div style={{ fontSize: 12 }}>{stack.deployment.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Pack Info */}
      {dashboard ? (
        <div style={{ padding: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Context Pack</h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div>
              <span style={{ color: '#6b7280' }}>Items: </span>
              <span>{dashboard.totalItems}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Token Usage: </span>
              <span>~{dashboard.tokenUsage}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Warnings: </span>
              <span style={{ color: dashboard.warningCount > 0 ? '#ca8a04' : '#16a34a' }}>
                {dashboard.warningCount}
              </span>
            </div>
          </div>

          {/* Token Budget Bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span>Token Budget</span>
              <span>{dashboard.tokenUsage} / {dashboard.tokenBudget}</span>
            </div>
            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (dashboard.tokenUsage / dashboard.tokenBudget) * 100)}%`,
                  background: dashboard.tokenUsage > dashboard.tokenBudget ? '#dc2626' : '#16a34a',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          {/* Warnings */}
          {dashboard.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h5 style={{ margin: '0 0 4px 0', fontSize: 12 }}>Warnings</h5>
              {dashboard.warnings.map((w: ContextWarning) => (
                <div
                  key={w.id}
                  style={{
                    padding: '4px 8px',
                    marginBottom: 4,
                    background: w.severity === 'critical' ? '#fef2f2' : w.severity === 'warning' ? '#fefce8' : '#f0f9ff',
                    borderLeft: `3px solid ${w.severity === 'critical' ? '#dc2626' : w.severity === 'warning' ? '#ca8a04' : '#3b82f6'}`,
                    fontSize: 12,
                  }}
                >
                  <div>{w.message}</div>
                  {w.suggestedAction && (
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{w.suggestedAction}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Context Items */}
          <div>
            <h5 style={{ margin: '0 0 4px 0', fontSize: 12 }}>Context Items</h5>
            {Object.entries(dashboard.itemsByCategory).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12 }}>
                <span>{type}</span>
                <span style={{ color: '#6b7280' }}>{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 12, color: '#6b7280' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12 }}>
            No active context pack. Context packs are assembled when a mission starts.
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            The project index and detected stack above show what context is available.
          </p>
        </div>
      )}
    </div>
  );
}
