/**
 * ContextPackAssembler — creates per-mission context packs with explicit
 * inclusion rationale, freshness tracking, and warnings.
 */

import type {
  ContextPackEnriched, ContextItem, ContextWarning,
  FileRecord, SymbolRecord, RouteRecord, ServiceNode,
  ConfigVariableRecord,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';
import { ImpactAnalyzer } from './impact-analyzer';

export interface ContextPackOptions {
  tokenBudget?: number;
  includeFiles?: boolean;
  includeSymbols?: boolean;
  includeRoutes?: boolean;
  includeServices?: boolean;
  includeConfig?: boolean;
}

const DEFAULT_TOKEN_BUDGET = 100_000;

export class ContextPackAssembler {
  private db: LocalDb;
  private projectId: string;
  private impactAnalyzer: ImpactAnalyzer;

  constructor(db: LocalDb, projectId: string) {
    this.db = db;
    this.projectId = projectId;
    this.impactAnalyzer = new ImpactAnalyzer(db, projectId);
  }

  /** Assemble a context pack for a mission. */
  assemble(missionId: string, options?: ContextPackOptions): ContextPackEnriched {
    const items: ContextItem[] = [];
    const warnings: ContextWarning[] = [];
    const tokenBudget = options?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

    // Check index staleness
    const index = this.db.getProjectIndex(this.projectId);
    if (!index) {
      warnings.push({
        id: `warn-${missionId}-no-index`,
        contextPackId: '',
        type: 'stale-index',
        message: 'No project index found. Context pack may be incomplete.',
        severity: 'critical',
        suggestedAction: 'Run a full project reindex before starting this mission.',
      });
    } else if (index.staleness === 'stale') {
      warnings.push({
        id: `warn-${missionId}-stale-index`,
        contextPackId: '',
        type: 'stale-index',
        message: `Project index is stale (last indexed: ${index.indexedAt}).`,
        severity: 'warning',
        suggestedAction: 'Run a project reindex to get fresh context.',
      });
    }

    // Include files
    if (options?.includeFiles !== false) {
      const files = this.db.listFileRecords(this.projectId);
      for (const file of files.slice(0, 50)) { // Limit to avoid token overflow
        items.push({
          id: `item-${missionId}-file-${file.id}`,
          contextPackId: '',
          type: 'file',
          referenceId: file.id,
          title: file.path,
          summary: `${file.language} file, ${file.sizeBytes} bytes`,
          inclusionReason: 'Auto-included from project index',
          source: 'auto',
          freshness: index?.staleness ?? 'unknown',
          pinned: false,
        });
      }
    }

    // Include symbols
    if (options?.includeSymbols !== false) {
      const symbols = this.db.listSymbolRecords(this.projectId);
      for (const sym of symbols.slice(0, 100)) {
        items.push({
          id: `item-${missionId}-sym-${sym.id}`,
          contextPackId: '',
          type: 'symbol',
          referenceId: sym.id,
          title: `${sym.name} (${sym.kind})`,
          summary: `In ${sym.filePath}, lines ${sym.lineStart ?? '?'}-${sym.lineEnd ?? '?'}`,
          inclusionReason: 'Auto-included from symbol graph',
          source: 'auto',
          freshness: index?.staleness ?? 'unknown',
          pinned: false,
        });
      }
    }

    // Include routes
    if (options?.includeRoutes !== false) {
      const routes = this.db.listRouteRecords(this.projectId);
      for (const route of routes) {
        items.push({
          id: `item-${missionId}-route-${route.id}`,
          contextPackId: '',
          type: 'route',
          referenceId: route.id,
          title: `${route.method ?? 'ANY'} ${route.path}`,
          summary: route.framework ? `${route.framework} route` : 'Route',
          inclusionReason: 'Auto-included from route map',
          source: 'auto',
          freshness: index?.staleness ?? 'unknown',
          pinned: false,
        });
      }
    }

    // Include services
    if (options?.includeServices !== false) {
      const nodes = this.db.listServiceNodes(this.projectId);
      for (const node of nodes) {
        items.push({
          id: `item-${missionId}-svc-${node.id}`,
          contextPackId: '',
          type: 'service',
          referenceId: node.id,
          title: node.name,
          summary: `${node.type} service, health: ${node.healthStatus}`,
          inclusionReason: 'Auto-included from service topology',
          source: 'topology',
          freshness: 'fresh',
          pinned: false,
        });
      }
    }

    // Include config
    const configs = this.db.listConfigVariableRecords(this.projectId);
    if (options?.includeConfig !== false) {
      for (const cfg of configs) {
        items.push({
          id: `item-${missionId}-cfg-${cfg.id}`,
          contextPackId: '',
          type: 'config',
          referenceId: cfg.id,
          title: cfg.name,
          summary: cfg.isSecret ? 'Secret variable' : `Config variable${cfg.defaultValue ? ` (default: ${cfg.defaultValue})` : ''}`,
          inclusionReason: 'Auto-included from configuration map',
          source: 'auto',
          freshness: 'fresh',
          pinned: false,
        });
      }
    }

    // Check for missing config
    const missingConfig = configs.filter(c => c.missingEnvironments.length > 0);
    for (const cfg of missingConfig) {
      warnings.push({
        id: `warn-${missionId}-missing-${cfg.id}`,
        contextPackId: '',
        type: 'missing-context',
        message: `Config variable ${cfg.name} is missing in environments: ${cfg.missingEnvironments.join(', ')}`,
        severity: 'warning',
        suggestedAction: `Set ${cfg.name} in the missing environments.`,
      });
    }

    // Estimate token usage (rough: ~100 tokens per item)
    const tokenUsage = items.length * 100;
    if (tokenUsage > tokenBudget) {
      warnings.push({
        id: `warn-${missionId}-token-budget`,
        contextPackId: '',
        type: 'token-budget-exceeded',
        message: `Context pack uses ~${tokenUsage} tokens, exceeding budget of ${tokenBudget}.`,
        severity: 'critical',
        suggestedAction: 'Reduce context items or increase token budget.',
      });
    }

    const now = new Date().toISOString();
    const pack: ContextPackEnriched = {
      id: `pack-${missionId}`,
      missionId,
      items,
      warnings,
      tokenUsage,
      contextUsage: Math.round((tokenUsage / tokenBudget) * 100),
      createdAt: now,
      updatedAt: now,
    };

    // Persist
    this.db.upsertContextPack(pack);

    return pack;
  }

  /** Pin an item in a context pack. */
  pinItem(packId: string, itemId: string): ContextPackEnriched {
    const pack = this.db.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);

    const item = pack.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found in pack`);

    item.pinned = true;
    pack.updatedAt = new Date().toISOString();
    this.db.upsertContextPack(pack);
    return pack;
  }

  /** Unpin an item in a context pack. */
  unpinItem(packId: string, itemId: string): ContextPackEnriched {
    const pack = this.db.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);

    const item = pack.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found in pack`);

    item.pinned = false;
    pack.updatedAt = new Date().toISOString();
    this.db.upsertContextPack(pack);
    return pack;
  }

  /** Swap a stale item for a fresh one. */
  swapStaleItem(packId: string, itemId: string): ContextPackEnriched {
    const pack = this.db.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);

    const item = pack.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found in pack`);

    // Refresh the item's freshness
    item.freshness = 'fresh';
    pack.updatedAt = new Date().toISOString();
    this.db.upsertContextPack(pack);
    return pack;
  }

  /** Get dashboard data for a context pack. */
  getDashboard(packId: string): {
    packId: string;
    totalItems: number;
    itemsByCategory: Record<string, number>;
    tokenUsage: number;
    contextUsage: number;
    warningCount: number;
    warnings: ContextWarning[];
    missingContext: Array<{ title: string; reason: string }>;
    tokenBudget: number;
    retrievalSource: string;
  } {
    const pack = this.db.getContextPack(packId);
    if (!pack) throw new Error(`Context pack ${packId} not found`);

    const itemsByCategory: Record<string, number> = {};
    for (const item of pack.items) {
      itemsByCategory[item.type] = (itemsByCategory[item.type] ?? 0) + 1;
    }

    return {
      packId: pack.id,
      totalItems: pack.items.length,
      itemsByCategory,
      tokenUsage: pack.tokenUsage,
      contextUsage: pack.contextUsage,
      warningCount: pack.warnings.length,
      warnings: pack.warnings,
      missingContext: pack.warnings
        .filter(w => w.type === 'missing-context')
        .map(w => ({ title: w.message, reason: w.suggestedAction ?? '' })),
      tokenBudget: DEFAULT_TOKEN_BUDGET,
      retrievalSource: 'local-index',
    };
  }
}
