/** MissionPanel — displays real mission state, plan steps, and role assignments. */

import { useState, useEffect } from 'react';
import type { Mission, PlanRecord, OrchestrationState } from '../../../lib/shared-types';

interface MissionPanelProps {
  mission?: Mission | null;
  projectId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#8b949e',
  planning: '#007bff',
  ready: '#28a745',
  running: '#28a745',
  paused: '#6c757d',
  completed: '#28a745',
  failed: '#dc3545',
  cancelled: '#6c757d',
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: '#8b949e',
  active: '#007bff',
  blocked: '#fd7e14',
  completed: '#28a745',
  skipped: '#6c757d',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  blocked: 'Blocked',
  completed: 'Done',
  skipped: 'Skipped',
};

export default function MissionPanel({ mission }: MissionPanelProps) {
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [orchState, setOrchState] = useState<OrchestrationState | null>(null);
  const [loading, setLoading] = useState(false);

  // Load plan when mission changes
  useEffect(() => {
    if (!mission) {
      setPlan(null);
      setOrchState(null);
      return;
    }
    setLoading(true);
    window.vibeflow.orchestrator.getPlan(mission.id).then((p) => {
      setPlan(p);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Load orchestration state
    window.vibeflow.orchestrator.getState().then((s) => {
      setOrchState(s);
    }).catch(() => {});
  }, [mission?.id]);

  // Listen for state changes
  useEffect(() => {
    const handler = (_event: unknown, state: OrchestrationState) => {
      setOrchState(state);
    };
    // Note: Electron IPC listener setup would go here in a full implementation
    // For now we poll on mount
    return () => {};
  }, []);

  if (!mission) {
    return (
      <div style={{ color: '#484f58', fontSize: 13 }}>
        <p style={{ margin: '0 0 8px 0' }}>No active mission.</p>
        <p style={{ margin: 0 }}>Start a mission by entering a request in the conversation panel.</p>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[mission.status] ?? '#8b949e';
  const planSteps = plan?.steps ?? [];
  const completedSteps = planSteps.filter(s => s.status === 'completed').length;
  const progress = planSteps.length > 0 ? Math.round((completedSteps / planSteps.length) * 100) : 0;

  return (
    <div style={{ fontSize: 13, color: '#c9d1d9', overflow: 'auto', height: '100%' }}>
      {/* Mission Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{mission.title}</span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: statusColor + '20',
              borderRadius: 4,
              color: statusColor,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {mission.status}
          </span>
        </div>
        <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>
          {mission.operatorRequest}
        </div>
      </div>

      {/* Progress Bar */}
      {planSteps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#8b949e', fontSize: 11 }}>Progress</span>
            <span style={{ color: '#8b949e', fontSize: 11 }}>{progress}%</span>
          </div>
          <div style={{ height: 4, backgroundColor: '#30363d', borderRadius: 2 }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: '#28a745',
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Plan Steps */}
      {loading && <div style={{ color: '#8b949e', fontSize: 12 }}>Loading plan...</div>}
      {!loading && planSteps.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, color: '#8b949e', textTransform: 'uppercase' }}>
            Plan Steps ({completedSteps}/{planSteps.length})
          </div>
          {planSteps.map((step) => (
            <div
              key={step.id}
              style={{
                padding: '8px 10px',
                marginBottom: 6,
                backgroundColor: '#161b22',
                borderRadius: 6,
                border: `1px solid ${STEP_STATUS_COLORS[step.status] ?? '#30363d'}40`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 12 }}>{step.title}</span>
                <span
                  style={{
                    padding: '1px 6px',
                    backgroundColor: STEP_STATUS_COLORS[step.status] + '20',
                    borderRadius: 3,
                    color: STEP_STATUS_COLORS[step.status],
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {STEP_STATUS_LABELS[step.status] ?? step.status}
                </span>
              </div>
              {step.description && (
                <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4 }}>
                  {step.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#6e7681' }}>
                {step.riskLabel && <span>Risk: {step.riskLabel}</span>}
                {step.requiredEvidence.length > 0 && <span>Evidence: {step.requiredEvidence.length} required</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Orchestration State */}
      {orchState && orchState.status !== 'idle' && (
        <div style={{ marginTop: 12, padding: '8px 10px', backgroundColor: '#161b22', borderRadius: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: '#8b949e', textTransform: 'uppercase' }}>
            Engine Status
          </div>
          <div style={{ fontSize: 12 }}>
            Status: <span style={{ color: '#58a6ff' }}>{orchState.status}</span>
          </div>
          {orchState.error && (
            <div style={{ fontSize: 12, color: '#f85149', marginTop: 4 }}>
              Error: {orchState.error}
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      {mission.clarifiedConstraints.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: '#8b949e', textTransform: 'uppercase' }}>Constraints:</span>
          <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
            {mission.clarifiedConstraints.map((c, i) => (
              <li key={i} style={{ color: '#c9d1d9', fontSize: 12 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
