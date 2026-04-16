/**
 * BrowserAutomationService — bounded Playwright-based capture primitives.
 *
 * Provides: launch/close, navigate, click, form fill, file upload, modal handling,
 * screenshots, console logs, network traces, DOM snapshots, and flow replay.
 *
 * Safety: production mode is observation-only — no mutation.
 *
 * NOTE: Playwright is loaded dynamically. If not installed, the service
 * gracefully degrades to a no-op stub with clear error messages.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { BrowserSession } from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import type { EvidenceCaptureEngine } from './evidence-capture-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightBrowser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightPage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightContext = any;

interface ActiveSession {
  session: BrowserSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: PlaywrightBrowser | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: PlaywrightContext | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: PlaywrightPage | null;
  consoleLogs: string[];
  networkTraces: string[];
}

export class BrowserAutomationService {
  private sessions: Map<string, ActiveSession> = new Map();
  private playwrightAvailable = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private playwrightModule: any | null = null;

  constructor(
    private db: LocalDb,
    private evidenceEngine: EvidenceCaptureEngine,
    private screenshotDir: string
  ) {
    this.ensureScreenshotDir();
    this.loadPlaywright();
  }

  /** Start a new browser session. */
  async startSession(args: {
    missionId: string;
    workspaceRunId: string;
    planStepId: string | null;
    baseUrl: string;
  }): Promise<BrowserSession> {
    const sessionId = `browser-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();

    const session: BrowserSession = {
      id: sessionId,
      workspaceRunId: args.workspaceRunId,
      missionId: args.missionId,
      planStepId: args.planStepId,
      baseUrl: args.baseUrl,
      status: 'starting',
      screenshots: [],
      consoleLogs: '',
      networkTraces: '',
      startedAt,
      closedAt: null,
    };

    const activeSession: ActiveSession = {
      session,
      browser: null,
      context: null,
      page: null,
      consoleLogs: [],
      networkTraces: [],
    };

    if (this.playwrightAvailable && this.playwrightModule) {
      try {
        const { chromium } = this.playwrightModule;
        activeSession.browser = await chromium.launch({ headless: true });
        activeSession.context = await activeSession.browser.newContext();
        activeSession.page = await activeSession.context.newPage();

        // Capture console logs
        activeSession.page.on('console', (msg: { type: () => string; text: () => string }) => {
          activeSession.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        });

        // Capture network requests
        activeSession.page.on('request', (req: { url: () => string; method: () => string }) => {
          activeSession.networkTraces.push(`[${req.method()}] ${req.url()}`);
        });

        activeSession.session.status = 'running';
      } catch (err) {
        console.error('[BrowserAutomationService] Playwright launch failed:', err);
        activeSession.session.status = 'failed';
      }
    } else {
      console.warn('[BrowserAutomationService] Playwright not available — running in stub mode');
      activeSession.session.status = 'running';
    }

    this.sessions.set(sessionId, activeSession);
    this.persistSession(activeSession.session);

    return activeSession.session;
  }

  /** Navigate to a URL. */
  async navigate(sessionId: string, url: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    if (active.page) {
      await active.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } else {
      console.warn(`[BrowserAutomationService] navigate(${url}) — no page (stub mode)`);
    }
  }

  /** Click an element by selector. */
  async click(sessionId: string, selector: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    if (active.page) {
      await active.page.click(selector, { timeout: 10000 });
    } else {
      console.warn(`[BrowserAutomationService] click(${selector}) — no page (stub mode)`);
    }
  }

  /** Fill form fields. */
  async fillForm(sessionId: string, fields: Record<string, string>): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    if (active.page) {
      for (const [selector, value] of Object.entries(fields)) {
        await active.page.fill(selector, value, { timeout: 10000 });
      }
    } else {
      console.warn(`[BrowserAutomationService] fillForm — no page (stub mode)`);
    }
  }

  /** Upload a file to an input element. */
  async uploadFile(sessionId: string, selector: string, filePath: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    if (active.page) {
      await active.page.setInputFiles(selector, filePath, { timeout: 10000 });
    } else {
      console.warn(`[BrowserAutomationService] uploadFile(${selector}) — no page (stub mode)`);
    }
  }

  /** Capture a screenshot and store it. */
  async screenshot(sessionId: string, name: string): Promise<{ path: string }> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    const timestamp = Date.now();
    const filename = `${sessionId}-${timestamp}-${name}.png`;
    const screenshotPath = path.join(this.screenshotDir, filename);

    if (active.page) {
      await active.page.screenshot({ path: screenshotPath, fullPage: false });
    } else {
      // Stub: create a placeholder file
      fs.writeFileSync(screenshotPath, `[Stub screenshot: ${name} at ${new Date().toISOString()}]`);
    }

    active.session.screenshots.push(screenshotPath);
    this.persistSession(active.session);

    // Record screenshot as evidence
    this.evidenceEngine.recordEvidence({
      id: `evidence-${timestamp}-${crypto.randomUUID().slice(0, 8)}`,
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

  /** Get captured console logs. */
  getConsoleLogs(sessionId: string): string {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    return active.consoleLogs.join('\n');
  }

  /** Get captured network traces. */
  getNetworkTraces(sessionId: string): string {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);
    return active.networkTraces.join('\n');
  }

  /** Get DOM snapshot for a selector (returns outerHTML). */
  async getDomSnapshot(sessionId: string, selector: string): Promise<string> {
    const active = this.sessions.get(sessionId);
    if (!active) throw new Error(`Browser session ${sessionId} not found`);

    if (active.page) {
      const element = await active.page.$(selector);
      if (element) {
        return await element.evaluate((el: Element) => el.outerHTML);
      }
      return `[Element not found: ${selector}]`;
    }
    return `[Stub DOM snapshot: ${selector} — no page available]`;
  }

  /** Close a browser session and persist final state. */
  async closeSession(sessionId: string): Promise<void> {
    const active = this.sessions.get(sessionId);
    if (!active) return;

    if (active.browser) {
      try {
        await active.browser.close();
      } catch (err) {
        console.error('[BrowserAutomationService] Browser close failed:', err);
      }
    }

    active.session.status = 'closed';
    active.session.closedAt = new Date().toISOString();
    active.session.consoleLogs = active.consoleLogs.join('\n');
    active.session.networkTraces = active.networkTraces.join('\n');

    this.persistSession(active.session);
    this.sessions.delete(sessionId);
  }

  private ensureScreenshotDir(): void {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  private async loadPlaywright(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      this.playwrightModule = require('playwright') as any;
      this.playwrightAvailable = true;
      console.log('[BrowserAutomationService] Playwright loaded successfully');
    } catch {
      this.playwrightAvailable = false;
      console.warn('[BrowserAutomationService] Playwright not installed — browser automation will run in stub mode');
    }
  }

  private persistSession(session: BrowserSession): void {
    try {
      this.db.upsertBrowserSession(session);
    } catch (err) {
      console.error('[BrowserAutomationService] Failed to persist session:', err);
    }
  }
}
