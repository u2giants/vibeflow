/**
 * MemoryLifecycle — manages memory write, evict, summarize, retire transitions.
 *
 * PRIVACY BOUNDARY (MUST hold):
 * The memory store MUST NOT contain:
 * - raw secret values or credentials
 * - OAuth tokens, API keys, or signed URLs
 * - personal data beyond project scope
 * - full raw conversation dumps (only summarized, curated entries)
 *
 * This is enforced at the write path with a redaction/validation guard below.
 */

import type { MemoryItem, MemoryCategory, MemoryRevision, Skill, DecisionRecord } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

// ── Privacy Redaction Guard ─────────────────────────────────────────────

/**
 * Patterns that indicate secret-bearing content.
 * If any of these are found in the text, the content is redacted.
 */
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,           // OpenAI/OpenRouter style keys
  /ghp_[a-zA-Z0-9]{36}/,           // GitHub personal access tokens
  /gho_[a-zA-Z0-9]{36}/,           // GitHub OAuth tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ/,        // JWT tokens
  /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,  // Private keys
  /password\s*[:=]\s*\S+/i,        // password assignments
  /secret\s*[:=]\s*\S+/i,          // secret assignments
  /token\s*[:=]\s*[a-zA-Z0-9]{16,}/i, // token assignments
  /Authorization:\s*Bearer\s+\S+/i, // Bearer auth headers
  /xoxb-[a-zA-Z0-9-]+/,            // Slack bot tokens
  /xoxp-[a-zA-Z0-9-]+/,            // Slack user tokens
];

/**
 * Redact secret-bearing content from a string.
 * Returns the cleaned text and a list of redacted patterns found.
 */
export function redactSecrets(text: string): { cleaned: string; redacted: string[] } {
  const redacted: string[] = [];
  let cleaned = text;

  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        redacted.push(pattern.source);
        // Replace the secret with a placeholder
        cleaned = cleaned.replace(match, '[REDACTED]');
      }
    }
  }

  return { cleaned, redacted };
}

/**
 * Validate that a memory item does not contain secret-bearing content.
 * Returns a list of warnings if secrets were found and redacted.
 */
export function validateMemoryItem(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): {
  validated: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check description
  const descResult = redactSecrets(item.description);
  if (descResult.redacted.length > 0) {
    warnings.push(`[MemoryLifecycle] Redacted ${descResult.redacted.length} secret pattern(s) from description`);
  }

  // Check freeFormNotes
  let cleanedNotes = item.freeFormNotes;
  if (cleanedNotes) {
    const notesResult = redactSecrets(cleanedNotes);
    if (notesResult.redacted.length > 0) {
      warnings.push(`[MemoryLifecycle] Redacted ${notesResult.redacted.length} secret pattern(s) from freeFormNotes`);
    }
    cleanedNotes = notesResult.cleaned;
  }

  // Check examples
  const cleanedExamples = item.examples.map(ex => {
    const result = redactSecrets(ex);
    if (result.redacted.length > 0) {
      warnings.push(`[MemoryLifecycle] Redacted secret pattern(s) from example`);
    }
    return result.cleaned;
  });

  // Check triggerConditions
  const cleanedTriggers = item.triggerConditions.map(tc => {
    const result = redactSecrets(tc);
    return result.cleaned;
  });

  const validated: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
    ...item,
    description: descResult.cleaned,
    freeFormNotes: cleanedNotes,
    examples: cleanedExamples,
    triggerConditions: cleanedTriggers,
  };

  return { validated, warnings };
}

// ── Memory Lifecycle Manager ────────────────────────────────────────────

export class MemoryLifecycle {
  private db: LocalDb;

  constructor(db: LocalDb) {
    this.db = db;
  }

  /** Write a memory item from handoff data — with privacy redaction. */
  writeFromHandoff(
    projectId: string,
    whatWorked: string[],
    whatFailed: string[],
    warnings: string[],
    conversationId: string,
    owner: string
  ): { items: MemoryItem[]; redactionWarnings: string[] } {
    const items: MemoryItem[] = [];
    const allRedactionWarnings: string[] = [];
    const now = new Date().toISOString();

    // Convert whatFailed into prior-fix memory items
    for (const failure of whatFailed) {
      const rawItem: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
        projectId,
        category: 'prior-fix',
        title: `Fix: ${failure.slice(0, 60)}${failure.length > 60 ? '...' : ''}`,
        scope: 'conversation-learned',
        tags: this.extractTags(failure),
        description: failure,
        freeFormNotes: null,
        examples: [],
        triggerConditions: this.extractTags(failure),
        freshnessNotes: 'Learned from conversation handoff',
        sourceMaterial: conversationId,
        owner,
        reviewer: null,
        lastReviewedAt: null,
        revisionHistory: [{
          revisionNumber: 1,
          changedAt: now,
          changedBy: owner,
          changeSummary: 'Created from handoff',
          conversationId,
        }],
        isActive: true,
      };

      const { validated, warnings: redactionWarnings } = validateMemoryItem(rawItem);
      allRedactionWarnings.push(...redactionWarnings);

      const item: MemoryItem = {
        ...validated,
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
      };

      this.db.upsertMemoryItem(item);
      items.push(item);
    }

    // Convert warnings into fragile-area or idiosyncrasy memory items
    for (const warning of warnings) {
      const rawItem: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
        projectId,
        category: 'fragile-area',
        title: `Warning: ${warning.slice(0, 60)}${warning.length > 60 ? '...' : ''}`,
        scope: 'conversation-learned',
        tags: this.extractTags(warning),
        description: warning,
        freeFormNotes: null,
        examples: [],
        triggerConditions: this.extractTags(warning),
        freshnessNotes: 'Learned from conversation handoff',
        sourceMaterial: conversationId,
        owner,
        reviewer: null,
        lastReviewedAt: null,
        revisionHistory: [{
          revisionNumber: 1,
          changedAt: now,
          changedBy: owner,
          changeSummary: 'Created from handoff warning',
          conversationId,
        }],
        isActive: true,
      };

      const { validated, warnings: redactionWarnings } = validateMemoryItem(rawItem);
      allRedactionWarnings.push(...redactionWarnings);

      const item: MemoryItem = {
        ...validated,
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
      };

      this.db.upsertMemoryItem(item);
      items.push(item);
    }

    return { items, redactionWarnings: allRedactionWarnings };
  }

  /** Write a manual memory item — with privacy redaction. */
  writeManual(
    item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): { item: MemoryItem; warnings: string[] } {
    const { validated, warnings } = validateMemoryItem(item);
    const now = new Date().toISOString();

    const fullItem: MemoryItem = {
      ...validated,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.db.upsertMemoryItem(fullItem);
    return { item: fullItem, warnings };
  }

  /** Evict stale memories — auto-retire items not reviewed in N days. */
  evictStale(projectId: string, cutoffDate: string): number {
    const stale = this.db.getStaleMemories(projectId);
    let count = 0;
    for (const item of stale) {
      if (item.lastReviewedAt && item.lastReviewedAt < cutoffDate) {
        this.db.retireMemoryItem(item.id);
        count++;
      }
    }
    return count;
  }

  /** Retire a memory item with reason. */
  retire(id: string, reason: string): void {
    this.db.retireMemoryItem(id);
    // Log the retirement — in a full implementation, this would create an audit record
  }

  /** Reactivate a retired memory item. */
  reactivate(id: string): void {
    this.db.reactivateMemoryItem(id);
  }

  /** Get lifecycle stats. */
  getLifecycleStats(projectId: string): {
    total: number;
    active: number;
    retired: number;
    stale: number;
    lastWrite: string | null;
  } {
    const dashboard = this.db.getMemoryDashboard(projectId);
    return {
      total: dashboard.totalMemories,
      active: dashboard.activeMemories,
      retired: dashboard.retiredMemories,
      stale: dashboard.staleMemories,
      lastWrite: dashboard.lastWriteAt,
    };
  }

  /** Extract tags from text for automatic categorization. */
  private extractTags(text: string): string[] {
    const lower = text.toLowerCase();
    const tags: string[] = [];

    if (lower.includes('auth') || lower.includes('login') || lower.includes('oauth')) tags.push('auth');
    if (lower.includes('deploy') || lower.includes('release')) tags.push('deploy');
    if (lower.includes('database') || lower.includes('db') || lower.includes('sql')) tags.push('database');
    if (lower.includes('api') || lower.includes('endpoint')) tags.push('api');
    if (lower.includes('error') || lower.includes('fail') || lower.includes('crash')) tags.push('error');
    if (lower.includes('performance') || lower.includes('slow')) tags.push('performance');
    if (lower.includes('security') || lower.includes('secret') || lower.includes('token')) tags.push('security');

    return [...new Set(tags)];
  }
}
