/** DriftDetector — detects and surfaces environment drift for Component 17. */

import type { DriftReport, Environment, SecretRecord } from './shared-types';
import { LocalDb } from './storage';
import { SecretsStore } from './secrets/secrets-store';

export class DriftDetector {
  constructor(
    private db: LocalDb,
    private secretsStore: SecretsStore
  ) {}

  /** Run drift detection for all environments in a project. */
  async detectDrift(projectId: string, environments: Environment[]): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];
    const now = new Date().toISOString();

    for (const env of environments) {
      // Check 1: Missing secrets
      const missingSecrets = await this.checkMissingSecrets(projectId, env);
      reports.push(...missingSecrets);

      // Check 2: Version mismatch
      const versionMismatch = await this.checkVersionMismatch(env, now);
      reports.push(...versionMismatch);

      // Check 3: Config drift
      const configDrift = await this.checkConfigDrift(env, now);
      reports.push(...configDrift);

      // Check 4: Schema mismatch
      const schemaMismatch = await this.checkSchemaMismatch(projectId, env, now);
      reports.push(...schemaMismatch);

      // Check 5: Auth drift
      const authDrift = await this.checkAuthDrift(env, now);
      reports.push(...authDrift);
    }

    // Persist reports
    for (const report of reports) {
      this.db.insertDriftReport(report);
    }

    return reports;
  }

  /** Get existing drift reports for a project. */
  getReports(projectId: string): DriftReport[] {
    return this.db.listDriftReports(projectId);
  }

  /** Resolve a drift report. */
  resolveReport(reportId: string): void {
    this.db.resolveDriftReport(reportId);
  }

  /** Check for missing secrets in an environment. */
  private async checkMissingSecrets(projectId: string, env: Environment): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];
    const missingSecrets = this.db.getMissingSecretsForEnvironment(projectId, env.id);

    for (const secret of missingSecrets) {
      reports.push({
        id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        environmentId: env.id,
        driftType: 'missing-secret',
        severity: 'critical',
        description: `Secret "${secret.keyName}" is required but missing in environment "${env.name}"`,
        detectedAt: new Date().toISOString(),
        resolved: false,
      });
    }

    return reports;
  }

  /** Check for version mismatches. */
  private async checkVersionMismatch(env: Environment, now: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    // If environment has a version but no deploy candidate matches, flag it
    if (env.currentVersion) {
      const candidates = this.db.listDeployCandidates(env.projectId);
      const matchingCandidate = candidates.find((c) => c.version === env.currentVersion && c.environmentId === env.id);

      if (!matchingCandidate) {
        reports.push({
          id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          projectId: env.projectId,
          environmentId: env.id,
          driftType: 'version-mismatch',
          severity: 'warning',
          description: `Environment "${env.name}" reports version "${env.currentVersion}" but no matching deploy candidate found`,
          detectedAt: now,
          resolved: false,
        });
      }
    }

    return reports;
  }

  /** Check for config drift. */
  private async checkConfigDrift(env: Environment, now: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    // Check if environment has required secrets defined
    if (env.requiredSecrets && env.requiredSecrets.length > 0) {
      const allSecrets = this.db.listSecretRecords(env.projectId);
      const definedKeys = new Set(allSecrets.map((s) => s.keyName));

      for (const requiredKey of env.requiredSecrets) {
        if (!definedKeys.has(requiredKey)) {
          reports.push({
            id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            projectId: env.projectId,
            environmentId: env.id,
            driftType: 'config-drift',
            severity: 'warning',
            description: `Required secret "${requiredKey}" is not defined in the secrets inventory for environment "${env.name}"`,
            detectedAt: now,
            resolved: false,
          });
        }
      }
    }

    return reports;
  }

  /** Check for schema mismatch. */
  private async checkSchemaMismatch(projectId: string, env: Environment, now: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    // Check if there are pending migrations
    const migrationHistory = this.db.listMigrationHistory(projectId);
    if (migrationHistory.length === 0) {
      // No migrations tracked — informational only
      reports.push({
        id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        environmentId: env.id,
        driftType: 'schema-mismatch',
        severity: 'info',
        description: `No migration history tracked for project — schema state unknown for environment "${env.name}"`,
        detectedAt: now,
        resolved: false,
      });
    }

    return reports;
  }

  /** Check for auth drift. */
  private async checkAuthDrift(env: Environment, now: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    // If environment has a deploy mechanism but no health endpoint, flag it
    if (env.deployMechanism && !env.healthEndpoint) {
      reports.push({
        id: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: env.projectId,
        environmentId: env.id,
        driftType: 'auth-drift',
        severity: 'info',
        description: `Environment "${env.name}" uses "${env.deployMechanism}" but has no health endpoint configured`,
        detectedAt: now,
        resolved: false,
      });
    }

    return reports;
  }
}
