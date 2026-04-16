/** EvidencePanel — real Component 15 evidence display with before/after comparison. */

import { useState, useEffect } from 'react';
import type { EvidenceRecord, BeforeAfterComparison } from '../../../lib/shared-types';

interface EvidencePanelProps {
  missionId?: string;
  workspaceRunId?: string;
  mission?: { id: string } | null;
  projectId?: string;
}

type EvidenceFilter = 'all' | 'runtime-log' | 'stack-trace' | 'screenshot' | 'network-trace' | 'console-log' | 'dom-snapshot' | 'before-after-comparison';

const FILTER_OPTIONS: { value: EvidenceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'runtime-log', label: 'Runtime Logs' },
  { value: 'stack-trace', label: 'Stack Traces' },
  { value: 'screenshot', label: 'Screenshots' },
  { value: 'network-trace', label: 'Network Traces' },
  { value: 'console-log', label: 'Console Logs' },
  { value: 'dom-snapshot', label: 'DOM Snapshots' },
  { value: 'before-after-comparison', label: 'Comparisons' },
];

const STATUS_COLORS: Record<string, string> = {
  pass: '#28a745',
  fail: '#dc3545',
  warning: '#ffc107',
  running: '#58a6ff',
  skipped: '#484f58',
};

export default function EvidencePanel({ missionId, workspaceRunId }: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [filter, setFilter] = useState<EvidenceFilter>('all');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [comparison, setComparison] = useState<BeforeAfterComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!missionId && !workspaceRunId) return;
    loadEvidence();
  }, [missionId, workspaceRunId]);

  async function loadEvidence() {
    setLoading(true);
    try {
      let records: EvidenceRecord[] = [];
      if (workspaceRunId && window.vibeflow?.evidence?.getForWorkspaceRun) {
        records = await window.vibeflow.evidence.getForWorkspaceRun(workspaceRunId);
      } else if (missionId && window.vibeflow?.evidence?.getForMission) {
        records = await window.vibeflow.evidence.getForMission(missionId);
      }
      setEvidence(records);
    } catch (err) {
      console.error('[EvidencePanel] Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvidence = filter === 'all'
    ? evidence
    : evidence.filter((e) => e.type === filter);

  const statusCounts = evidence.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) as Record<string, number>;

  async function handleCompare(beforeId: string, afterId: string) {
    if (!window.vibeflow?.evidence?.compareBeforeAfter) return;
    try {
      const result = await window.vibeflow.evidence.compareBeforeAfter(beforeId, afterId);
      setComparison(result);
    } catch (err) {
      console.error('[EvidencePanel] Comparison failed:', err);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header with status counts */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #30363d', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      {/* Filter bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #30363d', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: '2px 8px',
              backgroundColor: filter === opt.value ? '#58a6ff' : '#161b22',
              color: filter === opt.value ? '#0d1117' : '#8b949e',
              border: '1px solid #30363d',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Evidence list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ color: '#484f58', fontSize: 12, textAlign: 'center', padding: 16 }}>
            Loading evidence...
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div style={{ color: '#484f58', fontSize: 12, textAlign: 'center', padding: 16 }}>
            No evidence records yet. Evidence will appear during mission execution.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredEvidence.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedEvidence(item)}
                style={{
                  padding: 8,
                  backgroundColor: selectedEvidence?.id === item.id ? '#1a2332' : '#161b22',
                  borderRadius: 4,
                  border: `1px solid ${selectedEvidence?.id === item.id ? '#58a6ff' : '#30363d'}`,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#c9d1d9' }}>{item.title}</span>
                  <span style={{ color: STATUS_COLORS[item.status], fontSize: 11 }}>{item.status}</span>
                </div>
                <div style={{ color: '#484f58', fontSize: 10, marginTop: 4 }}>
                  {item.type} · {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedEvidence && (
        <div style={{ borderTop: '1px solid #30363d', padding: 12, maxHeight: '40%', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: '#c9d1d9', fontSize: 13 }}>{selectedEvidence.title}</span>
            <button
              onClick={() => setSelectedEvidence(null)}
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
              ✕
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
            Type: {selectedEvidence.type} · Status: <span style={{ color: STATUS_COLORS[selectedEvidence.status] }}>{selectedEvidence.status}</span>
          </div>
          {selectedEvidence.detail && (
            <pre style={{
              fontSize: 11,
              color: '#c9d1d9',
              backgroundColor: '#0d1117',
              padding: 8,
              borderRadius: 4,
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {selectedEvidence.detail}
            </pre>
          )}
          {selectedEvidence.artifactPath && (
            <div style={{ fontSize: 10, color: '#484f58', marginTop: 4 }}>
              Artifact: {selectedEvidence.artifactPath}
            </div>
          )}
          {/* Before/after comparison buttons for screenshot types */}
          {selectedEvidence.type === 'screenshot' && (
            <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
              <button
                onClick={() => {
                  const screenshots = evidence.filter((e) => e.type === 'screenshot');
                  if (screenshots.length >= 2) {
                    handleCompare(screenshots[0].id, screenshots[screenshots.length - 1].id);
                  }
                }}
                style={{
                  padding: '2px 8px',
                  backgroundColor: '#1a2332',
                  color: '#58a6ff',
                  border: '1px solid #30363d',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Compare with earliest
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comparison result */}
      {comparison && (
        <div style={{ borderTop: '1px solid #30363d', padding: 12, maxHeight: '30%', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: '#c9d1d9', fontSize: 13 }}>Before/After Comparison</span>
            <button
              onClick={() => setComparison(null)}
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
              ✕
            </button>
          </div>
          <pre style={{
            fontSize: 11,
            color: '#c9d1d9',
            backgroundColor: '#0d1117',
            padding: 8,
            borderRadius: 4,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {comparison.differenceSummary}
          </pre>
          {comparison.beforeArtifactPath && comparison.afterArtifactPath && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#484f58', marginBottom: 4 }}>Before</div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>{comparison.beforeArtifactPath}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#484f58', marginBottom: 4 }}>After</div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>{comparison.afterArtifactPath}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
