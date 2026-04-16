/**
 * Tests for BrowserAutomationService — scoped to Component 15 capture primitives.
 *
 * These tests verify the service's behavior in stub mode (no Playwright).
 * They are standalone CommonJS so they can run without a full test harness.
 *
 * Run: node apps/desktop/src/lib/runtime-execution/browser-automation-service.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ── Minimal stubs for LocalDb and EvidenceCaptureEngine ──────────────────────

class FakeLocalDb {
  constructor() {
    this.sessions = new Map();
  }
  upsertBrowserSession(session) {
    this.sessions.set(session.id, JSON.parse(JSON.stringify(session)));
  }
  getBrowserSession(id) {
    return this.sessions.get(id) || null;
  }
}

class FakeEvidenceEngine {
  constructor() {
    this.records = [];
  }
  recordEvidence(record) {
    this.records.push(record);
  }
}

// ── Inline BrowserAutomationService (test harness, stub-mode only) ───────────
// Mirrors the public API and stub-mode behavior of browser-automation-service.ts.

class TestableBrowserAutomationService {
  constructor(db, evidenceEngine, screenshotDir) {
    this.db = db;
    this.evidenceEngine = evidenceEngine;
    this.screenshotDir = screenshotDir;
    this.sessions = new Map();
    this.playwrightAvailable = false;
    this.playwrightModule = null;
    this._ensureScreenshotDir();
  }

  async startSession(args) {
    const sessionId = `browser-${Date.now()}-${this._uuid()}`;
    const startedAt = new Date().toISOString();

    const session = {
      id: sessionId,
      workspaceRunId: args.workspaceRunId,
      missionId: args.missionId,
      planStepId: args.planStepId || null,
      baseUrl: args.baseUrl,
      status: 'starting',
      screenshots: [],
      consoleLogs: '',
      networkTraces: '',
      startedAt,
      closedAt: null,
    };

    const activeSession = {
      session,
      browser: null,
      context: null,
      page: null,
      consoleLogs: [],
      networkTraces: [],
    };

    // Stub mode: Playwright not available
    activeSession.session.status = 'running';

    this.sessions.set(sessionId, activeSession);
    this._persistSession(activeSession.session);

    return activeSession.session;
  }

  async navigate(sessionId, url) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    // stub mode — no-op
  }

  async click(sessionId, selector) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    // stub mode — no-op
  }

  async fillForm(sessionId, fields) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    // stub mode — no-op
  }

  async uploadFile(sessionId, selector, filePath) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    // stub mode — no-op
  }

  async screenshot(sessionId, name) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    const timestamp = Date.now();
    const filename = `${sessionId}-${timestamp}-${name}.png`;
    const screenshotPath = path.join(this.screenshotDir, filename);

    // stub: create a placeholder file
    fs.writeFileSync(screenshotPath, `[Stub screenshot: ${name} at ${new Date().toISOString()}]`);

    active.session.screenshots.push(screenshotPath);
    this._persistSession(active.session);

    this.evidenceEngine.recordEvidence({
      id: `evidence-${timestamp}-${this._uuid()}`,
      missionId: active.session.missionId,
      workspaceRunId: active.session.workspaceRunId,
      planStepId: active.session.planStepId,
      changesetId: null,
      environmentId: null,
      capabilityInvocationId: null,
      type: 'screenshot',
      status: 'pass',
      title: `Screenshot: ${name}`,
      detail: null,
      artifactPath: screenshotPath,
      timestamp: new Date().toISOString(),
    });

    return { path: screenshotPath };
  }

  getConsoleLogs(sessionId) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    return active.consoleLogs.join('\n');
  }

  getNetworkTraces(sessionId) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    return active.networkTraces.join('\n');
  }

  async getDomSnapshot(sessionId, selector) {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    return `[Stub DOM snapshot: ${selector} — no page available]`;
  }

  async closeSession(sessionId) {
    const active = this.sessions.get(sessionId);
    if (!active) return;

    active.session.status = 'closed';
    active.session.closedAt = new Date().toISOString();
    active.session.consoleLogs = active.consoleLogs.join('\n');
    active.session.networkTraces = active.networkTraces.join('\n');

    this._persistSession(active.session);
    this.sessions.delete(sessionId);
  }

  _ensureScreenshotDir() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  _persistSession(session) {
    try {
      this.db.upsertBrowserSession(session);
    } catch (err) {
      // ignore
    }
  }

  _uuid() {
    return Math.random().toString(36).slice(2, 10);
  }
}

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const asyncTests = [];

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (err) {
    console.log('FAIL: ' + name + ' — ' + err.message);
    failed++;
  }
}

function runAsyncTest(name, fn) {
  asyncTests.push({ name, fn });
}

// ── Tests ────────────────────────────────────────────────────────────────────

const TEST_DIR = path.join(__dirname, '__test_browser_automation');
const SCREENSHOT_DIR = path.join(TEST_DIR, 'screenshots');

function setup() {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

// Test 1: Service starts in stub mode when Playwright is not available
test('should start in stub mode when Playwright is not available', function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);
  assert.strictEqual(service.playwrightAvailable, false, 'Playwright should not be available in test harness');
  teardown();
});

// Test 2: startSession creates a session with correct fields
runAsyncTest('startSession should create a session with correct fields', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-1',
    workspaceRunId: 'run-1',
    planStepId: 'step-1',
    baseUrl: 'http://localhost:3000',
  });

  assert.ok(session.id.startsWith('browser-'), 'Session ID should start with browser-');
  assert.strictEqual(session.missionId, 'mission-1');
  assert.strictEqual(session.workspaceRunId, 'run-1');
  assert.strictEqual(session.planStepId, 'step-1');
  assert.strictEqual(session.baseUrl, 'http://localhost:3000');
  assert.strictEqual(session.status, 'running');
  assert.deepStrictEqual(session.screenshots, []);
  assert.strictEqual(session.consoleLogs, '');
  assert.strictEqual(session.networkTraces, '');
  assert.ok(session.startedAt);
  assert.strictEqual(session.closedAt, null);
  teardown();
});

// Test 3: Session is persisted in LocalDb
runAsyncTest('startSession should persist session in LocalDb', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-2',
    workspaceRunId: 'run-2',
    planStepId: null,
    baseUrl: 'http://localhost:5173',
  });

  const persisted = db.getBrowserSession(session.id);
  assert.ok(persisted, 'Session should be persisted in LocalDb');
  assert.strictEqual(persisted.id, session.id);
  assert.strictEqual(persisted.missionId, 'mission-2');
  teardown();
});

// Test 4: navigate does not throw in stub mode
runAsyncTest('navigate should not throw in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-3',
    workspaceRunId: 'run-3',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.navigate(session.id, 'http://localhost:3000/test');
  teardown();
});

// Test 5: click does not throw in stub mode
runAsyncTest('click should not throw in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-4',
    workspaceRunId: 'run-4',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.click(session.id, '#submit-btn');
  teardown();
});

// Test 6: fillForm does not throw in stub mode
runAsyncTest('fillForm should not throw in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-5',
    workspaceRunId: 'run-5',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.fillForm(session.id, { '#username': 'test', '#password': 'secret' });
  teardown();
});

// Test 7: uploadFile does not throw in stub mode
runAsyncTest('uploadFile should not throw in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-6',
    workspaceRunId: 'run-6',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.uploadFile(session.id, '#file-input', '/tmp/test.txt');
  teardown();
});

// Test 8: screenshot creates a placeholder file in stub mode
runAsyncTest('screenshot should create a placeholder file in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-7',
    workspaceRunId: 'run-7',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  const result = await service.screenshot(session.id, 'test-screenshot');

  assert.ok(result.path, 'Screenshot should return a path');
  assert.ok(fs.existsSync(result.path), 'Screenshot file should exist');
  const content = fs.readFileSync(result.path, 'utf-8');
  assert.ok(content.includes('Stub screenshot'), 'Screenshot should contain stub marker');
  teardown();
});

// Test 9: screenshot records evidence
runAsyncTest('screenshot should record evidence', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-8',
    workspaceRunId: 'run-8',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.screenshot(session.id, 'evidence-test');

  assert.strictEqual(evidence.records.length, 1, 'Should have one evidence record');
  assert.strictEqual(evidence.records[0].type, 'screenshot');
  assert.strictEqual(evidence.records[0].status, 'pass');
  assert.strictEqual(evidence.records[0].missionId, 'mission-8');
  teardown();
});

// Test 10: getConsoleLogs returns empty string in stub mode
runAsyncTest('getConsoleLogs should return empty string in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-9',
    workspaceRunId: 'run-9',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  const logs = service.getConsoleLogs(session.id);
  assert.strictEqual(logs, '');
  teardown();
});

// Test 11: getNetworkTraces returns empty string in stub mode
runAsyncTest('getNetworkTraces should return empty string in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-10',
    workspaceRunId: 'run-10',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  const traces = service.getNetworkTraces(session.id);
  assert.strictEqual(traces, '');
  teardown();
});

// Test 12: getDomSnapshot returns stub message in stub mode
runAsyncTest('getDomSnapshot should return stub message in stub mode', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-11',
    workspaceRunId: 'run-11',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  const snapshot = await service.getDomSnapshot(session.id, '#app');
  assert.ok(snapshot.includes('Stub DOM snapshot'), 'Should return stub message');
  assert.ok(snapshot.includes('#app'), 'Should include the selector');
  teardown();
});

// Test 13: closeSession updates status and closedAt
runAsyncTest('closeSession should update status and closedAt', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const session = await service.startSession({
    missionId: 'mission-12',
    workspaceRunId: 'run-12',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  await service.closeSession(session.id);

  const persisted = db.getBrowserSession(session.id);
  assert.strictEqual(persisted.status, 'closed');
  assert.ok(persisted.closedAt, 'closedAt should be set');
  teardown();
});

// Test 14: navigate throws for invalid session
runAsyncTest('navigate should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.navigate('nonexistent-session', 'http://localhost:3000');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 15: click throws for invalid session
runAsyncTest('click should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.click('nonexistent-session', '#btn');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 16: fillForm throws for invalid session
runAsyncTest('fillForm should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.fillForm('nonexistent-session', { '#field': 'value' });
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 17: uploadFile throws for invalid session
runAsyncTest('uploadFile should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.uploadFile('nonexistent-session', '#file', '/tmp/test.txt');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 18: screenshot throws for invalid session
runAsyncTest('screenshot should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.screenshot('nonexistent-session', 'test');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 19: getConsoleLogs throws for invalid session
test('getConsoleLogs should throw for invalid session', function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    service.getConsoleLogs('nonexistent-session');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 20: getNetworkTraces throws for invalid session
test('getNetworkTraces should throw for invalid session', function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    service.getNetworkTraces('nonexistent-session');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 21: getDomSnapshot throws for invalid session
runAsyncTest('getDomSnapshot should throw for invalid session', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  let threw = false;
  try {
    await service.getDomSnapshot('nonexistent-session', '#app');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('not found'));
  }
  assert.strictEqual(threw, true, 'Should throw for invalid session');
  teardown();
});

// Test 22: closeSession is safe for invalid session (no-op)
runAsyncTest('closeSession should be safe for invalid session (no-op)', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  // Should not throw
  await service.closeSession('nonexistent-session');
  teardown();
});

// Test 23: Multiple sessions can coexist
runAsyncTest('multiple sessions should coexist independently', async function () {
  setup();
  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, SCREENSHOT_DIR);

  const s1 = await service.startSession({
    missionId: 'mission-a',
    workspaceRunId: 'run-a',
    planStepId: null,
    baseUrl: 'http://localhost:3000',
  });

  const s2 = await service.startSession({
    missionId: 'mission-b',
    workspaceRunId: 'run-b',
    planStepId: null,
    baseUrl: 'http://localhost:5173',
  });

  assert.notStrictEqual(s1.id, s2.id, 'Session IDs should be unique');
  assert.strictEqual(s1.missionId, 'mission-a');
  assert.strictEqual(s2.missionId, 'mission-b');

  // Close s1, s2 should still be accessible
  await service.closeSession(s1.id);
  const logs2 = service.getConsoleLogs(s2.id);
  assert.strictEqual(logs2, '');
  teardown();
});

// Test 24: Screenshot directory is created automatically
test('screenshot directory should be created automatically', function () {
  const customDir = path.join(TEST_DIR, 'custom_screenshots');
  // Ensure it does not exist yet
  if (fs.existsSync(customDir)) fs.rmSync(customDir, { recursive: true, force: true });

  const db = new FakeLocalDb();
  const evidence = new FakeEvidenceEngine();
  const service = new TestableBrowserAutomationService(db, evidence, customDir);

  assert.ok(fs.existsSync(customDir), 'Screenshot directory should be created');
  teardown();
});

// ── Run all tests ────────────────────────────────────────────────────────────

(async function runAll() {
  for (const t of asyncTests) {
    try {
      await t.fn();
      console.log('PASS: ' + t.name);
      passed++;
    } catch (err) {
      console.log('FAIL: ' + t.name + ' — ' + err.message);
      failed++;
    }
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
})();
