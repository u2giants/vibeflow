/** DevOpsScreen — template selector, GitHub Actions, deploy, and health check UI. */

import { useState, useEffect, useCallback } from 'react';
import type { ProjectDevOpsConfig, DeployRun } from '../../lib/shared-types';

interface DevOpsTemplate {
  id: string;
  name: string;
  description: string;
  plainEnglishExplanation: string;
  requiredSecrets: string[];
  isBuiltIn: boolean;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  headBranch: string;
  createdAt: string;
  htmlUrl: string;
}

interface HealthCheckResult {
  url: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  httpStatus: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  error: string | null;
}

interface DeployRunResult {
  success: boolean;
  deploymentId: string | null;
  error: string | null;
}

interface DevOpsScreenProps {
  projectId: string;
  onBack: () => void;
}

type Tab = 'overview' | 'github' | 'deploy' | 'health';

export default function DevOpsScreen({ projectId, onBack }: DevOpsScreenProps) {
  const [templates, setTemplates] = useState<DevOpsTemplate[]>([]);
  const [config, setConfig] = useState<ProjectDevOpsConfig>({
    projectId,
    templateId: 'template-albert',
    githubOwner: '',
    githubRepo: '',
    coolifyAppId: '',
    coolifyBaseUrl: '',
    imageName: '',
    healthCheckUrl: '',
    updatedAt: new Date().toISOString(),
  });
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [githubToken, setGithubToken] = useState('');
  const [coolifyApiKey, setCoolifyApiKey] = useState('');
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [deployRuns, setDeployRuns] = useState<DeployRun[]>([]);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [deployResult, setDeployResult] = useState<DeployRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.vibeflow.devops.listTemplates().then(setTemplates);
    window.vibeflow.devops.getProjectConfig(projectId).then((c) => {
      if (c) setConfig(c);
    });
    window.vibeflow.devops.listDeployRuns(projectId).then(setDeployRuns);
  }, [projectId]);

  const handleSaveConfig = async () => {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    await window.vibeflow.devops.saveProjectConfig(updated);
    setConfig(updated);
  };

  const handleSelectTemplate = async (templateId: string) => {
    const updated = { ...config, templateId, updatedAt: new Date().toISOString() };
    await window.vibeflow.devops.saveProjectConfig(updated);
    setConfig(updated);
  };

  const handleSaveGitHubToken = async () => {
    if (githubToken.trim()) {
      await window.vibeflow.devops.setGitHubToken(githubToken.trim());
      setGithubToken('');
    }
  };

  const handleSaveCoolifyApiKey = async () => {
    if (coolifyApiKey.trim()) {
      await window.vibeflow.devops.setCoolifyApiKey(coolifyApiKey.trim());
      setCoolifyApiKey('');
    }
  };

  const handleRefreshWorkflowRuns = useCallback(async () => {
    if (!config.githubOwner || !config.githubRepo) {
      setError('Set GitHub owner and repo first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const runs = await window.vibeflow.devops.listWorkflowRuns(config.githubOwner, config.githubRepo);
      setWorkflowRuns(runs);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch workflow runs');
    } finally {
      setLoading(false);
    }
  }, [config.githubOwner, config.githubRepo]);

  const handleDeploy = async () => {
    if (!config.coolifyAppId || !config.coolifyBaseUrl) {
      setError('Set Coolify app ID and base URL first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.vibeflow.devops.deploy(config.coolifyAppId, config.coolifyBaseUrl);
      setDeployResult(result);
      if (result.success) {
        const newRun: DeployRun = {
          id: crypto.randomUUID(),
          projectId,
          templateId: config.templateId,
          status: 'running',
          commitSha: null,
          triggeredBy: 'user',
          startedAt: new Date().toISOString(),
          completedAt: null,
          error: null,
        };
        window.vibeflow.devops.listDeployRuns(projectId).then(setDeployRuns);
      }
    } catch (err: any) {
      setError(err.message ?? 'Deploy failed');
      setDeployResult({ success: false, deploymentId: null, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!config.coolifyAppId || !config.coolifyBaseUrl) {
      setError('Set Coolify app ID and base URL first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await window.vibeflow.devops.restart(config.coolifyAppId, config.coolifyBaseUrl);
    } catch (err: any) {
      setError(err.message ?? 'Restart failed');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    if (!config.healthCheckUrl) {
      setError('Set a health check URL first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.vibeflow.devops.healthCheck(config.healthCheckUrl);
      setHealthResult(result);
    } catch (err: any) {
      setError(err.message ?? 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === config.templateId) ?? templates[0];

  const statusIcon = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      return conclusion === 'success' ? '✅' : conclusion === 'failure' ? '❌' : '⚠️';
    }
    return '🔄';
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'github', label: 'GitHub Actions' },
    { key: 'deploy', label: 'Deploy' },
    { key: 'health', label: 'Health' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#0d1117', color: '#c9d1d9' }}>
      {/* Left sidebar — template selector */}
      <div style={{ width: 200, borderRight: '1px solid #30363d', padding: 12 }}>
        <button onClick={onBack} style={{
          padding: '4px 8px', backgroundColor: 'transparent', color: '#8b949e',
          border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginBottom: 12, width: '100%',
        }}>← Back</button>
        <div style={{ fontSize: 11, color: '#484f58', textTransform: 'uppercase', marginBottom: 8 }}>Templates</div>
        {templates.map(t => (
          <div
            key={t.id}
            onClick={() => handleSelectTemplate(t.id)}
            style={{
              padding: '8px 10px', marginBottom: 4, borderRadius: 4, cursor: 'pointer', fontSize: 13,
              color: config.templateId === t.id ? '#fff' : '#8b949e',
              backgroundColor: config.templateId === t.id ? '#238636' : 'transparent',
            }}
          >
            {t.name}
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #30363d', padding: '0 12px' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px', backgroundColor: 'transparent', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #58a6ff' : '2px solid transparent',
                color: activeTab === tab.key ? '#58a6ff' : '#8b949e', cursor: 'pointer', fontSize: 13,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {error && (
            <div style={{ padding: 8, marginBottom: 12, backgroundColor: '#3d1f1f', color: '#f85149', borderRadius: 4, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && selectedTemplate && (
            <div>
              <h3 style={{ color: '#c9d1d9', marginTop: 0 }}>{selectedTemplate.name}</h3>
              <p style={{ color: '#8b949e', fontSize: 14 }}>{selectedTemplate.description}</p>
              <div style={{ backgroundColor: '#161b22', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <strong style={{ color: '#58a6ff' }}>What happens when you push:</strong>
                <p style={{ color: '#c9d1d9', fontSize: 14, marginTop: 8 }}>{selectedTemplate.plainEnglishExplanation}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <strong style={{ color: '#58a6ff' }}>Required Secrets:</strong>
                <ul style={{ color: '#8b949e', fontSize: 13 }}>
                  {selectedTemplate.requiredSecrets.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>GitHub Owner</label>
                  <input value={config.githubOwner} onChange={e => setConfig({ ...config, githubOwner: e.target.value })}
                    style={{ width: '100%', padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>GitHub Repo</label>
                  <input value={config.githubRepo} onChange={e => setConfig({ ...config, githubRepo: e.target.value })}
                    style={{ width: '100%', padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>Coolify App ID</label>
                  <input value={config.coolifyAppId} onChange={e => setConfig({ ...config, coolifyAppId: e.target.value })}
                    style={{ width: '100%', padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>Coolify Base URL</label>
                  <input value={config.coolifyBaseUrl} onChange={e => setConfig({ ...config, coolifyBaseUrl: e.target.value })}
                    style={{ width: '100%', padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                </div>
              </div>
              <button onClick={handleSaveConfig} style={{
                padding: '8px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              }}>Save Configuration</button>
            </div>
          )}

          {/* ── GitHub Actions Tab ── */}
          {activeTab === 'github' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#8b949e' }}>GitHub Token</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_..."
                    style={{ flex: 1, padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                  <button onClick={handleSaveGitHubToken} style={{
                    padding: '6px 12px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  }}>Save Token</button>
                </div>
              </div>
              <button onClick={handleRefreshWorkflowRuns} disabled={loading} style={{
                padding: '8px 16px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginBottom: 12,
              }}>{loading ? 'Loading...' : 'Refresh Runs'}</button>
              {workflowRuns.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #30363d' }}>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Branch</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Commit</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflowRuns.map(run => (
                      <tr key={run.id} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: 8 }}>{statusIcon(run.status, run.conclusion)}</td>
                        <td style={{ padding: 8 }}>
                          <a href={run.htmlUrl} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{run.name}</a>
                        </td>
                        <td style={{ padding: 8, color: '#8b949e' }}>{run.headBranch}</td>
                        <td style={{ padding: 8, fontFamily: 'monospace', color: '#8b949e' }}>{run.headSha}</td>
                        <td style={{ padding: 8, color: '#8b949e' }}>{new Date(run.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Deploy Tab ── */}
          {activeTab === 'deploy' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#8b949e' }}>Coolify API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="password" value={coolifyApiKey} onChange={e => setCoolifyApiKey(e.target.value)} placeholder="Enter API key"
                    style={{ flex: 1, padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }} />
                  <button onClick={handleSaveCoolifyApiKey} style={{
                    padding: '6px 12px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  }}>Save Key</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={handleDeploy} disabled={loading} style={{
                  padding: '8px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}>{loading ? 'Deploying...' : 'Deploy Now'}</button>
                <button onClick={handleRestart} disabled={loading} style={{
                  padding: '8px 16px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}>{loading ? 'Restarting...' : 'Restart'}</button>
              </div>
              {deployResult && (
                <div style={{ padding: 8, marginBottom: 12, backgroundColor: deployResult.success ? '#1a3a2a' : '#3d1f1f', color: deployResult.success ? '#3fb950' : '#f85149', borderRadius: 4, fontSize: 13 }}>
                  {deployResult.success ? `Deploy triggered! ID: ${deployResult.deploymentId}` : `Deploy failed: ${deployResult.error}`}
                </div>
              )}
              <h4 style={{ color: '#c9d1d9' }}>Deploy History</h4>
              {deployRuns.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #30363d' }}>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Triggered By</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Commit</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Started</th>
                      <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployRuns.map(run => (
                      <tr key={run.id} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: 8 }}>
                          {run.status === 'success' ? '✅' : run.status === 'failed' ? '❌' : run.status === 'running' ? '🔄' : '⏳'} {run.status}
                        </td>
                        <td style={{ padding: 8, color: '#8b949e' }}>{run.triggeredBy}</td>
                        <td style={{ padding: 8, fontFamily: 'monospace', color: '#8b949e' }}>{run.commitSha ?? '—'}</td>
                        <td style={{ padding: 8, color: '#8b949e' }}>{new Date(run.startedAt).toLocaleString()}</td>
                        <td style={{ padding: 8, color: '#8b949e' }}>{run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#484f58', fontSize: 13 }}>No deploy runs yet.</p>
              )}
            </div>
          )}

          {/* ── Health Tab ── */}
          {activeTab === 'health' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#8b949e' }}>Health Check URL</label>
                <input value={config.healthCheckUrl} onChange={e => setConfig({ ...config, healthCheckUrl: e.target.value })} placeholder="https://your-app.com/health"
                  style={{ width: '100%', padding: 6, backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, marginBottom: 8 }} />
              </div>
              <button onClick={handleHealthCheck} disabled={loading} style={{
                padding: '8px 16px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginBottom: 16,
              }}>{loading ? 'Checking...' : 'Run Health Check'}</button>
              {healthResult && (
                <div style={{ padding: 12, backgroundColor: '#161b22', borderRadius: 6 }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>
                    {healthResult.status === 'healthy' ? '✅ Healthy' : healthResult.status === 'unhealthy' ? '⚠️ Unhealthy' : '🔴 Unreachable'}
                  </div>
                  {healthResult.httpStatus && <div style={{ color: '#8b949e', fontSize: 13 }}>HTTP Status: {healthResult.httpStatus}</div>}
                  {healthResult.responseTimeMs && <div style={{ color: '#8b949e', fontSize: 13 }}>Response Time: {healthResult.responseTimeMs}ms</div>}
                  {healthResult.error && <div style={{ color: '#f85149', fontSize: 13 }}>Error: {healthResult.error}</div>}
                  <div style={{ color: '#484f58', fontSize: 12, marginTop: 8 }}>Checked at: {new Date(healthResult.checkedAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
