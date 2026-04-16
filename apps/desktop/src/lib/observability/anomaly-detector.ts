/**
 * AnomalyDetector — pure functions for anomaly detection logic.
 *
 * Evaluates probe results against thresholds, classifies anomaly types,
 * calculates severity, and determines if incidents should be opened.
 */

import type {
  WatchProbe, WatchSession, AnomalyEvent, IncidentSeverity,
  Environment, DeployWorkflow, DriftReport,
} from '../shared-types';

/** Input for anomaly detection. */
export interface AnomalyDetectionInput {
  probes: WatchProbe[];
  session: WatchSession;
  environment: Environment;
  recentDriftReports: DriftReport[];
  recentDeployWorkflow: DeployWorkflow | null;
}

/** Result of anomaly detection. */
export interface AnomalyDetectionResult {
  anomalies: AnomalyEvent[];
  shouldOpenIncident: boolean;
}

/**
 * Detect anomalies from current probe results and environmental signals.
 * Returns a list of new anomaly events and whether an incident should be opened.
 */
export function detectAnomalies(input: AnomalyDetectionInput): AnomalyDetectionResult {
  const anomalies: AnomalyEvent[] = [];
  const now = new Date().toISOString();

  // Check 1: Health check probe failures
  const healthProbe = input.probes.find((p) => p.type === 'health-check' && !p.disabled);
  if (healthProbe && healthProbe.status === 'fail') {
    const severity = calculateHealthSeverity(healthProbe.failureCount, input.environment.type);
    anomalies.push({
      id: `anomaly-health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.session.projectId,
      environmentId: input.environment.id,
      watchSessionId: input.session.id,
      anomalyType: 'health-degradation',
      severity,
      description: `Health check failed ${healthProbe.failureCount} consecutive time(s) on ${input.environment.name}. Last result: ${healthProbe.lastResult ?? 'unknown'}`,
      correlatedDeployWorkflowId: input.session.deployWorkflowId,
      correlatedChangeIds: [],
      evidenceIds: [],
      detectedAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
  } else if (healthProbe && healthProbe.status === 'warning') {
    anomalies.push({
      id: `anomaly-health-warn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.session.projectId,
      environmentId: input.environment.id,
      watchSessionId: input.session.id,
      anomalyType: 'health-degradation',
      severity: 'low',
      description: `Health check returned warning on ${input.environment.name}: ${healthProbe.lastResult ?? 'unknown'}`,
      correlatedDeployWorkflowId: input.session.deployWorkflowId,
      correlatedChangeIds: [],
      evidenceIds: [],
      detectedAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
  }

  // Check 2: Unresolved drift reports
  const unresolvedDrift = input.recentDriftReports.filter((d) => !d.resolved);
  if (unresolvedDrift.length > 0) {
    const criticalDrift = unresolvedDrift.filter((d) => d.severity === 'critical');
    const severity: IncidentSeverity = criticalDrift.length > 0 ? 'high' : 'medium';
    anomalies.push({
      id: `anomaly-drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.session.projectId,
      environmentId: input.environment.id,
      watchSessionId: input.session.id,
      anomalyType: 'drift-detected',
      severity,
      description: `${unresolvedDrift.length} unresolved drift report(s) on ${input.environment.name}. ${criticalDrift.length} critical.`,
      correlatedDeployWorkflowId: input.session.deployWorkflowId,
      correlatedChangeIds: [],
      evidenceIds: [],
      detectedAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
  }

  // Check 3: Deploy workflow failure correlation
  if (input.recentDeployWorkflow && input.recentDeployWorkflow.status === 'failed') {
    anomalies.push({
      id: `anomaly-deploy-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.session.projectId,
      environmentId: input.environment.id,
      watchSessionId: input.session.id,
      anomalyType: 'evidence-gap',
      severity: input.environment.type === 'production' ? 'critical' : 'high',
      description: `Recent deploy workflow failed on ${input.environment.name}: ${input.recentDeployWorkflow.verdictReason ?? 'no reason provided'}`,
      correlatedDeployWorkflowId: input.recentDeployWorkflow.id,
      correlatedChangeIds: [],
      evidenceIds: input.recentDeployWorkflow.evidenceIds,
      detectedAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
  }

  // Determine if an incident should be opened
  const shouldOpenIncident = anomalies.some((a) => {
    if (input.environment.type === 'production') {
      return a.severity === 'high' || a.severity === 'critical';
    }
    return a.severity === 'critical';
  });

  return { anomalies, shouldOpenIncident };
}

/**
 * Determine if a probe should be auto-disabled based on consecutive failures.
 * Probes are disabled after 5+ consecutive failures, unless it's a health-check on production.
 */
export function shouldDisableProbe(probe: WatchProbe): boolean {
  if (probe.disabled) return false;
  if (probe.failureCount < 5) return false;
  // Never auto-disable production health checks — that's too risky
  if (probe.type === 'health-check') return false;
  return true;
}

/**
 * Classify what self-healing action should be taken for an anomaly.
 * Returns the action type and whether approval is required.
 */
export function classifySelfHealingAction(
  anomaly: AnomalyEvent,
  environmentType: string
): { actionType: 'restart-preview' | 'rerun-checks' | 'disable-probe' | 'notify-and-prepare-rollback' | 'rollback'; approvalRequired: boolean } {
  // Production + critical/high severity → notify and prepare rollback (requires approval for actual rollback)
  if (environmentType === 'production' && (anomaly.severity === 'high' || anomaly.severity === 'critical')) {
    return { actionType: 'notify-and-prepare-rollback', approvalRequired: true };
  }

  // Production + medium severity → rerun checks
  if (environmentType === 'production' && anomaly.severity === 'medium') {
    return { actionType: 'rerun-checks', approvalRequired: false };
  }

  // Preview + health degradation → restart preview
  if (environmentType === 'preview' && anomaly.anomalyType === 'health-degradation') {
    return { actionType: 'restart-preview', approvalRequired: false };
  }

  // Default: rerun non-destructive checks
  return { actionType: 'rerun-checks', approvalRequired: false };
}

/** Calculate severity based on failure count and environment type. */
function calculateHealthSeverity(failureCount: number, environmentType: string): IncidentSeverity {
  if (environmentType === 'production') {
    if (failureCount >= 5) return 'critical';
    if (failureCount >= 3) return 'high';
    if (failureCount >= 2) return 'medium';
    return 'low';
  }
  // Preview/staging: more tolerant
  if (failureCount >= 10) return 'high';
  if (failureCount >= 5) return 'medium';
  return 'low';
}
