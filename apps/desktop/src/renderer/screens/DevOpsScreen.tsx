/** DevOpsScreen — template selector, GitHub Actions, deploy, and health check UI. */

import { useState, useEffect, useCallback } from 'react';
import type { ProjectDevOpsConfig, DeployRun } from '../../lib/shared-types';
import { C, R } from '../theme';

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
  const [backHov, setBackHov] = useState(false);
  const [saveHov, setSaveHov] = useState(false);

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

  const handleDuplicateTemplate = async (t: DevOpsTemplate) => {
    const copy = { ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, isBuiltIn: false };
    const created = await window.vibeflow.devops.createTemplate(copy);
    setTemplates(prev => [...prev, created]);
  };

  const handleDeleteTemplate = async (id: string) => {
    await window.vibeflow.devops.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
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
          environmentId: null,
          evidenceIds: [],
          healthVerdict: null,
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
    marginTop: 4,
  };

  const labelStyle = {
    fontSize: 11,
    color: C.text3,
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'block' as const,
  };

  const actionBtn = (color: string, hovColor: string) => ({
    padding: '7px 16px',
    backgroundColor: color,
    color: '#fff',
    border: 'none',
    borderRadius: R.md,
    cursor: loading ? 'not-allowed' as const : 'pointer' as const,
    fontSize: 13,
    fontWeight: 600 as const,
    opacity: loading ? 0.7 : 1,
  });

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: C.bg0, color: C.text1, overflow: 'hidden' }}>
      {/* Left sidebar — template selector */}
      <div style={{
        width: 200,
        minWidth: 200,
        borderRight: `1px solid ${C.border}`,
        padding: 12,
        backgroundColor: C.bg1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}>
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHov(true)}
          onMouseLeave={() => setBackHov(false)}
          style={{
            padding: '5px 10px',
            backgroundColor: backHov ? C.bg4 : 'transparent',
            color: C.text2,
            border: `1px solid ${C.border2}`,
            borderRadius: R.md,
            cursor: 'pointer',
            fontSize: 12,
            marginBottom: 14,
            width: '100%',
            transition: 'background 0.15s',
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
          Templates
        </div>
        {templates.map(t => (
          <div key={t.id} style={{ marginBottom: 4 }}>
            <div
              onClick={() => handleSelectTemplate(t.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                fontSize: 12,
                borderRadius: R.md,
                color: config.templateId === t.id ? '#fff' : C.text2,
                backgroundColor: config.templateId === t.id ? C.accent : 'transparent',
                fontWeight: config.templateId === t.id ? 600 : 400,
                transition: 'background 0.15s',
              }}
            >
              {t.name}
              {!t.isBuiltIn && (
                <span style={{ fontSize: 9, marginLeft: 5, color: C.blue, fontWeight: 600 }}>custom</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, paddingLeft: 4, marginTop: 2 }}>
              <button
                onClick={() => handleDuplicateTemplate(t)}
                title="Duplicate"
                style={{
                  padding: '2px 7px',
                  fontSize: 10,
                  backgroundColor: 'transparent',
                  color: C.text3,
                  border: `1px solid ${C.border}`,
                  borderRadius: R.sm,
                  cursor: 'pointer',
                }}
              >
                ⧉
              </button>
              {!t.isBuiltIn && (
                <button
                  onClick={() => handleDeleteTemplate(t.id)}
                  title="Delete"
                  style={{
                    padding: '2px 7px',
                    fontSize: 10,
                    backgroundColor: 'transparent',
                    color: C.red,
                    border: `1px solid ${C.redBd}`,
                    borderRadius: R.sm,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: C.bg1,
          padding: '0 12px',
          flexShrink: 0,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
                color: activeTab === tab.key ? C.accent : C.text3,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              marginBottom: 14,
              backgroundColor: C.redBg,
              color: C.red,
              borderRadius: R.md,
              border: `1px solid ${C.redBd}`,
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && selectedTemplate && (
            <div>
              <h3 style={{ color: C.text1, marginTop: 0, fontSize: 18 }}>{selectedTemplate.name}</h3>
              <p style={{ color: C.text2, fontSize: 13, marginBottom: 16 }}>{selectedTemplate.description}</p>
              <div style={{
                backgroundColor: C.bg2,
                padding: 14,
                borderRadius: R.xl,
                border: `1px solid ${C.border}`,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  What happens when you push
                </div>
                <p style={{ color: C.text2, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  {selectedTemplate.plainEnglishExplanation}
                </p>
              </div>
              {selectedTemplate.requiredSecrets.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Required Secrets
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedTemplate.requiredSecrets.map(s => (
                      <span key={s} style={{
                        padding: '3px 10px',
                        backgroundColor: C.yellowBg,
                        color: C.yellow,
                        border: `1px solid ${C.yellowBd}`,
                        borderRadius: R.md,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'GitHub Owner', key: 'githubOwner' as const },
                  { label: 'GitHub Repo', key: 'githubRepo' as const },
                  { label: 'Coolify App ID', key: 'coolifyAppId' as const },
                  { label: 'Coolify Base URL', key: 'coolifyBaseUrl' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      value={config[key]}
                      onChange={e => setConfig({ ...config, [key]: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveConfig}
                onMouseEnter={() => setSaveHov(true)}
                onMouseLeave={() => setSaveHov(false)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: saveHov ? C.accentHov : C.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: R.md,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
              >
                Save Configuration
              </button>
            </div>
          )}

          {/* GitHub Actions Tab */}
          {activeTab === 'github' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>GitHub Token</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                  />
                  <button
                    onClick={handleSaveGitHubToken}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: C.green,
                      color: '#fff',
                      border: 'none',
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Save Token
                  </button>
                </div>
              </div>
              <button
                onClick={handleRefreshWorkflowRuns}
                disabled={loading}
                style={actionBtn(C.accent, C.accentHov)}
              >
                {loading ? 'Loading...' : 'Refresh Runs'}
              </button>
              {workflowRuns.length > 0 && (
                <div style={{ marginTop: 16, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Status', 'Name', 'Branch', 'Commit', 'Time'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: C.text3, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workflowRuns.map(run => (
                        <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '8px 10px' }}>{statusIcon(run.status, run.conclusion)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <a href={run.htmlUrl} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>{run.name}</a>
                          </td>
                          <td style={{ padding: '8px 10px', color: C.text2 }}>{run.headBranch}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: C.text3, fontSize: 11 }}>{run.headSha.slice(0, 7)}</td>
                          <td style={{ padding: '8px 10px', color: C.text3, fontSize: 12 }}>{new Date(run.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Coolify API Key</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="password"
                    value={coolifyApiKey}
                    onChange={e => setCoolifyApiKey(e.target.value)}
                    placeholder="Enter API key"
                    style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                  />
                  <button
                    onClick={handleSaveCoolifyApiKey}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: C.green,
                      color: '#fff',
                      border: 'none',
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Save Key
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={handleDeploy} disabled={loading} style={actionBtn(C.green, '#0ea471')}>
                  {loading ? 'Deploying...' : 'Deploy Now'}
                </button>
                <button onClick={handleRestart} disabled={loading} style={actionBtn(C.accent, C.accentHov)}>
                  {loading ? 'Restarting...' : 'Restart'}
                </button>
              </div>
              {deployResult && (
                <div style={{
                  padding: '10px 14px',
                  marginBottom: 16,
                  backgroundColor: deployResult.success ? C.greenBg : C.redBg,
                  color: deployResult.success ? C.green : C.red,
                  borderRadius: R.md,
                  border: `1px solid ${deployResult.success ? C.greenBd : C.redBd}`,
                  fontSize: 13,
                }}>
                  {deployResult.success
                    ? `Deploy triggered — ID: ${deployResult.deploymentId}`
                    : `Deploy failed: ${deployResult.error}`}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Deploy History
              </div>
              {deployRuns.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Status', 'Triggered By', 'Commit', 'Started', 'Completed'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: C.text3, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deployRuns.map(run => (
                      <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            color: run.status === 'success' ? C.green : run.status === 'failed' ? C.red : run.status === 'running' ? C.blue : C.yellow,
                            fontWeight: 600,
                          }}>
                            {run.status === 'success' ? '✅' : run.status === 'failed' ? '❌' : run.status === 'running' ? '🔄' : '⏳'} {run.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: C.text2 }}>{run.triggeredBy}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: C.text3, fontSize: 11 }}>{run.commitSha ?? '—'}</td>
                        <td style={{ padding: '8px 10px', color: C.text3, fontSize: 12 }}>{new Date(run.startedAt).toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', color: C.text3, fontSize: 12 }}>{run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: C.text3, fontSize: 13 }}>No deploy runs yet.</p>
              )}
            </div>
          )}

          {/* Health Tab */}
          {activeTab === 'health' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Health Check URL</label>
                <input
                  value={config.healthCheckUrl}
                  onChange={e => setConfig({ ...config, healthCheckUrl: e.target.value })}
                  placeholder="https://your-app.com/health"
                  style={inputStyle}
                />
              </div>
              <button onClick={handleHealthCheck} disabled={loading} style={{ ...actionBtn(C.blue, C.blue), marginBottom: 16 }}>
                {loading ? 'Checking...' : 'Run Health Check'}
              </button>
              {healthResult && (
                <div style={{
                  padding: 16,
                  backgroundColor: C.bg2,
                  borderRadius: R.xl,
                  border: `1px solid ${healthResult.status === 'healthy' ? C.greenBd : healthResult.status === 'unhealthy' ? C.yellowBd : C.redBd}`,
                }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: healthResult.status === 'healthy' ? C.green : healthResult.status === 'unhealthy' ? C.yellow : C.red,
                    marginBottom: 10,
                  }}>
                    {healthResult.status === 'healthy' ? '✅ Healthy' : healthResult.status === 'unhealthy' ? '⚠️ Unhealthy' : '🔴 Unreachable'}
                  </div>
                  {healthResult.httpStatus != null && (
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 4 }}>
                      HTTP Status: <strong style={{ color: C.text1 }}>{healthResult.httpStatus}</strong>
                    </div>
                  )}
                  {healthResult.responseTimeMs != null && (
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 4 }}>
                      Response Time: <strong style={{ color: C.text1 }}>{healthResult.responseTimeMs}ms</strong>
                    </div>
                  )}
                  {healthResult.error && (
                    <div style={{ color: C.red, fontSize: 13, marginBottom: 4 }}>Error: {healthResult.error}</div>
                  )}
                  <div style={{ color: C.text3, fontSize: 11, marginTop: 8 }}>
                    Checked: {new Date(healthResult.checkedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
