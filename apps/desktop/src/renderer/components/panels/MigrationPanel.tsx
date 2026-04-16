/** MigrationPanel — Component 18 migration planning and safety UI. */

import { useState, useEffect } from 'react';
import type { MigrationPlan, MigrationRiskClass } from '../../../lib/shared-types';

interface MigrationPanelProps {
  projectId: string;
}

const RISK_COLORS: Record<MigrationRiskClass, string> = {
  'additive-safe': '#28a745',
  'backfill-required': '#ffc107',
  'index-performance': '#17a2b8',
  'destructive-schema': '#dc3545',
  'data-rewrite': '#fd7e14',
  'auth-identity': '#6f42c1',
};

export default function MigrationPanel({ projectId }: MigrationPanelProps) {
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [migrationPlans, migrationHistory] = await Promise.all([
        window.vibeflow.migration.listPlans(projectId),
        window.vibeflow.migration.listHistory(projectId),
      ]);
      setPlans(migrationPlans);
      setHistory(migrationHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load migration data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ color: '#484f58', fontSize: 13, padding: 16 }}>Loading migration data...</div>;
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
    <div style={{ fontSize: 13, color: '#c9d1d9' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #30363d', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('plans')}
          style={{
            padding: '4px 12px',
            backgroundColor: activeTab === 'plans' ? '#238636' : 'transparent',
            color: activeTab === 'plans' ? '#fff' : '#8b949e',
            border: '1px solid #30363d',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '4px 12px',
            backgroundColor: activeTab === 'history' ? '#238636' : 'transparent',
            color: activeTab === 'history' ? '#fff' : '#8b949e',
            border: '1px solid #30363d',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          History ({history.length})
        </button>
      </div>

      {activeTab === 'plans' && (
        <div>
          {plans.length === 0 ? (
            <div style={{ color: '#484f58', fontSize: 13 }}>
              <p>No migration plans yet.</p>
              <p style={{ margin: 0 }}>Migration plans are created when schema changes are detected or proposed.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    padding: 12,
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{plan.description}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: `${RISK_COLORS[plan.riskClass]}20`,
                        border: `1px solid ${RISK_COLORS[plan.riskClass]}`,
                        borderRadius: 4,
                        fontSize: 11,
                        color: RISK_COLORS[plan.riskClass],
                      }}
                    >
                      {plan.riskClass}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                    <span>Status: {plan.status}</span>
                    <span>Blast radius: {plan.estimatedBlastRadius}</span>
                    <span>Tables: {plan.affectedTables.join(', ') || 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    <span>Checkpoint: {plan.requiresCheckpoint ? '✅ Required' : '❌ Not required'}</span>
                    <span>Approval: {plan.approvalRequired ? '✅ Required' : '❌ Not required'}</span>
                    <span>Ordering: {plan.orderingRequirement}</span>
                  </div>
                  {plan.safeguards.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11 }}>
                      <div style={{ color: '#6b7280', marginBottom: 4 }}>Safeguards:</div>
                      {plan.safeguards.map((s, i) => (
                        <div key={i} style={{ color: s.satisfied ? '#28a745' : s.required ? '#dc3545' : '#ffc107' }}>
                          {s.satisfied ? '✅' : s.required ? '❌' : '⚠️'} {s.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div style={{ color: '#484f58', fontSize: 13 }}>
              <p>No migration history yet.</p>
              <p style={{ margin: 0 }}>Applied migrations will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: 12,
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{entry.migration_name}</span>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: entry.success ? '#28a74520' : '#dc354520',
                      border: `1px solid ${entry.success ? '#28a745' : '#dc3545'}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: entry.success ? '#28a745' : '#dc3545',
                    }}>
                      {entry.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    <span>Risk: {entry.risk_class}</span>
                    <span>Applied: {new Date(entry.applied_at).toLocaleString()}</span>
                    <span>By: {entry.applied_by}</span>
                    {entry.rollback_executed && <span style={{ color: '#ffc107' }}>⚠️ Rollback executed</span>}
                  </div>
                  {entry.error && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#dc3545' }}>
                      Error: {entry.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
