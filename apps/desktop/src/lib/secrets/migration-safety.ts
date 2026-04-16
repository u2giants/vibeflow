/** Migration safety — classifies SQL risk, generates previews, and determines checkpoint requirements. */

import type { MigrationRiskClass, MigrationSafeguard, MigrationPreview, MigrationPlan } from '../shared-types';

/** Classify the risk of a SQL statement or migration script. */
export function classifyRisk(sql: string): { riskClass: MigrationRiskClass; safeguards: MigrationSafeguard[] } {
  const normalized = sql.toLowerCase().trim();

  // Destructive schema operations
  if (normalized.includes('drop table') || normalized.includes('drop column') || normalized.includes('alter column type') || normalized.includes('alter column data type')) {
    return {
      riskClass: 'destructive-schema',
      safeguards: [
        { type: 'backup-required', description: 'Full database backup required before execution', required: true, satisfied: false },
        { type: 'rollback-script', description: 'Rollback script must be prepared', required: true, satisfied: false },
        { type: 'human-approval', description: 'Human approval required', required: true, satisfied: false },
      ],
    };
  }

  // Auth/identity table changes
  if (normalized.includes('auth') || normalized.includes('identity') || normalized.includes('user') || normalized.includes('session') || normalized.includes('token')) {
    if (normalized.includes('alter') || normalized.includes('drop') || normalized.includes('modify')) {
      return {
        riskClass: 'auth-identity',
        safeguards: [
          { type: 'session-impact-review', description: 'Review impact on active sessions', required: true, satisfied: false },
          { type: 'human-approval', description: 'Human approval required', required: true, satisfied: false },
        ],
      };
    }
  }

  // Data rewrite operations
  if (normalized.includes('update ') && normalized.includes('set ') || normalized.includes('delete from') || normalized.includes('insert into')) {
    return {
      riskClass: 'data-rewrite',
      safeguards: [
        { type: 'data-backup', description: 'Backup affected rows before execution', required: true, satisfied: false },
        { type: 'dry-run', description: 'Run dry-run first to verify affected rows', required: true, satisfied: false },
      ],
    };
  }

  // Index/performance operations
  if (normalized.includes('create index') || normalized.includes('drop index') || normalized.includes('create unique index')) {
    return {
      riskClass: 'index-performance',
      safeguards: [
        { type: 'performance-test', description: 'Test query performance before and after', required: false, satisfied: false },
      ],
    };
  }

  // Backfill operations
  if (normalized.includes('update ') && normalized.includes('where') || normalized.includes('backfill')) {
    return {
      riskClass: 'backfill-required',
      safeguards: [
        { type: 'batch-processing', description: 'Process in batches to avoid lock contention', required: true, satisfied: false },
      ],
    };
  }

  // Additive-safe operations
  if (normalized.includes('create table') || normalized.includes('alter table') && normalized.includes('add column')) {
    return {
      riskClass: 'additive-safe',
      safeguards: [
        { type: 'syntax-check', description: 'Verify SQL syntax before execution', required: true, satisfied: false },
      ],
    };
  }

  // Default: treat unrecognized patterns as potentially destructive
  return {
    riskClass: 'destructive-schema',
    safeguards: [
      { type: 'manual-review', description: 'Unrecognized pattern — manual review required', required: true, satisfied: false },
      { type: 'backup-required', description: 'Full database backup required', required: true, satisfied: false },
    ],
  };
}

/** Generate a migration preview from a plan. */
export function generatePreview(plan: MigrationPlan): MigrationPreview {
  const destructiveOps: string[] = [];
  const warnings: string[] = [];

  if (plan.riskClass === 'destructive-schema') {
    destructiveOps.push('Schema structure will be modified');
    warnings.push('This migration cannot be automatically rolled back');
  }

  if (plan.riskClass === 'data-rewrite') {
    destructiveOps.push('Existing data will be modified');
    warnings.push('Verify data backup before proceeding');
  }

  if (plan.requiresCheckpoint) {
    warnings.push('A checkpoint is required before this migration');
  }

  if (plan.approvalRequired) {
    warnings.push('Human approval is required for this migration');
  }

  return {
    planId: plan.id,
    sqlPreview: `-- Migration: ${plan.description}\n-- Risk: ${plan.riskClass}\n-- Affected tables: ${plan.affectedTables.join(', ')}`,
    affectedEntities: plan.affectedTables,
    destructiveOperations: destructiveOps,
    estimatedDowntime: plan.riskClass === 'destructive-schema' ? 'Unknown — depends on table size' : null,
    warnings,
  };
}

/** Determine if a checkpoint is required based on risk class. */
export function requiresCheckpoint(riskClass: MigrationRiskClass): boolean {
  return riskClass === 'destructive-schema' || riskClass === 'data-rewrite' || riskClass === 'auth-identity';
}

/** Determine the ordering requirement based on risk class. */
export function orderingRequirement(riskClass: MigrationRiskClass): 'app-first' | 'schema-first' | 'simultaneous' {
  switch (riskClass) {
    case 'additive-safe':
      return 'schema-first';
    case 'backfill-required':
      return 'simultaneous';
    case 'index-performance':
      return 'app-first';
    case 'destructive-schema':
      return 'schema-first';
    case 'data-rewrite':
      return 'simultaneous';
    case 'auth-identity':
      return 'schema-first';
  }
}

/** Determine if approval is required based on risk class. */
export function approvalRequired(riskClass: MigrationRiskClass): boolean {
  return riskClass === 'destructive-schema' || riskClass === 'data-rewrite' || riskClass === 'auth-identity';
}
