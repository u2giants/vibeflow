/** PlanPanel — displays real plan data with step status and role assignments. */

import { useState, useEffect } from 'react';
import type { PlanRecord, OrchestrationState } from '../../../lib/shared-types';

interface PlanPanelProps {
  /** Primary prop — the mission ID to load plan for. */
  missionId?: string | null;
  /** Backward compat — derived to missionId if provided. */
  mission?: { id: string } | null;
  projectId?: string;
}

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: '#8b949e',
  active: '#007bff',
  blocked: '#fd7e14',
  completed: '#28a745',
  failed: '#dc3545',
  skipped: '#6c757d',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pending',
  active: '▶ Active',
  blocked: '⛔ Blocked',
  completed: '✅ Done',
  failed: '❌ Failed',
  skipped: '⏭ Skipped',
};

const RISK_COLORS: Record<string, string> = {
  low: '#28a745',
  medium: '#ffc107',
  high: '#dc3545',
};

export default function PlanPanel({ missionId, mission }: PlanPanelProps) {
  const resolvedMissionId = missionId ?? mission?.id ?? null;
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [orchState, setOrchState] = useState<OrchestrationState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resolvedMissionId) {
      setPlan(null);
      setOrchState(null);
      return;
    }
    setLoading(true);
    window.vibeflow.orchestrator.getPlan(resolvedMissionId).then((p) => {
      setPlan(p);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    window.vibeflow.orchestrator.getState().then((s) => {
      setOrchState(s);
    }).catch(() => {});
  }, [resolvedMissionId]);

  if (!resolvedMissionId) {
    return (
      <div style={{ color: '#484f58', fontSize: 13 }}>
        <p style={{ margin: '0 0 8px 0' }}>No active mission selected.</p>
        <p style={{ margin: 0 }}>Select a mission to view its plan.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ color: '#8b949e', fontSize: 13, padding: 16 }}>
        Loading plan...
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ color: '#484f58', fontSize: 13, padding: 16 }}>
        <p style={{ margin: '0 0 8px 0' }}>No plan found for this mission.</p>
        <p style={{ margin: 0 }}>The orchestrator will create a plan when the mission starts.</p>
      </div>
    );
  }

  const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
  const totalSteps = plan.steps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div style={{ fontSize: 13, color: '#c9d1d9', overflow: 'auto', height: '100%', padding: 12 }}>
      {/* Plan Summary */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#c9d1d9' }}>
          {plan.missionSummary}
        </h4>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
          <span>{completedSteps}/{totalSteps} steps</span>
          <span>{progress}% complete</span>
        </div>
        {/* Progress Bar */}
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

      {/* Assumptions */}
      {plan.assumptions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#8b949e', textTransform: 'uppercase', marginBottom: 4 }}>
            Assumptions
          </div>
          {plan.assumptions.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: '#c9d1d9', marginBottom: 2 }}>• {a}</div>
          ))}
        </div>
      )}

      {/* Risk Classes */}
      {plan.riskClasses.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: '#8b949e', textTransform: 'uppercase', marginBottom: 4 }}>
            Risk Classes
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {plan.riskClasses.map((r, i) => (
              <span
                key={i}
                style={{
                  padding: '2px 8px',
                  backgroundColor: '#3d2e00',
                  borderRadius: 4,
                  color: '#ffc107',
                  fontSize: 11,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 11, color: '#8b949e', textTransform: 'uppercase', marginBottom: 8 }}>
          Steps
        </div>
        {plan.steps.map((step) => (
          <div
            key={step.id}
            style={{
              padding: '10px 12px',
              marginBottom: 8,
              backgroundColor: '#161b22',
              borderRadius: 6,
              border: `1px solid ${STEP_STATUS_COLORS[step.status] ?? '#30363d'}40`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 500, fontSize: 12 }}>
                {step.order}. {step.title}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  backgroundColor: STEP_STATUS_COLORS[step.status] + '20',
                  borderRadius: 4,
                  color: STEP_STATUS_COLORS[step.status],
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {STEP_STATUS_LABELS[step.status] ?? step.status}
              </span>
            </div>
            {step.description && (
              <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>
                {step.description}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#6e7681', flexWrap: 'wrap' }}>
              {step.assignedRole && (
                <span>Role: <span style={{ color: '#58a6ff' }}>{step.assignedRole}</span></span>
              )}
              {step.riskLabel && (
                <span style={{ color: RISK_COLORS[step.riskLabel] ?? '#8b949e' }}>
                  Risk: {step.riskLabel}
                </span>
              )}
              {step.requiresApproval && <span>🔒 Requires approval</span>}
              {step.retryCount > 0 && <span>Retries: {step.retryCount}/{step.maxRetries}</span>}
            </div>
            {step.error && (
              <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>
                Error: {step.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Engine Status */}
      {orchState && orchState.status !== 'idle' && (
        <div style={{ marginTop: 12, padding: '8px 10px', backgroundColor: '#161b22', borderRadius: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: '#8b949e', textTransform: 'uppercase' }}>
            Engine
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
    </div>
  );
}
