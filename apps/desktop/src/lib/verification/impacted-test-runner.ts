/**
 * ImpactedTestRunner — Layer B: runs impacted technical checks.
 *
 * Reads affected files from impact analysis, maps to test files,
 * and runs tests via child_process.
 */

import { execSync } from 'child_process';
import type { VerificationCheck } from '../shared-types';

export class ImpactedTestRunner {
  /** Run tests for affected files. */
  runTests(workspacePath: string, affectedFiles: string[]): VerificationCheck[] {
    const checks: VerificationCheck[] = [];
    const startedAt = new Date().toISOString();

    // Map affected files to test files (heuristic: same directory, *.test.* pattern)
    const testFiles = this.findTestFiles(affectedFiles);

    if (testFiles.length === 0) {
      checks.push({
        id: `test-check-${Date.now()}`,
        verificationRunId: '',
        layer: 'impacted-tests',
        checkName: 'impacted-test-discovery',
        status: 'skipped',
        detail: 'No test files found for affected files',
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
      return checks;
    }

    // Run tests
    const testCommand = `pnpm test ${testFiles.join(' ')}`;

    try {
      execSync(testCommand, {
        cwd: workspacePath,
        stdio: 'pipe',
        timeout: 120000,
      });

      checks.push({
        id: `test-check-${Date.now()}`,
        verificationRunId: '',
        layer: 'impacted-tests',
        checkName: 'impacted-tests',
        status: 'pass',
        detail: null,
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: `test-check-${Date.now()}`,
        verificationRunId: '',
        layer: 'impacted-tests',
        checkName: 'impacted-tests',
        status: 'fail',
        detail: message.slice(0, 500),
        evidenceItemIds: [],
        durationMs: 0,
        startedAt,
        completedAt: new Date().toISOString(),
      });
    }

    return checks;
  }

  /** Find test files related to affected files. */
  private findTestFiles(affectedFiles: string[]): string[] {
    const testFiles: Set<string> = new Set();
    for (const file of affectedFiles) {
      const dir = file.substring(0, file.lastIndexOf('/'));
      const base = file.substring(file.lastIndexOf('/') + 1);
      const ext = base.substring(base.lastIndexOf('.'));
      const nameWithoutExt = base.substring(0, base.lastIndexOf('.'));

      // Check for adjacent test file
      testFiles.add(`${dir}/${nameWithoutExt}.test${ext}`);
      testFiles.add(`${dir}/${nameWithoutExt}.spec${ext}`);
    }
    return Array.from(testFiles);
  }
}
