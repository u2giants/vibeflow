/**
 * SemanticGrouper — groups file-level changes into semantic categories.
 *
 * Uses project intelligence (Component 11) for classification when available,
 * falls back to path-based heuristics when the index is stale or absent.
 */

import type { SemanticChangeGroup, FileEdit, ImpactAnalysis } from '../shared-types';

/** Heuristic category based on file path patterns. */
function categorizeByPath(filePath: string): string {
  const lower = filePath.toLowerCase();

  if (lower.includes('component') || lower.includes('ui/') || lower.includes('view') || lower.includes('screen') || lower.includes('panel')) {
    return 'UI change';
  }
  if (lower.includes('api/') || lower.includes('route') || lower.includes('handler') || lower.includes('controller') || lower.includes('endpoint')) {
    return 'API contract change';
  }
  if (lower.includes('auth') || lower.includes('login') || lower.includes('session') || lower.includes('token') || lower.includes('oauth')) {
    return 'Auth behavior change';
  }
  if (lower.includes('model') || lower.includes('entity') || lower.includes('schema') || lower.includes('table') || lower.includes('migration')) {
    return 'Data model change';
  }
  if (lower.includes('package.json') || lower.includes('pnpm') || lower.includes('yarn') || lower.includes('npm') || lower.includes('dependency')) {
    return 'Dependency change';
  }
  if (lower.includes('deploy') || lower.includes('docker') || lower.includes('compose') || lower.includes('coolify') || lower.includes('action') || lower.includes('ci')) {
    return 'Deployment config change';
  }
  if (lower.includes('config') || lower.includes('env') || lower.includes('setting') || lower.includes('.env')) {
    return 'Configuration change';
  }
  if (lower.includes('test') || lower.includes('spec') || lower.includes('__tests__')) {
    return 'Test change';
  }
  if (lower.includes('util') || lower.includes('helper') || lower.includes('lib') || lower.includes('service')) {
    return 'Utility/service change';
  }
  if (lower.includes('doc') || lower.includes('readme') || lower.includes('md')) {
    return 'Documentation change';
  }

  return 'Code change';
}

export class SemanticGrouper {
  /**
   * Group file edits by semantic category.
   * Uses impact analysis from project intelligence when available,
   * falls back to path-based heuristics.
   */
  groupChanges(
    fileEdits: FileEdit[],
    impactAnalysis?: ImpactAnalysis | null,
  ): SemanticChangeGroup[] {
    // Build a map of file paths to their impact analysis categories
    const impactCategories = new Map<string, string>();
    if (impactAnalysis) {
      for (const route of impactAnalysis.affectedRoutes) {
        impactCategories.set(route.fileId, 'API contract change');
      }
      for (const service of impactAnalysis.affectedServices) {
        impactCategories.set(service.id, 'Service topology change');
      }
    }

    // Group edits by category
    const groups = new Map<string, SemanticChangeGroup>();

    for (const edit of fileEdits) {
      const category = impactCategories.get(edit.filePath) ?? categorizeByPath(edit.filePath);

      if (!groups.has(category)) {
        groups.set(category, {
          id: `group-${category.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
          workspaceRunId: edit.workspaceRunId,
          label: category,
          description: this.describeCategory(category, fileEdits.length),
          fileEdits: [],
          affectedContracts: [],
          blastRadius: this.estimateBlastRadius(category, impactAnalysis),
        });
      }

      const group = groups.get(category)!;
      group.fileEdits.push(edit.id);
    }

    return Array.from(groups.values());
  }

  /** Produce a plain-English description of a category. */
  private describeCategory(category: string, fileCount: number): string {
    const descriptions: Record<string, string> = {
      'UI change': `Changes to user interface components or screens (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'API contract change': `Changes to API endpoints, routes, or request/response contracts (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Auth behavior change': `Changes to authentication, authorization, or session handling (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Data model change': `Changes to data structures, database schemas, or entity definitions (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Dependency change': `Changes to package dependencies or lockfiles (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Deployment config change': `Changes to deployment configuration, CI pipelines, or container definitions (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Configuration change': `Changes to environment variables, settings, or config files (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Test change': `Changes to test files or test configuration (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Utility/service change': `Changes to shared utilities or service modules (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Documentation change': `Changes to documentation or markdown files (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
      'Service topology change': `Changes to service connections or infrastructure topology (${fileCount} file${fileCount > 1 ? 's' : ''}).`,
    };
    return descriptions[category] ?? `General code changes (${fileCount} file${fileCount > 1 ? 's' : ''}).`;
  }

  /** Estimate blast radius from category and impact analysis. */
  private estimateBlastRadius(
    category: string,
    impactAnalysis?: ImpactAnalysis | null,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (impactAnalysis) {
      return impactAnalysis.blastRadius;
    }

    // Heuristic blast radius
    const highRisk = ['Auth behavior change', 'Data model change', 'Deployment config change'];
    const mediumRisk = ['API contract change', 'Service topology change', 'Dependency change'];

    if (highRisk.includes(category)) return 'high';
    if (mediumRisk.includes(category)) return 'medium';
    return 'low';
  }
}
