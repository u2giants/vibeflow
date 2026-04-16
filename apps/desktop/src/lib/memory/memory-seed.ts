/**
 * MemorySeed — one-time idempotent seed import from docs/decisions.md and docs/idiosyncrasies.md.
 *
 * These .md files serve as the human-readable backup; the database becomes the queryable source.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LocalDb } from '../storage/local-db';
import type { DecisionRecord, MemoryItem } from '../shared-types';

/**
 * Seed decision records from docs/decisions.md.
 * Idempotent: skips decisions that already exist by decision number.
 */
export function seedDecisionsFromDocs(localDb: LocalDb, projectId: string): number {
  const decisionsPath = path.resolve(__dirname, '../../../../docs/decisions.md');
  let content: string;
  try {
    content = fs.readFileSync(decisionsPath, 'utf-8');
  } catch {
    console.warn('[MemorySeed] Could not read docs/decisions.md — skipping seed');
    return 0;
  }

  // Parse "## Decision N — Title" headers
  const decisionRegex = /## Decision (\d+) — (.+?)\n([\s\S]*?)(?=## Decision \d+|$)/g;
  let match: RegExpExecArray | null;
  let count = 0;
  const now = new Date().toISOString();

  while ((match = decisionRegex.exec(content)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const body = match[3].trim();

    // Check if already exists (idempotent)
    const existing = localDb.getDecisionByNumber(projectId, number);
    if (existing) continue;

    // Extract fields from the markdown body
    const dateMatch = body.match(/\*\*Date:\*\*\s*(.+)/);
    const decidedByMatch = body.match(/\*\*Decided by:\*\*\s*(.+)/);
    const decisionMatch = body.match(/\*\*Decision:\*\*\s*(.+)/);
    const whyMatch = body.match(/\*\*Why this was chosen:\*\*\s*([\s\S]*?)(?=\*\*|\n---)/);
    const consequencesMatch = body.match(/\*\*Consequences:\*\*\s*\n([\s\S]*?)(?=\*\*|\n---)/);
    const alternativesMatch = body.match(/\*\*Alternatives considered:\*\*\s*\n([\s\S]*?)(?=\*\*Decision:|\*\*Why)/);

    const alternatives: Array<{ option: string; reason: string }> = [];
    if (alternativesMatch) {
      const altLines = alternativesMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
      for (const line of altLines) {
        const parts = line.replace(/^-\s*\*\*(.+?)\*\*\s*[:—-]?\s*/, '').trim();
        const optionMatch = line.match(/\*\*(.+?)\*\*/);
        alternatives.push({
          option: optionMatch ? optionMatch[1] : line.replace(/^-\s*/, '').trim(),
          reason: parts,
        });
      }
    }

    const consequences: string[] = [];
    if (consequencesMatch) {
      consequences.push(...consequencesMatch[1].split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*/, '').trim()));
    }

    const record: DecisionRecord = {
      id: `dec-seed-${number}`,
      projectId,
      decisionNumber: number,
      title,
      date: dateMatch ? dateMatch[1].trim() : now,
      decidedBy: decidedByMatch ? decidedByMatch[1].trim() : 'Unknown',
      decision: decisionMatch ? decisionMatch[1].trim() : body.slice(0, 200),
      alternativesConsidered: alternatives,
      rationale: whyMatch ? whyMatch[1].trim().replace(/\n/g, ' ').slice(0, 500) : '',
      consequences,
      relatedFiles: [],
      tags: extractTags(title, body),
      isActive: true,
      supersededBy: null,
      createdAt: now,
      updatedAt: now,
    };

    localDb.upsertDecisionRecord(record);
    count++;
  }

  console.log(`[MemorySeed] Seeded ${count} decision records from docs/decisions.md`);
  return count;
}

/**
 * Seed memory items from docs/idiosyncrasies.md.
 * Idempotent: skips if a memory item with the same sourceMaterial already exists.
 */
export function seedIdiosyncrasiesFromDocs(localDb: LocalDb, projectId: string): number {
  const idioPath = path.resolve(__dirname, '../../../../docs/idiosyncrasies.md');
  let content: string;
  try {
    content = fs.readFileSync(idioPath, 'utf-8');
  } catch {
    console.warn('[MemorySeed] Could not read docs/idiosyncrasies.md — skipping seed');
    return 0;
  }

  // Parse "### N. Title" headers within the Entries section
  const entryRegex = /### (\d+)\.\s*(.+?)\n([\s\S]*?)(?=### \d+\.|## How to Add|## Entries|$)/g;
  let match: RegExpExecArray | null;
  let count = 0;
  const now = new Date().toISOString();

  while ((match = entryRegex.exec(content)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const body = match[3].trim();
    const sourceMaterial = `docs/idiosyncrasies.md#${number}`;

    // Check if already exists (idempotent)
    const existing = localDb.listMemoryItems(projectId, { category: 'idiosyncrasy' });
    if (existing.some(item => item.sourceMaterial === sourceMaterial)) continue;

    // Extract what/where/why from the body
    const whatMatch = body.match(/\*\*What looks odd:\*\*\s*(.+)/);
    const whereMatch = body.match(/\*\*Where it is:\*\*\s*(.+)/);
    const whyMatch = body.match(/\*\*Why it was done:\*\*\s*([\s\S]*?)(?=\*\*What breaks|\*\*Permanent)/);
    const breaksMatch = body.match(/\*\*What breaks if cleaned up:\*\*\s*(.+)/);
    const permMatch = body.match(/\*\*Permanent or temporary:\*\*\s*(.+)/);

    const description = [
      whatMatch ? whatMatch[1].trim() : '',
      whereMatch ? `Location: ${whereMatch[1].trim()}` : '',
      whyMatch ? `Reason: ${whyMatch[1].trim().replace(/\n/g, ' ').slice(0, 300)}` : '',
      breaksMatch ? `Risk if changed: ${breaksMatch[1].trim()}` : '',
    ].filter(Boolean).join('\n');

    const item: MemoryItem = {
      id: `mem-seed-idio-${number}`,
      projectId,
      category: 'idiosyncrasy',
      title: `Idiosyncrasy #${number}: ${title}`,
      scope: whereMatch ? whereMatch[1].trim() : 'codebase',
      tags: extractTags(title, body),
      description,
      freeFormNotes: permMatch ? `Status: ${permMatch[1].trim()}` : null,
      examples: [],
      triggerConditions: extractTags(title, body),
      freshnessNotes: `Seeded from docs/idiosyncrasies.md entry #${number}`,
      sourceMaterial,
      owner: 'architect',
      reviewer: null,
      lastReviewedAt: null,
      revisionHistory: [{
        revisionNumber: 1,
        changedAt: now,
        changedBy: 'system',
        changeSummary: 'Seeded from docs/idiosyncrasies.md',
        conversationId: null,
      }],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    localDb.upsertMemoryItem(item);
    count++;
  }

  console.log(`[MemorySeed] Seeded ${count} idiosyncrasy memory items from docs/idiosyncrasies.md`);
  return count;
}

/** Extract relevant tags from text. */
function extractTags(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const tags: string[] = [];

  if (text.includes('oauth') || text.includes('auth') || text.includes('sign-in')) tags.push('auth');
  if (text.includes('electron') || text.includes('vite') || text.includes('build')) tags.push('build');
  if (text.includes('sqlite') || text.includes('sql.js') || text.includes('database')) tags.push('database');
  if (text.includes('sync') || text.includes('supabase')) tags.push('sync');
  if (text.includes('exfat') || text.includes('symlink') || text.includes('pnpm')) tags.push('monorepo');
  if (text.includes('openrouter') || text.includes('model') || text.includes('api')) tags.push('api');
  if (text.includes('listener') || text.includes('preload') || text.includes('ipc')) tags.push('ipc');
  if (text.includes('handoff') || text.includes('docs')) tags.push('handoff');

  return [...new Set(tags)];
}
