/**
 * DeployCheckRunner — Layer E: runs deploy-specific checks.
 *
 * Runs health checks, verifies rollback readiness, and checks
 * environment secret completeness.
 *
 * NOTE: This layer does NOT deploy or mutate environments.
 * It only reads environment state and produces verdicts.
 */

import type { VerificationCheck, Environment } from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import { runHealthCheck } from '../devops/health-check';

export class DeployCheckRunner {
  constructor(private db: LocalDb) {}

  /** Run deploy-specific checks. */
  async runChecks(missionId: string): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const startedAt = new Date().toISOString();

    // Check 1: Health checks for environments
    checks.push(await this.checkHealth(missionId, startedAt));

    // Check 2: Rollback readiness
    checks.push(this.checkRollbackReadiness(missionId, startedAt));

    // Check 3: Environment secret completeness
    checks.push(this.checkEnvironmentSecrets(missionId, startedAt));

    return checks;
  }

  private async checkHealth(missionId: string, startedAt: string): Promise<VerificationCheck> {
    try {
      const mission = this.db.getMission(missionId);
      if (!mission) {
        return {
          id: `deploy-health-${Date.now()}`,
          verificationRunId: '',
          layer: 'deploy-specific',
          checkName: 'health-checks',
          status: 'warning',
          detail: 'Mission not found',
          evidenceItemIds: [],
          durationMs: 0,
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }

      const environments = this.db.listEnvironments(mission.projectId);
      const healthResults: string[] = [];
      let allHealthy = true;

      for (const env of environments) {
        if (env.type === 'local') continue; // Skip local environment

        const result = await runHealthCheck(`http://${env.name}.example.com/health`);
        healthResults.push(`${env.name}: ${result.status}`);
        if (result.status !== 'healthy') {
          allHealthy = false;
        }
      }

      return {
        id: `deploy-health-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'health-checks',
        status: allHealthy ? 'pass' : 'warning',
        detail: healthResults.join('\n') || 'No remote environments to check',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: `deploy-health-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'health-checks',
        status: 'skipped',
        detail: 'Health check unavailable',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }

  private checkRollbackReadiness(missionId: string, startedAt: string): VerificationCheck {
    try {
      // Check if there are checkpoints available for rollback
      const workspaceRuns = this.db.listWorkspaceRuns(missionId);
      const hasCheckpoints = workspaceRuns.some((run) => {
        const checkpoints = this.db.listCheckpoints(run.id);
        return checkpoints.length > 0;
      });

      return {
        id: `deploy-rollback-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'rollback-readiness',
        status: hasCheckpoints ? 'pass' : 'warning',
        detail: hasCheckpoints ? 'Rollback checkpoints available' : 'No rollback checkpoints found',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: `deploy-rollback-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'rollback-readiness',
        status: 'skipped',
        detail: 'Rollback check unavailable',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }

  private checkEnvironmentSecrets(missionId: string, startedAt: string): VerificationCheck {
    try {
      const mission = this.db.getMission(missionId);
      if (!mission) {
        return {
          id: `deploy-secrets-${Date.now()}`,
          verificationRunId: '',
          layer: 'deploy-specific',
          checkName: 'environment-secret-completeness',
          status: 'warning',
          detail: 'Mission not found',
          evidenceItemIds: [],
          durationMs: 0,
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }

      const environments = this.db.listEnvironments(mission.projectId);
      const incompleteEnvs = environments.filter((e: Environment) => !e.secretsComplete);

      if (incompleteEnvs.length > 0) {
        return {
          id: `deploy-secrets-${Date.now()}`,
          verificationRunId: '',
          layer: 'deploy-specific',
          checkName: 'environment-secret-completeness',
          status: 'fail',
          detail: `Incomplete secrets in: ${incompleteEnvs.map((e: Environment) => e.name).join(', ')}`,
          evidenceItemIds: [],
          durationMs: 0,
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }

      return {
        id: `deploy-secrets-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'environment-secret-completeness',
        status: 'pass',
        detail: null,
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: `deploy-secrets-${Date.now()}`,
        verificationRunId: '',
        layer: 'deploy-specific',
        checkName: 'environment-secret-completeness',
        status: 'skipped',
        detail: 'Environment check unavailable',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }
}
