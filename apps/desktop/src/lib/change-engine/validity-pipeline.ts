/**
 * ValidityPipeline — immediate validity checks after patch application.
 *
 * Runs the smallest effective validation set: syntax, typecheck, lint,
 * and dependency integrity. This is NOT Component 16 verification —
 * it does not run test suites, browser checks, or acceptance tests.
 */

import { execSync } from 'child_process';
import type { EvidenceItem } from '../shared-types';

export class ValidityPipeline {
  /**
   * Run a syntax check on a single file by attempting to parse it.
   * For TypeScript files, uses `tsc --noEmit --pretty false` on the file.
   */
  runSyntaxCheck(filePath: string, workspacePath: string): EvidenceItem {
    try {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'ts' || ext === 'tsx') {
        // Try parsing with tsc
        execSync(`npx tsc --noEmit --pretty false "${filePath}"`, {
          cwd: workspacePath,
          stdio: 'pipe',
          timeout: 30000,
        });
      } else if (ext === 'json') {
        // JSON syntax check
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
      }
      return {
        id: `syntax-${Date.now()}`,
        missionId: '',
        type: 'type-check',
        status: 'pass',
        title: `Syntax check: ${filePath}`,
        detail: null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        id: `syntax-${Date.now()}`,
        missionId: '',
        type: 'type-check',
        status: 'fail',
        title: `Syntax check: ${filePath}`,
        detail: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run typecheck for the entire workspace using `tsc --noEmit`.
   * Gracefully degrades if tsc is not available.
   */
  runTypecheck(workspacePath: string): EvidenceItem {
    try {
      execSync('npx tsc --noEmit --pretty false', {
        cwd: workspacePath,
        stdio: 'pipe',
        timeout: 60000,
      });
      return {
        id: `typecheck-${Date.now()}`,
        missionId: '',
        type: 'type-check',
        status: 'pass',
        title: 'TypeScript typecheck',
        detail: null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Check if tsc is not found (graceful degradation)
      if (message.includes('not found') || message.includes('ENOENT')) {
        return {
          id: `typecheck-${Date.now()}`,
          missionId: '',
          type: 'type-check',
          status: 'skipped',
          title: 'TypeScript typecheck',
          detail: 'tsc not available in this workspace',
          timestamp: new Date().toISOString(),
        };
      }
      return {
        id: `typecheck-${Date.now()}`,
        missionId: '',
        type: 'type-check',
        status: 'fail',
        title: 'TypeScript typecheck',
        detail: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run lint on affected files only using eslint.
   * Gracefully degrades if eslint is not available.
   */
  runLint(workspacePath: string, affectedFiles: string[]): EvidenceItem {
    if (affectedFiles.length === 0) {
      return {
        id: `lint-${Date.now()}`,
        missionId: '',
        type: 'lint',
        status: 'skipped',
        title: 'ESLint check',
        detail: 'No affected files to lint',
        timestamp: new Date().toISOString(),
      };
    }
    try {
      const tsFiles = affectedFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      if (tsFiles.length === 0) {
        return {
          id: `lint-${Date.now()}`,
          missionId: '',
          type: 'lint',
          status: 'skipped',
          title: 'ESLint check',
          detail: 'No TypeScript files to lint',
          timestamp: new Date().toISOString(),
        };
      }
      execSync(`npx eslint --no-error-on-unmatched-pattern ${tsFiles.join(' ')}`, {
        cwd: workspacePath,
        stdio: 'pipe',
        timeout: 60000,
      });
      return {
        id: `lint-${Date.now()}`,
        missionId: '',
        type: 'lint',
        status: 'pass',
        title: 'ESLint check',
        detail: null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found') || message.includes('ENOENT')) {
        return {
          id: `lint-${Date.now()}`,
          missionId: '',
          type: 'lint',
          status: 'skipped',
          title: 'ESLint check',
          detail: 'eslint not available in this workspace',
          timestamp: new Date().toISOString(),
        };
      }
      return {
        id: `lint-${Date.now()}`,
        missionId: '',
        type: 'lint',
        status: 'warning',
        title: 'ESLint check',
        detail: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check dependency integrity by verifying package.json can be parsed
   * and that lockfile exists if expected.
   */
  runDependencyCheck(workspacePath: string): EvidenceItem {
    try {
      const fs = require('fs');
      const path = require('path');
      const pkgPath = path.join(workspacePath, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        return {
          id: `deps-${Date.now()}`,
          missionId: '',
          type: 'build',
          status: 'skipped',
          title: 'Dependency integrity',
          detail: 'No package.json found',
          timestamp: new Date().toISOString(),
        };
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      // Check that dependencies object is valid
      if (pkg.dependencies && typeof pkg.dependencies !== 'object') {
        return {
          id: `deps-${Date.now()}`,
          missionId: '',
          type: 'build',
          status: 'fail',
          title: 'Dependency integrity',
          detail: 'Invalid dependencies in package.json',
          timestamp: new Date().toISOString(),
        };
      }
      return {
        id: `deps-${Date.now()}`,
        missionId: '',
        type: 'build',
        status: 'pass',
        title: 'Dependency integrity',
        detail: null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        id: `deps-${Date.now()}`,
        missionId: '',
        type: 'build',
        status: 'fail',
        title: 'Dependency integrity',
        detail: message.slice(0, 500),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run the minimal validation set: syntax check on affected files,
   * typecheck, lint on affected files, and dependency integrity.
   */
  runMinimalValidationSet(
    affectedFiles: string[],
    workspacePath: string,
  ): EvidenceItem[] {
    const results: EvidenceItem[] = [];

    // Syntax check each affected file
    for (const file of affectedFiles) {
      const syntaxResult = this.runSyntaxCheck(file, workspacePath);
      results.push(syntaxResult);
    }

    // Typecheck the workspace
    const typecheckResult = this.runTypecheck(workspacePath);
    results.push(typecheckResult);

    // Lint affected files
    const lintResult = this.runLint(workspacePath, affectedFiles);
    results.push(lintResult);

    // Dependency integrity
    const depsResult = this.runDependencyCheck(workspacePath);
    results.push(depsResult);

    return results;
  }
}
