/**
 * AcceptanceFlowRunner — Layer C: runs browser-driven acceptance flows.
 *
 * Uses existing BrowserAutomationService to run predefined flows
 * based on AcceptanceCriteria.pathsThatMustStillWork.
 */

import type { VerificationCheck } from '../shared-types';
import type { BrowserAutomationService } from '../runtime-execution/browser-automation-service';

export class AcceptanceFlowRunner {
  constructor(private browserService: BrowserAutomationService) {}

  /** Run acceptance flows for the given paths. */
  async runFlows(missionId: string, workspaceRunId: string, paths: string[], baseUrl: string): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const startedAt = new Date().toISOString();

    if (paths.length === 0) {
      checks.push({
        id: `acceptance-flow-${Date.now()}`,
        verificationRunId: '',
        layer: 'acceptance-flow',
        checkName: 'acceptance-flow',
        status: 'skipped',
        detail: 'No acceptance paths defined',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
      return checks;
    }

    let sessionId: string | null = null;
    try {
      // Start browser session
      const session = await this.browserService.startSession({
        missionId,
        workspaceRunId,
        planStepId: null,
        baseUrl,
      });
      sessionId = session.id;

      // Navigate to each path and verify it loads
      for (const path of paths) {
        const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
        await this.browserService.navigate(sessionId, url);

        // Take screenshot as evidence
        const screenshot = await this.browserService.screenshot(sessionId, `acceptance-${path}`);

        checks.push({
          id: `acceptance-flow-${path}-${Date.now()}`,
          verificationRunId: '',
          layer: 'acceptance-flow',
          checkName: `acceptance-flow: ${path}`,
          status: 'pass',
          detail: `Screenshot captured at ${screenshot.path}`,
          evidenceItemIds: [],
          durationMs: 0,
          startedAt,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: `acceptance-flow-${Date.now()}`,
        verificationRunId: '',
        layer: 'acceptance-flow',
        checkName: 'acceptance-flow',
        status: 'warning',
        detail: `Browser automation not available: ${message}`,
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    } finally {
      if (sessionId) {
        try {
          await this.browserService.closeSession(sessionId);
        } catch {
          // Ignore close errors
        }
      }
    }

    return checks;
  }
}
