/**
 * ImpactAnalyzer — answers "if X changes, what breaks?" by traversing
 * the reference graph and calculating blast radius.
 */

import type {
  FileRecord, SymbolRecord, RouteRecord, ServiceNode,
  ReferenceEdge, ImpactAnalysis,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export class ImpactAnalyzer {
  private db: LocalDb;
  private projectId: string;

  constructor(db: LocalDb, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  /** Analyze impact of changing a file at the given path. */
  analyze(targetPath: string): ImpactAnalysis {
    // Find the target file record
    const targetFile = this.db.getFileRecord(this.projectId, targetPath);
    if (!targetFile) {
      return {
        affectedFiles: [],
        affectedSymbols: [],
        affectedRoutes: [],
        affectedServices: [],
        blastRadius: 'low',
      };
    }

    const affectedFileIds = new Set<string>();
    const affectedSymbolIds = new Set<string>();
    const affectedFiles: FileRecord[] = [];
    const affectedSymbols: SymbolRecord[] = [];

    // BFS through incoming reference edges
    const queue = [targetFile.id];
    const visited = new Set<string>();
    visited.add(targetFile.id);

    const allEdges = this.db.listReferenceEdges(this.projectId);
    const allSymbols = this.db.listSymbolRecords(this.projectId);
    const allRoutes = this.db.listRouteRecords(this.projectId);
    const allServiceNodes = this.db.listServiceNodes(this.projectId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // Find all edges where currentId is the target
      const incomingEdges = allEdges.filter(e => e.targetFileId === currentId);

      for (const edge of incomingEdges) {
        if (visited.has(edge.sourceFileId)) continue;
        visited.add(edge.sourceFileId);
        affectedFileIds.add(edge.sourceFileId);
        queue.push(edge.sourceFileId);

        // Get the file record
        const fileRecord = this.db.listFileRecords(this.projectId).find(f => f.id === edge.sourceFileId);
        if (fileRecord) {
          affectedFiles.push(fileRecord);
        }

        // Get symbols in this file
        const fileSymbols = allSymbols.filter(s => s.fileId === edge.sourceFileId);
        for (const sym of fileSymbols) {
          affectedSymbolIds.add(sym.id);
          affectedSymbols.push(sym);
        }
      }
    }

    // Find affected routes (routes in affected files)
    const affectedRoutes = allRoutes.filter(r => affectedFileIds.has(r.fileId) || r.fileId === targetFile.id);

    // Find affected services (services connected to affected files via capability links)
    const affectedServices = allServiceNodes.filter(n =>
      n.capabilityId && affectedFileIds.has(n.capabilityId)
    );

    // Calculate blast radius
    const blastRadius = this.calculateBlastRadius(
      affectedFiles.length,
      affectedRoutes.length,
      targetFile.isProtected,
      allServiceNodes.length > 0
    );

    return {
      affectedFiles: [targetFile, ...affectedFiles],
      affectedSymbols,
      affectedRoutes,
      affectedServices,
      blastRadius,
    };
  }

  /** Calculate blast radius based on impact metrics. */
  private calculateBlastRadius(
    affectedFileCount: number,
    affectedRouteCount: number,
    isProtected: boolean,
    hasServices: boolean
  ): ImpactAnalysis['blastRadius'] {
    let score = 0;

    // File count scoring
    if (affectedFileCount > 20) score += 3;
    else if (affectedFileCount > 10) score += 2;
    else if (affectedFileCount > 3) score += 1;

    // Route scoring
    if (affectedRouteCount > 5) score += 3;
    else if (affectedRouteCount > 2) score += 2;
    else if (affectedRouteCount > 0) score += 1;

    // Protected path bonus
    if (isProtected) score += 2;

    // Service connection bonus
    if (hasServices) score += 1;

    if (score >= 6) return 'critical';
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}
