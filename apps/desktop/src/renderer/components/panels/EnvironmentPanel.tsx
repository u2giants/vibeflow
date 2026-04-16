/** EnvironmentPanel — Component 17 full environment management UI. */

import { useState, useEffect, useCallback } from 'react';
import type { Environment, DeployWorkflow, DriftReport, Mission } from '../../../lib/shared-types';

interface EnvironmentPanelProps {
  mission?: Mission | null;
  projectId?: string;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#28a745',
  degraded: '#ffc107',
  unauthorized: '#dc3545',
  misconfigured: '#fd7e14',
  offline: '#6c757d',
  unknown: '#484f58',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  local: '#6b7280',
  preview: '#3b82f6',
  staging: '#f59e0b',
  canary: '#8b5cf6',
  production: '#ef4444',
};

export default function EnvironmentPanel({ mission, projectId }: EnvironmentPanelProps) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [driftReports, setDriftReports] = useState<DriftReport[]>([]);
  const [deployHistory, setDeployHistory] = useState<DeployWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvType, setNewEnvType] = useState<Environment['type']>('staging');
  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'drift' | 'deploys'>('list');

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [envs, drifts, deploys] = await Promise.all([
        window.vibeflow.environment.list(projectId),
        window.vibeflow.drift.getReports(projectId).catch(() => []),
        window.vibeflow.deploy.getHistory(projectId).catch(() => []),
      ]);
      setEnvironments(envs);
      setDriftReports(drifts);
      setDeployHistory(deploys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environment data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEnv() {
    if (!projectId || !newEnvName.trim()) return;
    try {
      const env = await window.vibeflow.environment.create({
        projectId,
        name: newEnvName.trim(),
        type: newEnvType,
        currentVersion: null,
        secretsComplete: false,
        serviceHealth: 'unknown',
        branchMapping: null,
        host: null,
        deployMechanism: 'coolify',
        requiredSecrets: [],
        linkedServiceIds: [],
        healthEndpoint: null,
        protections: getDefaultProtections(newEnvType),
        rollbackMethod: 'coolify-rollback',
        mutabilityRules: [],
      });
      setEnvironments((prev) => [...prev, env]);
      setShowCreateForm(false);
      setNewEnvName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create environment');
    }
  }

  async function handleCreatePreview() {
    if (!projectId) return;
    try {
      const env = await window.vibeflow.environment.createPreview(projectId, 'feature-branch');
      setEnvironments((prev) => [...prev, env]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preview');
    }
  }

  async function handleRunDriftDetection() {
    if (!projectId) return;
    try {
      const reports = await window.vibeflow.drift.detect(projectId);
      setDriftReports(reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect drift');
    }
  }

  async function handleResolveDrift(reportId: string) {
    try {
      await window.vibeflow.drift.resolve(reportId);
      setDriftReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve drift');
    }
  }

  function getDefaultProtections(type: Environment['type']): Environment['protections'] {
    switch (type) {
      case 'production': return ['require-approval', 'require-evidence', 'require-rollback-plan', 'require-service-dependency-check'];
      case 'canary': return ['require-approval', 'require-evidence', 'require-rollback-plan'];
      case 'staging': return ['require-evidence', 'require-rollback-plan'];
      default: return [];
    }
  }

  function getDriftCountForEnv(envId: string): { critical: number; warning: number; info: number } {
    const envDrifts = driftReports.filter((d) => d.environmentId === envId && !d.resolved);
    return {
      critical: envDrifts.filter((d) => d.severity === 'critical').length,
      warning: envDrifts.filter((d) => d.severity === 'warning').length,
      info: envDrifts.filter((d) => d.severity === 'info').length,
    };
  }

  if (loading) {
    return <div style={{ color: '#484f58', fontSize: 13, padding: 16 }}>Loading environments...</div>;
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
      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #30363d', paddingBottom: 8 }}>
        {(['list', 'detail', 'drift', 'deploys'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '4px 12px',
              backgroundColor: activeTab === tab ? '#238636' : 'transparent',
              border: '1px solid #30363d',
              borderRadius: 4,
              color: activeTab === tab ? '#fff' : '#8b949e',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {tab === 'list' ? 'Environments' : tab === 'detail' ? 'Detail' : tab === 'drift' ? 'Drift' : 'Deploys'}
          </button>
        ))}
      </div>

      {/* List tab */}
      {activeTab === 'list' && (
        <div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setShowCreateForm(true)} style={{ padding: '4px 12px', backgroundColor: '#238636', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              + Create Environment
            </button>
            <button onClick={handleCreatePreview} style={{ padding: '4px 12px', backgroundColor: '#1f6feb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              + Create Preview
            </button>
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div style={{ padding: 12, backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="Environment name"
                  style={{ flex: 1, padding: '4px 8px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
                />
                <select
                  value={newEnvType}
                  onChange={(e) => setNewEnvType(e.target.value as Environment['type'])}
                  style={{ padding: '4px 8px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9' }}
                >
                  <option value="local">Local</option>
                  <option value="preview">Preview</option>
                  <option value="staging">Staging</option>
                  <option value="canary">Canary</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCreateEnv} style={{ padding: '4px 12px', backgroundColor: '#238636', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Create</button>
                <button onClick={() => setShowCreateForm(false)} style={{ padding: '4px 12px', backgroundColor: '#30363d', border: 'none', borderRadius: 4, color: '#c9d1d9', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Environment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {environments.map((env) => {
              const drift = getDriftCountForEnv(env.id);
              return (
                <div
                  key={env.id}
                  onClick={() => { setSelectedEnv(env); setActiveTab('detail'); }}
                  style={{
                    padding: 12,
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{env.name}</span>
                      <span style={{
                        padding: '2px 8px',
                        backgroundColor: `${TYPE_BADGE_COLORS[env.type]}20`,
                        border: `1px solid ${TYPE_BADGE_COLORS[env.type]}`,
                        borderRadius: 4,
                        fontSize: 11,
                        color: TYPE_BADGE_COLORS[env.type],
                      }}>
                        {env.type}
                      </span>
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: `${HEALTH_COLORS[env.serviceHealth]}20`,
                      border: `1px solid ${HEALTH_COLORS[env.serviceHealth]}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: HEALTH_COLORS[env.serviceHealth],
                    }}>
                      {env.serviceHealth}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    <span>Version: {env.currentVersion ?? 'Not deployed'}</span>
                    <span>Secrets: {env.secretsComplete ? '✅' : '❌'}</span>
                    {drift.critical > 0 && <span style={{ color: '#dc3545' }}>⚠ {drift.critical} critical drift</span>}
                    {drift.warning > 0 && <span style={{ color: '#ffc107' }}>⚠ {drift.warning} warnings</span>}
                  </div>
                </div>
              );
            })}
            {environments.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#484f58' }}>No environments yet. Create one to get started.</div>
            )}
          </div>
        </div>
      )}

      {/* Detail tab */}
      {activeTab === 'detail' && selectedEnv && (
        <div>
          <button onClick={() => setActiveTab('list')} style={{ marginBottom: 12, padding: '4px 12px', backgroundColor: '#30363d', border: 'none', borderRadius: 4, color: '#c9d1d9', cursor: 'pointer', fontSize: 12 }}>
            ← Back to list
          </button>
          <div style={{ padding: 12, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>{selectedEnv.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: '#6b7280' }}>Type:</span> {selectedEnv.type}</div>
              <div><span style={{ color: '#6b7280' }}>Version:</span> {selectedEnv.currentVersion ?? 'Not deployed'}</div>
              <div><span style={{ color: '#6b7280' }}>Host:</span> {selectedEnv.host ?? 'Not set'}</div>
              <div><span style={{ color: '#6b7280' }}>Deploy Mechanism:</span> {selectedEnv.deployMechanism ?? 'Not set'}</div>
              <div><span style={{ color: '#6b7280' }}>Health Endpoint:</span> {selectedEnv.healthEndpoint ?? 'Not set'}</div>
              <div><span style={{ color: '#6b7280' }}>Rollback Method:</span> {selectedEnv.rollbackMethod ?? 'Not set'}</div>
              <div><span style={{ color: '#6b7280' }}>Branch:</span> {selectedEnv.branchMapping ?? 'Not set'}</div>
              <div><span style={{ color: '#6b7280' }}>Secrets Complete:</span> {selectedEnv.secretsComplete ? '✅' : '❌'}</div>
            </div>
            {selectedEnv.protections.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span style={{ color: '#6b7280' }}>Protections:</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {selectedEnv.protections.map((p) => (
                    <span key={p} style={{ padding: '2px 8px', backgroundColor: '#1f6feb20', border: '1px solid #1f6feb', borderRadius: 4, fontSize: 11, color: '#58a6ff' }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drift tab */}
      {activeTab === 'drift' && (
        <div>
          <button onClick={handleRunDriftDetection} style={{ marginBottom: 12, padding: '4px 12px', backgroundColor: '#1f6feb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>
            Run Drift Detection
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {driftReports.filter((d) => !d.resolved).map((report) => (
              <div key={report.id} style={{ padding: 12, backgroundColor: '#0d1117', border: `1px solid ${report.severity === 'critical' ? '#dc3545' : report.severity === 'warning' ? '#ffc107' : '#30363d'}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{report.driftType}</span>
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: `${report.severity === 'critical' ? '#dc3545' : report.severity === 'warning' ? '#ffc107' : '#484f58'}20`,
                    border: `1px solid ${report.severity === 'critical' ? '#dc3545' : report.severity === 'warning' ? '#ffc107' : '#484f58'}`,
                    borderRadius: 4,
                    fontSize: 11,
                    color: report.severity === 'critical' ? '#dc3545' : report.severity === 'warning' ? '#ffc107' : '#484f58',
                  }}>
                    {report.severity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>{report.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#484f58' }}>Detected: {new Date(report.detectedAt).toLocaleString()}</span>
                  <button onClick={() => handleResolveDrift(report.id)} style={{ padding: '2px 8px', backgroundColor: '#238636', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11 }}>Resolve</button>
                </div>
              </div>
            ))}
            {driftReports.filter((d) => !d.resolved).length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#484f58' }}>No active drift reports. Run detection to check.</div>
            )}
          </div>
        </div>
      )}

      {/* Deploys tab */}
      {activeTab === 'deploys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deployHistory.map((wf) => (
            <div key={wf.id} style={{ padding: 12, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>Deploy {wf.id.slice(0, 20)}...</span>
                <span style={{
                  padding: '2px 8px',
                  backgroundColor: `${wf.status === 'completed' ? '#28a745' : wf.status === 'failed' ? '#dc3545' : wf.status === 'rolled-back' ? '#ffc107' : '#484f58'}20`,
                  border: `1px solid ${wf.status === 'completed' ? '#28a745' : wf.status === 'failed' ? '#dc3545' : wf.status === 'rolled-back' ? '#ffc107' : '#484f58'}`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: wf.status === 'completed' ? '#28a745' : wf.status === 'failed' ? '#dc3545' : wf.status === 'rolled-back' ? '#ffc107' : '#484f58',
                }}>
                  {wf.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                Candidate: {wf.candidateId.slice(0, 20)}... | Started: {new Date(wf.startedAt).toLocaleString()}
              </div>
              {wf.verdict && (
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
                  Verdict: {wf.verdict} — {wf.verdictReason}
                </div>
              )}
            </div>
          ))}
          {deployHistory.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#484f58' }}>No deploy history yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
