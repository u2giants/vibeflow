/** Tests for Component 19: Risk assessment engine. */

const assert = require('assert');

// ── Inline risk assessment logic (mirrors approval-engine.ts) ────────

const RISK_THRESHOLDS = {
  'informational': { min: 0, max: 10 },
  'low': { min: 11, max: 30 },
  'medium': { min: 31, max: 50 },
  'high': { min: 51, max: 70 },
  'destructive': { min: 71, max: 90 },
  'privileged-production': { min: 91, max: 100 },
};

const SUBSYSTEM_SCORES = {
  'file:read': { score: 5, maxScore: 100 },
  'file:write': { score: 30, maxScore: 100 },
  'file:delete': { score: 70, maxScore: 100 },
  'terminal:run': { score: 25, maxScore: 100 },
  'git:commit': { score: 20, maxScore: 100 },
  'git:push-main': { score: 60, maxScore: 100 },
  'git:push-branch': { score: 20, maxScore: 100 },
  'deploy:trigger': { score: 55, maxScore: 100 },
  'deploy:restart': { score: 50, maxScore: 100 },
  'deploy:stop': { score: 75, maxScore: 100 },
  'ssh:connect': { score: 35, maxScore: 100 },
  'migration:run': { score: 65, maxScore: 100 },
  'migration:rollback': { score: 55, maxScore: 100 },
  'config:change': { score: 40, maxScore: 100 },
  'secret:rotate': { score: 50, maxScore: 100 },
  'service:restart': { score: 45, maxScore: 100 },
  'service:stop': { score: 70, maxScore: 100 },
  'deploy:rollback': { score: 60, maxScore: 100 },
  'incident:acknowledge': { score: 10, maxScore: 100 },
  'incident:remediate': { score: 55, maxScore: 100 },
};

const ENV_SCORES = {
  'local': 10, 'preview': 20, 'staging': 40, 'canary': 50, 'production': 80,
};

const DATA_RISK_SCORES = {
  'none': 0, 'read': 10, 'write': 50, 'delete': 80,
};

const BLAST_RADIUS_SCORES = {
  'low': 10, 'medium': 40, 'high': 70, 'critical': 90,
};

const REVERSIBILITY_SCORES = {
  'reversible': 10, 'partially-reversible': 50, 'irreversible': 90,
};

const EVIDENCE_SCORES = {
  'complete': 10, 'partial': 50, 'missing': 90,
};

const WEIGHTS = {
  subsystem: 0.70, environment: 0.05, dataRisk: 0.05,
  blastRadius: 0.05, reversibility: 0.05, evidence: 0.10,
};

function assessRisk(input) {
  const subsystem = SUBSYSTEM_SCORES[input.actionType] ?? { score: 30, maxScore: 100 };
  const envScore = ENV_SCORES[input.environment ?? ''] ?? 10;
  const dataScore = DATA_RISK_SCORES[input.dataRisk ?? 'none'];
  const blastScore = BLAST_RADIUS_SCORES[input.blastRadius ?? 'low'];
  const revScore = REVERSIBILITY_SCORES[input.reversibility ?? 'reversible'];
  const evidenceScore = EVIDENCE_SCORES[input.evidenceCompleteness ?? 'partial'];

  let overallScore = 0;
  overallScore += (subsystem.score / subsystem.maxScore) * 100 * WEIGHTS.subsystem;
  overallScore += (envScore / 100) * 100 * WEIGHTS.environment;
  overallScore += (dataScore / 100) * 100 * WEIGHTS.dataRisk;
  overallScore += (blastScore / 100) * 100 * WEIGHTS.blastRadius;
  overallScore += (revScore / 100) * 100 * WEIGHTS.reversibility;
  overallScore += (evidenceScore / 100) * 100 * WEIGHTS.evidence;

  if (input.isSelfMaintenance && (input.actionType === 'file:write' || input.actionType === 'file:delete')) {
    overallScore = Math.max(overallScore, 60);
  }

  let riskClass = 'informational';
  for (const [cls, thresholds] of Object.entries(RISK_THRESHOLDS)) {
    if (overallScore >= thresholds.min && overallScore <= thresholds.max) {
      riskClass = cls;
      break;
    }
  }

  return { riskClass, overallScore: Math.round(overallScore) };
}

function mapRiskClassToApprovalTier(riskClass) {
  if (riskClass === 'informational' || riskClass === 'low') return 1;
  if (riskClass === 'medium') return 2;
  return 3;
}

function classifyAction(actionType, options) {
  const result = assessRisk({ actionType, isSelfMaintenance: options?.isSelfMaintenance });
  return mapRiskClassToApprovalTier(result.riskClass);
}

// ── Tests ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

console.log('\nassessRisk()');

test('file:read should be informational risk', () => {
  const result = assessRisk({ actionType: 'file:read' });
  assert.strictEqual(result.riskClass, 'informational');
  assert.ok(result.overallScore <= 10);
});

test('file:write should be low risk', () => {
  const result = assessRisk({ actionType: 'file:write' });
  assert.strictEqual(result.riskClass, 'low');
});

test('file:delete should be high risk', () => {
  const result = assessRisk({ actionType: 'file:delete' });
  assert.strictEqual(result.riskClass, 'high');
});

test('deploy:stop should be high risk (Tier 3)', () => {
  const result = assessRisk({ actionType: 'deploy:stop' });
  // deploy:stop scores 75/100 * 0.70 + 50/100 * 0.10 = 57.5 → high
  assert.strictEqual(result.riskClass, 'high');
});

test('self-maintenance file:write should be at least high risk', () => {
  const result = assessRisk({ actionType: 'file:write', isSelfMaintenance: true });
  assert.ok(result.overallScore >= 51);
});

test('production environment increases risk', () => {
  const prod = assessRisk({ actionType: 'file:write', environment: 'production' });
  const local = assessRisk({ actionType: 'file:write', environment: 'local' });
  assert.ok(prod.overallScore > local.overallScore);
});

test('data deletion increases risk', () => {
  const del = assessRisk({ actionType: 'file:write', dataRisk: 'delete' });
  const none = assessRisk({ actionType: 'file:write', dataRisk: 'none' });
  assert.ok(del.overallScore > none.overallScore);
});

test('missing evidence increases risk', () => {
  const missing = assessRisk({ actionType: 'file:write', evidenceCompleteness: 'missing' });
  const complete = assessRisk({ actionType: 'file:write', evidenceCompleteness: 'complete' });
  assert.ok(missing.overallScore > complete.overallScore);
});

test('irreversible actions increase risk', () => {
  const irrev = assessRisk({ actionType: 'file:write', reversibility: 'irreversible' });
  const rev = assessRisk({ actionType: 'file:write', reversibility: 'reversible' });
  assert.ok(irrev.overallScore > rev.overallScore);
});

test('new action types are supported', () => {
  const newActions = [
    'migration:run', 'migration:rollback', 'config:change', 'secret:rotate',
    'service:restart', 'service:stop', 'deploy:rollback',
    'incident:acknowledge', 'incident:remediate',
  ];
  for (const action of newActions) {
    const result = assessRisk({ actionType: action });
    assert.ok(result.riskClass);
    assert.ok(result.overallScore >= 0);
    assert.ok(result.overallScore <= 100);
  }
});

console.log('\nmapRiskClassToApprovalTier()');

test('informational maps to Tier 1', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('informational'), 1);
});

test('low maps to Tier 1', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('low'), 1);
});

test('medium maps to Tier 2', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('medium'), 2);
});

test('high maps to Tier 3', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('high'), 3);
});

test('destructive maps to Tier 3', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('destructive'), 3);
});

test('privileged-production maps to Tier 3', () => {
  assert.strictEqual(mapRiskClassToApprovalTier('privileged-production'), 3);
});

console.log('\nclassifyAction() backward compatibility');

test('file:read returns Tier 1', () => {
  assert.strictEqual(classifyAction('file:read'), 1);
});

test('file:write returns Tier 1 (low risk)', () => {
  assert.strictEqual(classifyAction('file:write'), 1);
});

test('file:delete returns Tier 3 (high risk)', () => {
  assert.strictEqual(classifyAction('file:delete'), 3);
});

test('deploy:stop returns Tier 3 (destructive)', () => {
  assert.strictEqual(classifyAction('deploy:stop'), 3);
});

test('self-maintenance file:write returns Tier 3', () => {
  assert.strictEqual(classifyAction('file:write', { isSelfMaintenance: true }), 3);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
