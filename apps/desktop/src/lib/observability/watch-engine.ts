/**
 * WatchEngine — primary orchestrator for Component 21 observability.
 *
 * Manages watch session lifecycle, probe execution, anomaly detection,
 * incident creation, and self-healing action triggering.
 */

import type {
  WatchSession, WatchProbe, AnomalyEvent, Incident, IncidentSeverity,
  SelfHealingAction, Environment, DeployWorkflow, DriftReport,
  CapabilityHealth,
} from '../shared-types';
import { LocalDb } from '../storage';
import { runHealthCheck } from '../devops/health-check';
import { DriftDetector } from '../drift-detector';
import { EvidenceCaptureEngine } from '../runtime-execution/evidence-capture-engine';
import { detectAnomalies, shouldDisableProbe, classifySelfHealingAction } from './anomaly-detector';
import { SelfHealingEngine } from './self-healing-engine';

export class WatchEngine {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private selfHealingEngine: SelfHealingEngine;

  constructor(
    private db: LocalDb,
    private driftDetector: DriftDetector,
    private evidenceEngine: EvidenceCaptureEngine,
    private mainWindow: Electron.BrowserWindow | null
  ) {
    this.selfHealingEngine = new SelfHealingEngine(db, mainWindow);
  }

  /** Start a watch session after a deploy completes. */
  async startSession(args: {
    deployWorkflowId: string;
    environmentId: string;
    projectId: string;
  }): Promise<WatchSession> {
    const now = new Date().toISOString();
    const env = this.db.getEnvironment(args.environmentId);
    if (!env) throw new Error(`Environment ${args.environmentId} not found`);

    // Create default probes based on environment configuration
    const probes: WatchProbe[] = [];

    // Health check probe if endpoint configured
    if (env.healthEndpoint) {
      probes.push({
        id: `probe-health-${Date.now()}`,
        watchSessionId: '', // set after session creation
        type: 'health-check',
        url: env.healthEndpoint,
        description: `Health check for ${env.name} environment`,
        status: 'pending',
        lastResult: null,
        lastCheckedAt: null,
        failureCount: 0,
        disabled: false,
      });
    }

    // Drift check probe
    probes.push({
      id: `probe-drift-${Date.now()}`,
      watchSessionId: '',
      type: 'drift-check',
      url: null,
      description: `Drift detection for ${env.name} environment`,
      status: 'pending',
      lastResult: null,
      lastCheckedAt: null,
      failureCount: 0,
      disabled: false,
    });

    // Create the session
    const session: WatchSession = {
      id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: args.projectId,
      environmentId: args.environmentId,
      deployWorkflowId: args.deployWorkflowId,
      status: 'active',
      startedAt: now,
      completedAt: null,
      elevatedEvidence: true,
      anomalyThreshold: env.type === 'production' ? 'critical' : 'elevated',
      probes,
      regressionBaseline: null,
    };

    // Assign session ID to probes
    for (const probe of session.probes) {
      probe.watchSessionId = session.id;
    }

    this.db.upsertWatchSession(session);

    // Broadcast session started
    this.broadcast('watch:sessionStarted', session);

    // Start probe execution loop
    this.startProbeLoop(session);

    return session;
  }

  /** Stop a watch session. */
  stopSession(sessionId: string): { success: boolean } {
    const session = this.db.getWatchSession(sessionId);
    if (!session) return { success: false };

    // Clear timer
    const timer = this.activeTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(sessionId);
    }

    this.db.completeWatchSession(sessionId);
    this.broadcast('watch:sessionCompleted', session);

    return { success: true };
  }

  /** Get a watch session by ID. */
  getSession(sessionId: string): WatchSession | null {
    return this.db.getWatchSession(sessionId);
  }

  /** List watch sessions for a project. */
  listSessions(projectId: string): WatchSession[] {
    return this.db.listWatchSessions(projectId);
  }

  /** Get the watch dashboard for a project. */
  getDashboard(projectId: string) {
    const dashboardData = this.db.getWatchDashboard(projectId);

    // Calculate environment health
    const environmentHealth: Record<string, CapabilityHealth> = {};
    for (const session of dashboardData.activeSessions) {
      const env = this.db.getEnvironment(session.environmentId);
      if (env) {
        const failingProbes = session.probes.filter((p) => p.status === 'fail').length;
        const totalProbes = session.probes.filter((p) => !p.disabled).length;
        if (totalProbes === 0) {
          environmentHealth[session.environmentId] = 'unknown';
        } else if (failingProbes === 0) {
          environmentHealth[session.environmentId] = 'healthy';
        } else if (failingProbes <= totalProbes / 2) {
          environmentHealth[session.environmentId] = 'degraded';
        } else {
          environmentHealth[session.environmentId] = 'offline';
        }
      }
    }

    return {
      ...dashboardData,
      environmentHealth,
    };
  }

  /** Start the probe execution loop for a session. */
  private startProbeLoop(session: WatchSession): void {
    // Run probes every 30 seconds for active sessions
    const intervalMs = 30_000;

    const timer = setInterval(async () => {
      const currentSession = this.db.getWatchSession(session.id);
      if (!currentSession || currentSession.status !== 'active') {
        clearInterval(timer);
        this.activeTimers.delete(session.id);
        return;
      }

      await this.runProbes(currentSession);
    }, intervalMs);

    this.activeTimers.set(session.id, timer);

    // Run probes immediately on start
    this.runProbes(session).catch((err) => {
      console.error('[WatchEngine] Initial probe run failed:', err);
    });
  }

  /** Run all probes for a session and process results. */
  private async runProbes(session: WatchSession): Promise<void> {
    const env = this.db.getEnvironment(session.environmentId);
    if (!env) return;

    const updatedProbes = [...session.probes];

    for (const probe of updatedProbes) {
      if (probe.disabled) continue;

      probe.status = 'running';
      probe.lastCheckedAt = new Date().toISOString();

      try {
        switch (probe.type) {
          case 'health-check':
            await this.runHealthCheckProbe(probe, env);
            break;
          case 'drift-check':
            await this.runDriftCheckProbe(probe, env, session);
            break;
          case 'synthetic-check':
            // Scaffolded — not executed in this pass
            probe.status = 'pass';
            probe.lastResult = 'Synthetic checks are scaffolded — not yet executed';
            break;
          case 'evidence-check':
            // Scaffolded — not executed in this pass
            probe.status = 'pass';
            probe.lastResult = 'Evidence checks are scaffolded — not yet executed';
            break;
        }
      } catch (err) {
        probe.status = 'fail';
        probe.lastResult = String(err);
        probe.failureCount += 1;
      }
    }

    // Update session with new probe states
    session.probes = updatedProbes;
    this.db.upsertWatchSession(session);

    // Run anomaly detection
    await this.processAnomalies(session, env);
  }

  /** Run a health check probe. */
  private async runHealthCheckProbe(probe: WatchProbe, env: Environment): Promise<void> {
    if (!probe.url) {
      probe.status = 'warning';
      probe.lastResult = 'No health check URL configured';
      return;
    }

    const result = await runHealthCheck(probe.url);

    if (result.status === 'healthy') {
      probe.status = 'pass';
      probe.lastResult = `HTTP ${result.httpStatus} in ${result.responseTimeMs}ms`;
      probe.failureCount = 0; // Reset on success
    } else if (result.status === 'unhealthy') {
      probe.status = 'warning';
      probe.lastResult = `HTTP ${result.httpStatus} — unhealthy response`;
      probe.failureCount += 1;
    } else {
      probe.status = 'fail';
      probe.lastResult = result.error ?? 'Unreachable';
      probe.failureCount += 1;
    }

    // Record evidence if elevated
    if (probe.status !== 'pass') {
      this.recordProbeEvidence(probe, env);
    }
  }

  /** Run a drift check probe. */
  private async runDriftCheckProbe(probe: WatchProbe, env: Environment, session: WatchSession): Promise<void> {
    const driftReports = await this.driftDetector.detectDrift(env.projectId, [env]);
    const unresolvedDrift = driftReports.filter((d) => !d.resolved);

    if (unresolvedDrift.length === 0) {
      probe.status = 'pass';
      probe.lastResult = 'No drift detected';
      probe.failureCount = 0;
    } else {
      probe.status = 'warning';
      probe.lastResult = `${unresolvedDrift.length} unresolved drift report(s) detected`;
      probe.failureCount += 1;
    }
  }

  /** Process anomalies from current probe results. */
  private async processAnomalies(session: WatchSession, env: Environment): Promise<void> {
    const recentDrift = this.db.listDriftReports(env.projectId).slice(0, 10);
    const recentDeploy = this.db.getDeployWorkflow(session.deployWorkflowId);

    const detectionResult = detectAnomalies({
      probes: session.probes,
      session,
      environment: env,
      recentDriftReports: recentDrift,
      recentDeployWorkflow: recentDeploy ?? null,
    });

    // Persist anomaly events
    for (const anomaly of detectionResult.anomalies) {
      this.db.insertAnomalyEvent(anomaly);
      this.broadcast('watch:anomalyDetected', anomaly);

      // Open incident if threshold exceeded
      if (detectionResult.shouldOpenIncident) {
        await this.openIncident(anomaly, env, session);
      }
    }

    // Check for probes that should be auto-disabled
    for (const probe of session.probes) {
      if (shouldDisableProbe(probe) && !probe.disabled) {
        probe.disabled = true;
        probe.status = 'disabled';
        this.db.upsertWatchSession(session);

        // Log self-healing action
        await this.selfHealingEngine.executeAutomaticAction({
          actionType: 'disable-probe',
          projectId: session.projectId,
          environmentId: session.environmentId,
          anomalyEventId: null,
          incidentId: null,
          description: `Auto-disabled probe "${probe.description}" after ${probe.failureCount} consecutive failures`,
        });
      }
    }

    // Trigger self-healing for anomalies
    for (const anomaly of detectionResult.anomalies) {
      await this.selfHealingEngine.processAnomaly(anomaly, env.type);
    }
  }

  /** Open an incident for a high-severity anomaly. */
  private async openIncident(
    anomaly: AnomalyEvent,
    env: Environment,
    session: WatchSession
  ): Promise<void> {
    // Check if there's already an open incident for this anomaly type + environment
    const existingIncidents = this.db.listIncidents(session.projectId)
      .filter((i) =>
        i.environmentId === env.id &&
        (i.status === 'open' || i.status === 'investigating') &&
        i.watchModeActive
      );

    if (existingIncidents.length > 0) {
      // Update existing incident
      const existing = existingIncidents[0];
      this.db.updateIncident(existing.id, {
        severity: this.maxSeverity(existing.severity, anomaly.severity),
        description: `${existing.description}\n\nAdditional anomaly: ${anomaly.description}`,
      });
      return;
    }

    // Create new incident
    const { actionType } = classifySelfHealingAction(anomaly, env.type);
    const incident: Incident = {
      id: `incident-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: session.projectId,
      title: `${anomaly.anomalyType} detected on ${env.name}`,
      severity: anomaly.severity,
      description: anomaly.description,
      status: 'investigating',
      detectedAt: anomaly.detectedAt,
      resolvedAt: null,
      environmentId: env.id,
      deployWorkflowId: session.deployWorkflowId,
      evidenceIds: anomaly.evidenceIds,
      correlatedChangeIds: anomaly.correlatedChangeIds,
      recommendedAction: this.getRecommendedAction(anomaly, env),
      selfHealingAttempted: false,
      selfHealingResult: null,
      watchModeActive: true,
    };

    this.db.insertIncident(incident);
    this.broadcast('incident:opened', incident);
  }

  /** Get a plain-English recommended action for an incident. */
  private getRecommendedAction(anomaly: AnomalyEvent, env: Environment): string {
    if (env.type === 'production' && (anomaly.severity === 'high' || anomaly.severity === 'critical')) {
      return 'Production issue detected. Review the correlated deploy and consider rollback. Evidence has been collected for analysis.';
    }
    if (anomaly.anomalyType === 'health-degradation') {
      return `Service health is degraded on ${env.name}. Check the health endpoint and review recent deploy logs.`;
    }
    if (anomaly.anomalyType === 'drift-detected') {
      return `Configuration drift detected on ${env.name}. Review the drift reports and reconcile differences.`;
    }
    if (anomaly.anomalyType === 'synthetic-failure') {
      return `Synthetic check failed on ${env.name}. Investigate the affected functionality.`;
    }
    return `Anomaly detected on ${env.name}. Review the evidence and determine if action is needed.`;
  }

  /** Return the higher of two severity levels. */
  private maxSeverity(a: IncidentSeverity, b: IncidentSeverity): IncidentSeverity {
    const order: Record<IncidentSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return order[a] >= order[b] ? a : b;
  }

  /** Record evidence from a probe result. */
  private recordProbeEvidence(probe: WatchProbe, env: Environment): void {
    // Scaffolded — in a full implementation, this would create EvidenceRecord entries
    // For now, we log visibly so the operator knows evidence collection is active
    console.log(`[WatchEngine] Evidence recorded: ${probe.type} probe on ${env.name} — ${probe.lastResult}`);
  }

  /** Broadcast an event to the renderer. */
  private broadcast(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /** Stop all active watch sessions and clear timers. */
  stopAll(): void {
    for (const [sessionId, timer] of this.activeTimers) {
      clearInterval(timer);
      this.db.completeWatchSession(sessionId);
    }
    this.activeTimers.clear();
  }
}
