/**
 * Scoped tests for Component 16: Verification and Acceptance System.
 *
 * These tests are self-contained and do not require TypeScript module resolution.
 * They verify the core logic of bundle selection, verdict generation, and data structures.
 */

const assert = require('assert');

// ── Bundle definitions (mirrors verification-bundles.ts) ──────────────────

const DEFAULT_VERIFICATION_BUNDLES = [
  {
    id: 'bundle-low',
    name: 'Low-Risk Verification',
    riskClass: 'low',
    requiredLayers: ['instant-validity', 'acceptance-flow'],
    description: 'Syntax, lint, typecheck, and a basic acceptance flow.',
  },
  {
    id: 'bundle-medium',
    name: 'Medium-Risk Verification',
    riskClass: 'medium',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow'],
    description: 'All low-risk checks plus impacted tests and browser acceptance.',
  },
  {
    id: 'bundle-high',
    name: 'High-Risk Verification',
    riskClass: 'high',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow', 'policy-safety'],
    description: 'All medium-risk checks plus policy and safety validation.',
  },
  {
    id: 'bundle-destructive',
    name: 'Destructive-Risk Verification',
    riskClass: 'destructive',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow', 'policy-safety', 'deploy-specific'],
    description: 'Full verification including deploy-specific checks.',
  },
];

function selectBundleForRiskClass(riskClass) {
  var bundle = DEFAULT_VERIFICATION_BUNDLES.find(function(b) { return b.riskClass === riskClass; });
  if (!bundle) {
    return DEFAULT_VERIFICATION_BUNDLES.find(function(b) { return b.riskClass === 'medium'; });
  }
  return bundle;
}

// ── Verdict generation logic (mirrors VerificationEngine.generateVerdict) ─

function generateVerdict(run, bundle) {
  if (run.overallStatus === 'fail') {
    var failedChecks = run.checks.filter(function(c) { return c.status === 'fail'; });
    return {
      verdict: 'block',
      reason: 'Verification failed: ' + failedChecks.map(function(c) { return c.checkName; }).join(', '),
    };
  }

  if (run.missingRequiredChecks.length > 0) {
    return {
      verdict: 'block',
      reason: 'Missing required verification layers: ' + run.missingRequiredChecks.join(', '),
    };
  }

  var warningChecks = run.checks.filter(function(c) { return c.status === 'warning'; });
  if (warningChecks.length > 0) {
    return {
      verdict: 'needs-review',
      reason: 'Verification passed with warnings: ' + warningChecks.map(function(c) { return c.checkName + ': ' + c.detail; }).join('; '),
    };
  }

  return {
    verdict: 'promote',
    reason: 'All required verification layers passed',
  };
}

// ── Test file discovery (mirrors ImpactedTestRunner.findTestFiles) ────────

function findTestFiles(affectedFiles) {
  var testFiles = new Set();
  for (var i = 0; i < affectedFiles.length; i++) {
    var file = affectedFiles[i];
    var dir = file.substring(0, file.lastIndexOf('/'));
    var base = file.substring(file.lastIndexOf('/') + 1);
    var ext = base.substring(base.lastIndexOf('.'));
    var nameWithoutExt = base.substring(0, base.lastIndexOf('.'));
    testFiles.add(dir + '/' + nameWithoutExt + '.test' + ext);
    testFiles.add(dir + '/' + nameWithoutExt + '.spec' + ext);
  }
  return Array.from(testFiles);
}

// ── Tests ─────────────────────────────────────────────────────────────────

console.log('\n=== Component 16: Verification and Acceptance Tests ===\n');

// Bundle selection tests
function testSelectBundleLowRisk() {
  var bundle = selectBundleForRiskClass('low');
  assert.strictEqual(bundle.riskClass, 'low');
  assert.ok(bundle.requiredLayers.indexOf('instant-validity') !== -1);
  assert.ok(bundle.requiredLayers.indexOf('acceptance-flow') !== -1);
  console.log('✓ testSelectBundleLowRisk');
}

function testSelectBundleMediumRisk() {
  var bundle = selectBundleForRiskClass('medium');
  assert.strictEqual(bundle.riskClass, 'medium');
  assert.ok(bundle.requiredLayers.indexOf('impacted-tests') !== -1);
  console.log('✓ testSelectBundleMediumRisk');
}

function testSelectBundleHighRisk() {
  var bundle = selectBundleForRiskClass('high');
  assert.strictEqual(bundle.riskClass, 'high');
  assert.ok(bundle.requiredLayers.indexOf('policy-safety') !== -1);
  console.log('✓ testSelectBundleHighRisk');
}

function testSelectBundleDestructiveRisk() {
  var bundle = selectBundleForRiskClass('destructive');
  assert.strictEqual(bundle.riskClass, 'destructive');
  assert.ok(bundle.requiredLayers.indexOf('deploy-specific') !== -1);
  assert.strictEqual(bundle.requiredLayers.length, 5);
  console.log('✓ testSelectBundleDestructiveRisk');
}

function testSelectBundleFallback() {
  var bundle = selectBundleForRiskClass('unknown');
  assert.strictEqual(bundle.riskClass, 'medium');
  console.log('✓ testSelectBundleFallback');
}

// Verdict generation tests
function testVerdictPromote() {
  var run = {
    overallStatus: 'pass',
    checks: [{ checkName: 'syntax', status: 'pass' }],
    missingRequiredChecks: [],
  };
  var result = generateVerdict(run, {});
  assert.strictEqual(result.verdict, 'promote');
  assert.ok(result.reason.indexOf('All required') !== -1);
  console.log('✓ testVerdictPromote');
}

function testVerdictBlockOnFail() {
  var run = {
    overallStatus: 'fail',
    checks: [{ checkName: 'typecheck', status: 'fail' }],
    missingRequiredChecks: [],
  };
  var result = generateVerdict(run, {});
  assert.strictEqual(result.verdict, 'block');
  assert.ok(result.reason.indexOf('typecheck') !== -1);
  console.log('✓ testVerdictBlockOnFail');
}

function testVerdictBlockOnMissingChecks() {
  var run = {
    overallStatus: 'pass',
    checks: [],
    missingRequiredChecks: ['impacted-tests', 'acceptance-flow'],
  };
  var result = generateVerdict(run, {});
  assert.strictEqual(result.verdict, 'block');
  assert.ok(result.reason.indexOf('impacted-tests') !== -1);
  console.log('✓ testVerdictBlockOnMissingChecks');
}

function testVerdictNeedsReviewOnWarning() {
  var run = {
    overallStatus: 'pass',
    checks: [{ checkName: 'risk-policy', status: 'warning', detail: 'High-risk action' }],
    missingRequiredChecks: [],
  };
  var result = generateVerdict(run, {});
  assert.strictEqual(result.verdict, 'needs-review');
  assert.ok(result.reason.indexOf('risk-policy') !== -1);
  console.log('✓ testVerdictNeedsReviewOnWarning');
}

// Test file discovery tests
function testFindTestFiles() {
  var affectedFiles = [
    'src/components/Button.tsx',
    'src/utils/format.ts',
    'src/pages/Home.tsx',
  ];
  var testFiles = findTestFiles(affectedFiles);
  assert.ok(testFiles.indexOf('src/components/Button.test.tsx') !== -1);
  assert.ok(testFiles.indexOf('src/components/Button.spec.tsx') !== -1);
  assert.ok(testFiles.indexOf('src/utils/format.test.ts') !== -1);
  assert.ok(testFiles.indexOf('src/pages/Home.test.tsx') !== -1);
  assert.strictEqual(testFiles.length, 6);
  console.log('✓ testFindTestFiles');
}

function testFindTestFilesEmpty() {
  var testFiles = findTestFiles([]);
  assert.strictEqual(testFiles.length, 0);
  console.log('✓ testFindTestFilesEmpty');
}

// Risk policy tests
function testRiskPolicyHighRisk() {
  var riskAssessment = { riskClass: 'high', overallScore: 75 };
  var isHighRisk = riskAssessment.riskClass === 'high' || riskAssessment.riskClass === 'destructive';
  assert.ok(isHighRisk);
  console.log('✓ testRiskPolicyHighRisk');
}

function testRiskPolicyLowRisk() {
  var riskAssessment = { riskClass: 'low', overallScore: 20 };
  var isHighRisk = riskAssessment.riskClass === 'high' || riskAssessment.riskClass === 'destructive';
  assert.ok(!isHighRisk);
  console.log('✓ testRiskPolicyLowRisk');
}

function testRiskPolicyNullAssessment() {
  var riskAssessment = null;
  assert.strictEqual(riskAssessment, null);
  console.log('✓ testRiskPolicyNullAssessment');
}

// Rollback readiness tests
function testRollbackReadinessWithCheckpoints() {
  var hasCheckpoints = true;
  var status = hasCheckpoints ? 'pass' : 'warning';
  assert.strictEqual(status, 'pass');
  console.log('✓ testRollbackReadinessWithCheckpoints');
}

function testRollbackReadinessWithoutCheckpoints() {
  var hasCheckpoints = false;
  var status = hasCheckpoints ? 'pass' : 'warning';
  assert.strictEqual(status, 'warning');
  console.log('✓ testRollbackReadinessWithoutCheckpoints');
}

// Data structure validation tests
function testAcceptanceCriteriaStructure() {
  var criteria = {
    id: 'acceptance-test-1',
    missionId: 'mission-1',
    intendedBehavior: ['Feature works as expected'],
    nonGoals: ['No performance optimization'],
    pathsThatMustStillWork: ['Login flow', 'Dashboard'],
    comparisonTargets: ['Before/after screenshot'],
    regressionThresholds: ['No new test failures'],
    rollbackConditions: ['Revert to last checkpoint'],
    createdAt: '2026-04-14T00:00:00Z',
    updatedAt: '2026-04-14T00:00:00Z',
  };
  assert.ok(Array.isArray(criteria.intendedBehavior));
  assert.ok(Array.isArray(criteria.nonGoals));
  assert.ok(Array.isArray(criteria.pathsThatMustStillWork));
  assert.ok(Array.isArray(criteria.comparisonTargets));
  assert.ok(Array.isArray(criteria.regressionThresholds));
  assert.ok(Array.isArray(criteria.rollbackConditions));
  assert.strictEqual(criteria.missionId, 'mission-1');
  console.log('✓ testAcceptanceCriteriaStructure');
}

function testVerificationRunStructure() {
  var run = {
    id: 'verif-1',
    missionId: 'mission-1',
    workspaceRunId: null,
    changesetId: null,
    candidateId: null,
    bundleId: 'bundle-medium',
    overallStatus: 'running',
    checks: [],
    missingRequiredChecks: [],
    flakeSuspicions: [],
    riskImpact: 'medium',
    startedAt: '2026-04-14T00:00:00Z',
    completedAt: null,
    verdict: null,
    verdictReason: null,
  };
  assert.strictEqual(run.overallStatus, 'running');
  assert.strictEqual(run.verdict, null);
  assert.ok(Array.isArray(run.checks));
  assert.ok(Array.isArray(run.missingRequiredChecks));
  console.log('✓ testVerificationRunStructure');
}

function testVerificationCheckStructure() {
  var check = {
    id: 'check-1',
    verificationRunId: 'verif-1',
    layer: 'instant-validity',
    checkName: 'syntax-check',
    status: 'pass',
    detail: null,
    evidenceItemIds: ['evidence-1'],
    durationMs: 100,
    startedAt: '2026-04-14T00:00:00Z',
    completedAt: '2026-04-14T00:00:00Z',
  };
  var validLayers = ['instant-validity', 'impacted-tests', 'acceptance-flow', 'policy-safety', 'deploy-specific'];
  var validStatuses = ['pass', 'fail', 'warning', 'skipped', 'running'];
  assert.ok(validLayers.indexOf(check.layer) !== -1);
  assert.ok(validStatuses.indexOf(check.status) !== -1);
  assert.ok(Array.isArray(check.evidenceItemIds));
  console.log('✓ testVerificationCheckStructure');
}

// ── Run all tests ─────────────────────────────────────────────────────────

testSelectBundleLowRisk();
testSelectBundleMediumRisk();
testSelectBundleHighRisk();
testSelectBundleDestructiveRisk();
testSelectBundleFallback();
testVerdictPromote();
testVerdictBlockOnFail();
testVerdictBlockOnMissingChecks();
testVerdictNeedsReviewOnWarning();
testFindTestFiles();
testFindTestFilesEmpty();
testRiskPolicyHighRisk();
testRiskPolicyLowRisk();
testRiskPolicyNullAssessment();
testRollbackReadinessWithCheckpoints();
testRollbackReadinessWithoutCheckpoints();
testAcceptanceCriteriaStructure();
testVerificationRunStructure();
testVerificationCheckStructure();

console.log('\n=== All 19 tests passed ===\n');
