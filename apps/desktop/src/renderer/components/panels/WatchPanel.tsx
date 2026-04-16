/** WatchPanel — Component 21: post-deploy watch state, anomalies, incidents, and self-healing. */

import { useState, useEffect, useCallback } from 'react';
import type { WatchSession, AnomalyEvent, Incident, SelfHealingAction, WatchDashboard } from '../../../lib/shared-types';

interface WatchPanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

type Tab = 'watches' | 'anomalies' | 'incidents' | 'selfHealing';

export default function WatchPanel({ projectId }: WatchPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('watches');
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selfHealingActions, setSelfHealingActions] = useState<SelfHealingAction[]>([]);
  const [dashboard, setDashboard] = useState<WatchDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [sessionsData, anomaliesData, incidentsData, selfHealingData, dashboardData] = await Promise.all([
        window.vibeflow.watch.listSessions(projectId),
        window.vibeflow.anomaly.list(projectId),
        window.vibeflow.incident.list(projectId),
        window.vibeflow.selfHealing.list(projectId),
        window.vibeflow.watch.getDashboard(projectId),
      ]);
      setSessions(sessionsData);
      setAnomalies(anomaliesData);
      setIncidents(incidentsData);
      setSelfHealingActions(selfHealingData);
      setDashboard(dashboardData);
    } catch (err) {
      console.error('[WatchPanel] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time listeners
  useEffect(() => {
    if (!projectId) return;

    const handleSessionStarted = () => loadData();
    const handleSessionCompleted = () => loadData();
    const handleAnomalyDetected = () => loadData();
    const handleIncidentOpened = () => loadData();
    const handleActionStarted = () => loadData();
    const handleActionCompleted = () => loadData();

    window.vibeflow.watch.onSessionStarted(handleSessionStarted);
    window.vibeflow.watch.onSessionCompleted(handleSessionCompleted);
    window.vibeflow.watch.onAnomalyDetected(handleAnomalyDetected);
    window.vibeflow.incident.onOpened(handleIncidentOpened);
    window.vibeflow.selfHealing.onActionStarted(handleActionStarted);
    window.vibeflow.selfHealing.onActionCompleted(handleActionCompleted);

    return () => {
      window.vibeflow.watch.removeListeners();
      window.vibeflow.incident.removeListeners();
      window.vibeflow.selfHealing.removeListeners();
    };
  }, [projectId, loadData]);

  const handleStopSession = async (sessionId: string) => {
    await window.vibeflow.watch.stopSession(sessionId);
    loadData();
  };

  const handleAcknowledgeAnomaly = async (anomalyId: string) => {
    await window.vibeflow.anomaly.acknowledge(anomalyId, 'operator');
    loadData();
  };

  const handleResolveIncident = async (incidentId: string) => {
    await window.vibeflow.incident.resolve(incidentId);
    loadData();
  };

  const handleDismissIncident = async (incidentId: string) => {
    await window.vibeflow.incident.dismiss(incidentId);
    loadData();
  };

  if (!projectId) {
    return <div style={{ color: '#484f58', fontSize: 13 }}>No project selected.</div>;
  }

  if (loading) {
    return <div style={{ color: '#484f58', fontSize: 13 }}>Loading watch data...</div>;
  }

  const severityColor: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };

  const statusColor: Record<string, string> = {
    active: '#22c55e',
    completed: '#6b7280',
    escalated: '#ef4444',
    dismissed: '#6b7280',
    pending: '#eab308',
    running: '#3b82f6',
    failed: '#ef4444',
    blocked: '#6b7280',
    approved: '#22c55e',
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'watches', label: 'Active Watches', count: sessions.filter((s) => s.status === 'active').length },
    { key: 'anomalies', label: 'Anomalies', count: anomalies.length },
    { key: 'incidents', label: 'Incidents', count: incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length },
    { key: 'selfHealing', label: 'Self-Healing', count: selfHealingActions.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 13 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 12 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '4px 12px',
              border: 'none',
              borderRadius: 4,
              background: activeTab === tab.key ? '#3b82f6' : '#1e1e2e',
              color: activeTab === tab.key ? '#fff' : '#a1a1aa',
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                background: tab.key === 'incidents' ? '#ef4444' : '#4b5563',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'watches' && (
          <div>
            {sessions.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No watch sessions yet. Watch sessions start automatically after protected deploys.</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} style={{
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                  background: '#18181b',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor[session.status] ?? '#6b7280',
                      }} />
                      <strong>{session.environmentId}</strong>
                    </div>
                    {session.status === 'active' && (
                      <button
                        onClick={() => handleStopSession(session.id)}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid #ef4444',
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Stop
                      </button>
                    )}
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                    <div>Status: <span style={{ color: statusColor[session.status] }}>{session.status}</span></div>
                    <div>Started: {new Date(session.startedAt).toLocaleString()}</div>
                    <div>Elevated evidence: {session.elevatedEvidence ? 'Yes' : 'No'}</div>
                    <div>Probes: {session.probes.filter((p) => p.status === 'pass').length}/{session.probes.length} passing</div>
                  </div>
                  {/* Probe summary */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {session.probes.map((probe) => (
                      <span key={probe.id} style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: probe.disabled ? '#374151' : '#1e1e2e',
                        color: probe.disabled ? '#6b7280' : (probe.status === 'pass' ? '#22c55e' : probe.status === 'fail' ? '#ef4444' : '#eab308'),
                        border: `1px solid ${probe.disabled ? '#4b5563' : (probe.status === 'pass' ? '#166534' : probe.status === 'fail' ? '#991b1b' : '#854d0e')}`,
                      }}>
                        {probe.type}{probe.disabled ? ' (disabled)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div>
            {anomalies.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No anomalies detected. All systems nominal.</p>
            ) : (
              anomalies.map((anomaly) => (
                <div key={anomaly.id} style={{
                  border: `1px solid ${severityColor[anomaly.severity] ?? '#333'}`,
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                  background: '#18181b',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: severityColor[anomaly.severity] ?? '#6b7280',
                      }} />
                      <strong>{anomaly.anomalyType}</strong>
                    </div>
                    {!anomaly.acknowledged && (
                      <button
                        onClick={() => handleAcknowledgeAnomaly(anomaly.id)}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid #3b82f6',
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                    <div>{anomaly.description}</div>
                    <div style={{ marginTop: 4 }}>Detected: {new Date(anomaly.detectedAt).toLocaleString()}</div>
                    {anomaly.correlatedDeployWorkflowId && (
                      <div>Correlated deploy: {anomaly.correlatedDeployWorkflowId.slice(0, 20)}...</div>
                    )}
                    {anomaly.acknowledged && (
                      <div style={{ color: '#22c55e', marginTop: 4 }}>Acknowledged by {anomaly.acknowledgedBy}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div>
            {incidents.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No incidents. Great job keeping things running!</p>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} style={{
                  border: `1px solid ${severityColor[incident.severity] ?? '#333'}`,
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                  background: '#18181b',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: severityColor[incident.severity] ?? '#6b7280',
                      }} />
                      <strong>{incident.title}</strong>
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      background: incident.status === 'open' || incident.status === 'investigating' ? '#451a03' : '#1e1e2e',
                      color: incident.status === 'open' || incident.status === 'investigating' ? '#f97316' : '#6b7280',
                    }}>
                      {incident.status}
                    </span>
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                    <div>{incident.description}</div>
                    {incident.recommendedAction && (
                      <div style={{ marginTop: 6, padding: 6, background: '#1e1e2e', borderRadius: 4, borderLeft: '3px solid #3b82f6' }}>
                        <strong>Recommended action:</strong> {incident.recommendedAction}
                      </div>
                    )}
                    {incident.selfHealingAttempted && (
                      <div style={{ marginTop: 4, color: '#eab308' }}>Self-healing attempted: {incident.selfHealingResult ?? 'pending'}</div>
                    )}
                    <div style={{ marginTop: 4 }}>Detected: {new Date(incident.detectedAt).toLocaleString()}</div>
                  </div>
                  {(incident.status === 'open' || incident.status === 'investigating') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => handleResolveIncident(incident.id)}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid #22c55e',
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#22c55e',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleDismissIncident(incident.id)}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid #6b7280',
                          borderRadius: 4,
                          background: 'transparent',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'selfHealing' && (
          <div>
            {selfHealingActions.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No self-healing actions recorded.</p>
            ) : (
              selfHealingActions.map((action) => (
                <div key={action.id} style={{
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                  background: '#18181b',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>{action.actionType}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {action.automatic && (
                        <span style={{ fontSize: 10, color: '#6b7280' }}>Automatic</span>
                      )}
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: statusColor[action.status] ? `${statusColor[action.status]}22` : '#1e1e2e',
                        color: statusColor[action.status] ?? '#6b7280',
                      }}>
                        {action.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                    {action.result && <div>{action.result}</div>}
                    {action.approvalRequired && action.status === 'pending' && (
                      <div style={{ color: '#eab308', marginTop: 4 }}>Approval required</div>
                    )}
                    {action.executedAt && <div style={{ marginTop: 4 }}>Executed: {new Date(action.executedAt).toLocaleString()}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
