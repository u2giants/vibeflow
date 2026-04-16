/**
 * VerificationEngine — orchestrates the five verification layers (A–E).
 *
 * Coordinates:
 * - Layer A: Instant validity (wraps ValidityPipeline)
 * - Layer B: Impacted technical checks (ImpactedTestRunner)
 * - Layer C: Acceptance flows (AcceptanceFlowRunner)
 * - Layer D: Policy and safety checks (PolicyCheckRunner)
 * - Layer E: Deploy-specific checks (DeployCheckRunner)
 *
 * Produces a VerificationRun with verdict (promote/block/needs-review).
 */

import type {
  VerificationRun,
  VerificationCheck,
  VerificationBundle,
  RiskAssessment,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import type { ValidityPipeline } from '../change-engine/validity-pipeline';
import type { EvidenceCaptureEngine } from '../runtime-execution/evidence-capture-engine';
import type { BrowserAutomationService } from '../runtime-execution/browser-automation-service';
import { DEFAULT_VERIFICATION_BUNDLES } from './verification-bundles';
import { ImpactedTestRunner } from './impacted-test-runner';
import { AcceptanceFlowRunner } from './acceptance-flow-runner';
import { PolicyCheckRunner } from './policy-check-runner';
import { DeployCheckRunner } from './deploy-check-runner';

export class VerificationEngine {
  private impactedTestRunner: ImpactedTestRunner;
  private acceptanceFlowRunner: AcceptanceFlowRunner;
  private policyCheckRunner: PolicyCheckRunner;
  private deployCheckRunner: DeployCheckRunner;

  constructor(
    private db: LocalDb,
    private validityPipeline: ValidityPipeline,
    private evidenceEngine: EvidenceCaptureEngine,
    private browserService: BrowserAutomationService
  ) {
    this.impactedTestRunner = new ImpactedTestRunner();
    this.acceptanceFlowRunner = new AcceptanceFlowRunner(browserService);
    this.policyCheckRunner = new PolicyCheckRunner(db);
    this.deployCheckRunner = new DeployCheckRunner(db);
  }

  /** Seed default verification bundles into the database. */
  seedDefaultBundles(): void {
    for (const bundle of DEFAULT_VERIFICATION_BUNDLES) {
      this.db.upsertVerificationBundle(bundle);
    }
  }

  /** Select the appropriate verification bundle for a risk class. */
  selectBundle(riskClass: 'low' | 'medium' | 'high' | 'destructive'): VerificationBundle {
    const bundle = this.db.getVerificationBundle(`bundle-${riskClass}`);
    if (bundle) return bundle;

    // Fallback to in-memory defaults
    return DEFAULT_VERIFICATION_BUNDLES.find((b) => b.riskClass === riskClass)
      ?? DEFAULT_VERIFICATION_BUNDLES.find((b) => b.riskClass === 'medium')!;
  }

  /** Run a full verification for a mission. */
  async runVerification(args: {
    missionId: string;
    workspaceRunId?: string;
    changesetId?: string;
    candidateId?: string;
    bundleId?: string;
    riskClass?: 'low' | 'medium' | 'high' | 'destructive';
    affectedFiles?: string[];
    workspacePath?: string;
    baseUrl?: string;
    riskAssessment?: RiskAssessment | null;
  }): Promise<VerificationRun> {
    const startedAt = new Date().toISOString();
    const bundleId = args.bundleId ?? `bundle-${args.riskClass ?? 'medium'}`;
    const bundle = this.selectBundle(args.riskClass ?? 'medium');

    const run: VerificationRun = {
      id: `verif-${args.missionId}-${Date.now()}`,
      missionId: args.missionId,
      workspaceRunId: args.workspaceRunId ?? null,
      changesetId: args.changesetId ?? null,
      candidateId: args.candidateId ?? null,
      bundleId,
      overallStatus: 'running',
      checks: [],
      missingRequiredChecks: [],
      flakeSuspicions: [],
      riskImpact: (args.riskClass === 'destructive' ? 'critical' : args.riskClass) ?? 'medium',
      startedAt,
      completedAt: null,
      verdict: null,
      verdictReason: null,
    };

    // Persist initial run
    this.db.upsertVerificationRun(run);

    const allChecks: VerificationCheck[] = [];

    // Layer A: Instant Validity (always runs)
    if (bundle.requiredLayers.includes('instant-validity') && args.workspacePath && args.affectedFiles) {
      const layerAChecks = this.runLayerA(args.workspacePath, args.affectedFiles, run.id);
      allChecks.push(...layerAChecks);
    }

    // Layer B: Impacted Tests
    if (bundle.requiredLayers.includes('impacted-tests') && args.workspacePath && args.affectedFiles) {
      const layerBChecks = this.impactedTestRunner.runTests(args.workspacePath, args.affectedFiles);
      allChecks.push(...layerBChecks.map((c) => ({ ...c, verificationRunId: run.id })));
    }

    // Layer C: Acceptance Flows
    if (bundle.requiredLayers.includes('acceptance-flow') && args.baseUrl) {
      const acceptanceCriteria = this.db.getAcceptanceCriteria(args.missionId);
      const paths = acceptanceCriteria?.pathsThatMustStillWork ?? [];
      const layerCChecks = await this.acceptanceFlowRunner.runFlows(
        args.missionId,
        args.workspaceRunId ?? '',
        paths,
        args.baseUrl
      );
      allChecks.push(...layerCChecks.map((c) => ({ ...c, verificationRunId: run.id })));
    }

    // Layer D: Policy and Safety
    if (bundle.requiredLayers.includes('policy-safety')) {
      const layerDChecks = this.policyCheckRunner.runChecks(args.missionId, args.riskAssessment ?? null);
      allChecks.push(...layerDChecks.map((c) => ({ ...c, verificationRunId: run.id })));
    }

    // Layer E: Deploy-Specific
    if (bundle.requiredLayers.includes('deploy-specific')) {
      const layerEChecks = await this.deployCheckRunner.runChecks(args.missionId);
      allChecks.push(...layerEChecks.map((c) => ({ ...c, verificationRunId: run.id })));
    }

    // Aggregate results
    run.checks = allChecks;
    run.overallStatus = this.computeOverallStatus(allChecks, bundle);
    run.missingRequiredChecks = this.findMissingChecks(allChecks, bundle);
    run.completedAt = new Date().toISOString();

    // Generate verdict
    const verdictResult = this.generateVerdict(run, bundle);
    run.verdict = verdictResult.verdict;
    run.verdictReason = verdictResult.reason;

    // Persist final run
    this.db.upsertVerificationRun(run);

    // Persist individual checks
    for (const check of allChecks) {
      this.db.upsertVerificationCheck(check);
    }

    return run;
  }

  /** Layer A: Instant Validity — wraps ValidityPipeline. */
  private runLayerA(workspacePath: string, affectedFiles: string[], runId: string): VerificationCheck[] {
    const checks: VerificationCheck[] = [];
    const startedAt = new Date().toISOString();

    // Run minimal validation set
    const evidenceItems = this.validityPipeline.runMinimalValidationSet(affectedFiles, workspacePath);

    for (const item of evidenceItems) {
      checks.push({
        id: `layer-a-${item.id}`,
        verificationRunId: runId,
        layer: 'instant-validity',
        checkName: item.title,
        status: item.status as VerificationCheck['status'],
        detail: item.detail,
        evidenceItemIds: [item.id],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    }

    return checks;
  }

  /** Compute overall status from check results. */
  private computeOverallStatus(checks: VerificationCheck[], bundle: VerificationBundle): VerificationRun['overallStatus'] {
    const requiredLayers = new Set(bundle.requiredLayers);
    const layerResults = new Map<string, 'pass' | 'fail' | 'warning' | 'skipped'>();

    for (const check of checks) {
      const existing = layerResults.get(check.layer);
      if (check.status === 'fail') {
        layerResults.set(check.layer, 'fail');
      } else if (check.status === 'warning' && existing !== 'fail') {
        layerResults.set(check.layer, 'warning');
      } else if (!existing) {
        layerResults.set(check.layer, check.status === 'skipped' ? 'skipped' : 'pass');
      }
    }

    // Check if any required layer failed
    for (const layer of requiredLayers) {
      const result = layerResults.get(layer);
      if (result === 'fail') return 'fail';
    }

    // Check if any required layer was skipped
    for (const layer of requiredLayers) {
      const result = layerResults.get(layer);
      if (result === 'skipped') return 'blocked';
    }

    // Check for warnings
    for (const [, result] of layerResults) {
      if (result === 'warning') return 'pass'; // pass with warnings
    }

    return 'pass';
  }

  /** Find missing required checks. */
  private findMissingChecks(checks: VerificationCheck[], bundle: VerificationBundle): string[] {
    const missing: string[] = [];
    const executedLayers = new Set(checks.map((c) => c.layer));

    for (const layer of bundle.requiredLayers) {
      if (!executedLayers.has(layer)) {
        missing.push(layer);
      }
    }

    return missing;
  }

  /** Generate a verdict (promote/block/needs-review) with reason. */
  generateVerdict(run: VerificationRun, bundle: VerificationBundle): { verdict: VerificationRun['verdict']; reason: string } {
    // Block if overall status is fail
    if (run.overallStatus === 'fail') {
      const failedChecks = run.checks.filter((c) => c.status === 'fail');
      return {
        verdict: 'block',
        reason: `Verification failed: ${failedChecks.map((c) => c.checkName).join(', ')}`,
      };
    }

    // Block if required checks are missing
    if (run.missingRequiredChecks.length > 0) {
      return {
        verdict: 'block',
        reason: `Missing required verification layers: ${run.missingRequiredChecks.join(', ')}`,
      };
    }

    // Needs-review if there are warnings
    const warningChecks = run.checks.filter((c) => c.status === 'warning');
    if (warningChecks.length > 0) {
      return {
        verdict: 'needs-review',
        reason: `Verification passed with warnings: ${warningChecks.map((c) => `${c.checkName}: ${c.detail}`).join('; ')}`,
      };
    }

    // Promote if all checks passed
    return {
      verdict: 'promote',
      reason: 'All required verification layers passed',
    };
  }

  /** Check if a candidate is ready for promotion. */
  checkPromotionReadiness(run: VerificationRun): { ready: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (run.overallStatus === 'fail') {
      reasons.push('Required checks failed');
    }

    if (run.missingRequiredChecks.length > 0) {
      reasons.push(`Missing required checks: ${run.missingRequiredChecks.join(', ')}`);
    }

    const failedPolicyChecks = run.checks.filter(
      (c) => c.layer === 'policy-safety' && c.status === 'fail'
    );
    if (failedPolicyChecks.length > 0) {
      reasons.push('Policy violations exist');
    }

    const failedDeployChecks = run.checks.filter(
      (c) => c.layer === 'deploy-specific' && c.status === 'fail'
    );
    if (failedDeployChecks.length > 0) {
      reasons.push('Environment readiness failures');
    }

    return {
      ready: reasons.length === 0,
      reasons,
    };
  }

  /** Get a verification run by ID. */
  getRun(id: string): VerificationRun | null {
    return this.db.getVerificationRun(id);
  }

  /** Get all verification runs for a mission. */
  getRunsForMission(missionId: string): VerificationRun[] {
    return this.db.listVerificationRunsByMission(missionId);
  }

  /** Get all available verification bundles. */
  getBundles(): VerificationBundle[] {
    return this.db.listVerificationBundles();
  }
}
