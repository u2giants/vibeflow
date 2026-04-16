/** EvidenceRail — right-side evidence and status rail, wired to live Component 15 data. */

import { useState, useEffect } from 'react';
import type { EvidenceItem, EvidenceRecord } from '../../lib/shared-types';

interface EvidenceRailProps {
  evidenceItems?: EvidenceItem[];
  toolCallCount?: number;
  riskAlertCount?: number;
  missionId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pass: '#28a745',
  fail: '#dc3545',
  warning: '#ffc107',
  running: '#58a6ff',
  skipped: '#484f58',
};

export default function EvidenceRail({
  evidenceItems = [],
  toolCallCount = 0,
  riskAlertCount = 0,
  missionId,
}: EvidenceRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [liveEvidence, setLiveEvidence] = useState<EvidenceRecord[]>([]);
  const [latestTimestamp, setLatestTimestamp] = useState<string | null>(null);

  // Load live evidence from Component 15 when missionId is provided
  useEffect(() => {
    if (!missionId || !window.vibeflow?.evidence?.getForMission) return;
    loadLiveEvidence();
  }, [missionId]);

  async function loadLiveEvidence() {
    try {
      const records = await window.vibeflow.evidence.getForMission(missionId!);
      setLiveEvidence(records);
      if (records.length > 0) {
        setLatestTimestamp(records[0].timestamp);
      }
    } catch (err) {
      console.error('[EvidenceRail] Failed to load live evidence:', err);
    }
  }

  // Merge legacy evidenceItems with live evidence records
  const allEvidence = [...evidenceItems.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    type: item.type,
    timestamp: item.timestamp,
  })), ...liveEvidence.map((record) => ({
    id: record.id,
    title: record.title,
    status: record.status,
    type: record.type,
    timestamp: record.timestamp,
  }))];

  // Count by status
  const statusCounts = allEvidence.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div
      style={{
        width: collapsed ? 36 : 280,
        backgroundColor: '#0d1117',
        borderLeft: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
            Evidence
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: '2px 6px',
            backgroundColor: 'transparent',
            color: '#8b949e',
            border: '1px solid #30363d',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '2px 8px',
                backgroundColor: '#1a2332',
                borderRadius: 4,
                fontSize: 11,
                color: '#58a6ff',
                border: '1px solid #30363d',
              }}
            >
              🔧 {toolCallCount} tool calls
            </span>
            {riskAlertCount > 0 && (
              <span
                style={{
                  padding: '2px 8px',
                  backgroundColor: '#dc354520',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#dc3545',
                  border: '1px solid #dc3545',
                }}
              >
                ⚠️ {riskAlertCount} risk{riskAlertCount > 1 ? 's' : ''}
              </span>
            )}
            {/* Evidence count by status */}
            {Object.entries(statusCounts).map(([status, count]) => (
              <span
                key={status}
                style={{
                  padding: '2px 8px',
                  backgroundColor: `${STATUS_COLORS[status]}20`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: STATUS_COLORS[status],
                  border: `1px solid ${STATUS_COLORS[status]}`,
                }}
              >
                {status}: {count}
              </span>
            ))}
          </div>

          {/* Latest evidence timestamp */}
          {latestTimestamp && (
            <div style={{ fontSize: 10, color: '#484f58', marginBottom: 12 }}>
              Latest: {new Date(latestTimestamp).toLocaleString()}
            </div>
          )}

          {/* Evidence items */}
          {allEvidence.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allEvidence.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 8,
                    backgroundColor: '#161b22',
                    borderRadius: 4,
                    border: '1px solid #30363d',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: STATUS_COLORS[item.status] }}>
                      {item.status}
                    </span>
                    <span style={{ fontSize: 10, color: '#484f58' }}>
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                color: '#484f58',
                fontSize: 12,
              }}
            >
              No evidence yet. Evidence will appear here during mission execution.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
