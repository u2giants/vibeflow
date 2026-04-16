/**
 * AuditPanel — Component 19: Audit history, checkpoints, and rollback UI.
 *
 * Shows recent audit records with risk class badges, checkpoint list,
 * and rollback options.
 */

import { useState, useEffect, useCallback } from 'react';
import type { AuditRecord, Checkpoint, RiskClass, RollbackPlan } from '../../../lib/shared-types';

type ViewMode = 'history' | 'detail' | 'checkpoints' | 'rollback-preview';

const RISK_CLASS_COLORS: Record<RiskClass, string> = {
  'informational': '#6b7280',
  'low': '#28a745',
  'medium': '#ffc107',
  'high': '#fd7e14',
  'destructive': '#dc3545',
  'privileged-production': '#e83e8c',
};

const RISK_CLASS_LABELS: Record<RiskClass, string> = {
  'informational': 'Info',
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'destructive': 'Destructive',
  'privileged-production': 'Priv-Prod',
};

const RESULT_COLORS: Record<string, string> = {
  'approved': '#28a745',
  'rejected': '#dc3545',
  'escalated': '#ffc107',
  'rolled-back': '#17a2b8',
};

interface AuditPanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

export default function AuditPanel({ mission, projectId }: AuditPanelProps) {
  const [view, setView] = useState<ViewMode>('history');
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [rollbackPreview, setRollbackPreview] = useState<{ plan: RollbackPlan; warning: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load audit history
  const loadAuditHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await window.vibeflow.audit.getHistory({ limit: 50 });
      setAuditRecords(records);
    } catch (err) {
      setError(`Failed to load audit history: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load checkpoints
  const loadCheckpoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get checkpoints from all workspace runs (no mission filter for now)
      const cps = await window.vibeflow.changeEngine.listCheckpoints('');
      setCheckpoints(cps);
    } catch (err) {
      // Fallback: try audit-linked checkpoints
      try {
        const cps = await window.vibeflow.audit.getCheckpoints('');
        setCheckpoints(cps);
      } catch {
        setCheckpoints([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load rollback preview
  const loadRollbackPreview = useCallback(async (checkpointId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.vibeflow.rollback.preview(checkpointId);
      if (result.rollbackPlan) {
        setRollbackPreview({ plan: result.rollbackPlan, warning: result.warning });
        setView('rollback-preview');
      } else {
        setError(result.warning ?? 'Could not generate rollback preview');
      }
    } catch (err) {
      setError(`Failed to load rollback preview: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute rollback
  const executeRollback = useCallback(async (checkpointId: string) => {
    if (!confirm('Are you sure you want to rollback to this checkpoint? This action may be irreversible.')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.vibeflow.rollback.initiate(checkpointId);
      if (result.success) {
        alert('Rollback completed successfully.');
        setView('checkpoints');
        loadAuditHistory(); // Refresh audit history
      } else {
        setError(`Rollback failed: ${result.error}`);
      }
    } catch (err) {
      setError(`Rollback failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [loadAuditHistory]);

  useEffect(() => {
    loadAuditHistory();
  }, [loadAuditHistory]);

  // ── Render: Audit History Table ────────────────────────────────────

  const renderHistory = () => (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#c9d1d9' }}>
        Audit History ({auditRecords.length} records)
      </h3>
      {auditRecords.length === 0 ? (
        <p style={{ color: '#484f58', fontSize: 13 }}>No audit records yet.</p>
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8b949e' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8b949e' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8b949e' }}>Risk</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8b949e' }}>Result</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8b949e' }}>By</th>
              </tr>
            </thead>
            <tbody>
              {auditRecords.map((record) => (
                <tr
                  key={record.id}
                  style={{ borderBottom: '1px solid #21262d', cursor: 'pointer' }}
                  onClick={() => { setSelectedRecord(record); setView('detail'); }}
                >
                  <td style={{ padding: '4px 8px', color: '#8b949e' }}>
                    {new Date(record.initiatedAt).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#c9d1d9' }}>
                    {record.actionType}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        backgroundColor: RISK_CLASS_COLORS[record.riskAssessment.riskClass] + '33',
                        color: RISK_CLASS_COLORS[record.riskAssessment.riskClass],
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {RISK_CLASS_LABELS[record.riskAssessment.riskClass]}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        backgroundColor: RESULT_COLORS[record.result] + '33',
                        color: RESULT_COLORS[record.result],
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {record.result}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px', color: '#8b949e' }}>
                    {record.initiatedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Render: Detail View ────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedRecord) return null;
    const r = selectedRecord;
    return (
      <div>
        <button
          onClick={() => setView('history')}
          style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 12 }}
        >
          ← Back to History
        </button>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#c9d1d9' }}>Audit Record Detail</h3>

        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Action Type:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>{r.actionType}</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Risk Class:</strong>
          <span
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: RISK_CLASS_COLORS[r.riskAssessment.riskClass] + '33',
              color: RISK_CLASS_COLORS[r.riskAssessment.riskClass],
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {RISK_CLASS_LABELS[r.riskAssessment.riskClass]} (Score: {r.riskAssessment.overallScore}/100)
          </span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Reversibility:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9', textTransform: 'capitalize' }}>
            {r.riskAssessment.reversibility}
          </span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Evidence:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9', textTransform: 'capitalize' }}>
            {r.riskAssessment.evidenceCompleteness}
          </span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Result:</strong>
          <span
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: RESULT_COLORS[r.result] + '33',
              color: RESULT_COLORS[r.result],
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {r.result}
          </span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Initiated By:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>{r.initiatedBy}</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Time:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>
            {new Date(r.initiatedAt).toLocaleString()}
          </span>
        </div>

        {/* Risk Dimensions */}
        {r.riskAssessment.dimensions.length > 0 && (
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <strong style={{ color: '#8b949e', fontSize: 12 }}>Risk Dimensions:</strong>
            <div style={{ marginTop: 4 }}>
              {r.riskAssessment.dimensions.map((dim, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c9d1d9', marginBottom: 2 }}>
                  • {dim.dimension}: {dim.score}/{dim.maxScore} — {dim.explanation}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval Chain */}
        {r.approvalChain.length > 0 && (
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <strong style={{ color: '#8b949e', fontSize: 12 }}>Approval Chain:</strong>
            <div style={{ marginTop: 4 }}>
              {r.approvalChain.map((entry, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c9d1d9', marginBottom: 2 }}>
                  • Tier {entry.tier}: {entry.decision} — {entry.reason}
                  {entry.reviewerModel ? ` (${entry.reviewerModel})` : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checkpoint Link */}
        {r.checkpointId && (
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <strong style={{ color: '#8b949e', fontSize: 12 }}>Checkpoint:</strong>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#58a6ff' }}>{r.checkpointId}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Checkpoints List ───────────────────────────────────────

  const renderCheckpoints = () => (
    <div>
      <button
        onClick={() => setView('history')}
        style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 12 }}
      >
        ← Back to History
      </button>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#c9d1d9' }}>
        Checkpoints ({checkpoints.length})
      </h3>
      {checkpoints.length === 0 ? (
        <p style={{ color: '#484f58', fontSize: 13 }}>No checkpoints available.</p>
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              style={{
                padding: 8,
                marginBottom: 8,
                border: '1px solid #30363d',
                borderRadius: 6,
                backgroundColor: '#161b22',
              }}
            >
              <div style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 600 }}>{cp.label}</div>
              <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
                Git Ref: {cp.gitRef} • {new Date(cp.createdAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setSelectedCheckpoint(cp); loadRollbackPreview(cp.id); }}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#1f6feb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Preview Rollback
                </button>
                <button
                  onClick={() => executeRollback(cp.id)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#da3633',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Execute Rollback
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render: Rollback Preview ───────────────────────────────────────

  const renderRollbackPreview = () => {
    if (!rollbackPreview || !selectedCheckpoint) return null;
    const { plan, warning } = rollbackPreview;
    return (
      <div>
        <button
          onClick={() => setView('checkpoints')}
          style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 12 }}
        >
          ← Back to Checkpoints
        </button>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#c9d1d9' }}>
          Rollback Preview: {selectedCheckpoint.label}
        </h3>

        {warning && (
          <div style={{ padding: 8, backgroundColor: '#ffc10722', border: '1px solid #ffc107', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#ffc107' }}>
            ⚠️ {warning}
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Target State:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>{plan.targetState}</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Environment:</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>{plan.environment}</span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: '#28a745', fontSize: 12 }}>Will be reversed:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12, color: '#c9d1d9' }}>
            {plan.reversibleChanges.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>

        {plan.irreversibleChanges.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#dc3545', fontSize: 12 }}>Cannot be reversed:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12, color: '#c9d1d9' }}>
              {plan.irreversibleChanges.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {plan.dataCaveats.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#ffc107', fontSize: 12 }}>Data Caveats:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12, color: '#c9d1d9' }}>
              {plan.dataCaveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {plan.estimatedDowntime && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#8b949e', fontSize: 12 }}>Estimated Downtime:</strong>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#c9d1d9' }}>{plan.estimatedDowntime}</span>
          </div>
        )}

        <button
          onClick={() => executeRollback(selectedCheckpoint.id)}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            backgroundColor: '#da3633',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Execute Rollback
        </button>
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────

  return (
    <div style={{ color: '#c9d1d9', fontSize: 13 }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid #30363d', paddingBottom: 8 }}>
        <button
          onClick={() => { setView('history'); loadAuditHistory(); }}
          style={{
            padding: '4px 12px',
            backgroundColor: view === 'history' ? '#1f6feb' : 'transparent',
            color: view === 'history' ? '#fff' : '#8b949e',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Audit History
        </button>
        <button
          onClick={() => { setView('checkpoints'); loadCheckpoints(); }}
          style={{
            padding: '4px 12px',
            backgroundColor: view === 'checkpoints' || view === 'rollback-preview' ? '#1f6feb' : 'transparent',
            color: view === 'checkpoints' || view === 'rollback-preview' ? '#fff' : '#8b949e',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Checkpoints & Rollback
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <p style={{ color: '#8b949e', fontSize: 12 }}>Loading...</p>}
      {error && (
        <div style={{ padding: 8, backgroundColor: '#dc354522', border: '1px solid #dc3545', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#dc3545' }}>
          {error}
        </div>
      )}

      {/* Views */}
      {view === 'history' && renderHistory()}
      {view === 'detail' && renderDetail()}
      {view === 'checkpoints' && renderCheckpoints()}
      {view === 'rollback-preview' && renderRollbackPreview()}
    </div>
  );
}
