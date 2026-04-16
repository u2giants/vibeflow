/**
 * MemoryRetriever — deterministic tag/trigger/keyword-based retrieval engine.
 *
 * NO vector DB, NO embeddings. Retrieval is purely keyword overlap scoring.
 */

import type { MemoryItem, Skill, DecisionRecord, MemoryRetrievalResult, MemoryCategory } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

const DEFAULT_TOKEN_BUDGET = 20_000; // rough token cap for memory injection

export class MemoryRetriever {
  private db: LocalDb;
  private projectId: string;

  constructor(db: LocalDb, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  /** Primary retrieval entry point — matches mission intent to memory items. */
  retrieveForMission(
    missionId: string,
    missionTitle: string,
    operatorRequest: string
  ): MemoryRetrievalResult {
    const keywords = this.extractKeywords(missionTitle, operatorRequest);
    const triggerText = `${missionTitle} ${operatorRequest}`.toLowerCase();

    // Retrieve by tag/trigger matching
    const items = this.db.searchMemoryItems(this.projectId, {
      tags: keywords,
      triggerMatch: triggerText,
    });

    // Retrieve skills by trigger
    const allSkills = this.db.listSkills(this.projectId, true);
    const matchedSkills = allSkills.filter(skill =>
      skill.triggerConditions.some(tc =>
        keywords.some(kw => tc.toLowerCase().includes(kw)) ||
        triggerText.includes(tc.toLowerCase())
      )
    );

    // Retrieve decisions by tag
    const allDecisions = this.db.listDecisionRecords(this.projectId, true);
    const matchedDecisions = allDecisions.filter(dec =>
      dec.tags.some(tag => keywords.some(kw => tag.toLowerCase().includes(kw)))
    );

    // Score and rank items
    const scored = items.map(item => {
      let score = 0;
      for (const kw of keywords) {
        if (item.tags.some(t => t.toLowerCase().includes(kw))) score += 2;
        if (item.triggerConditions.some(t => t.toLowerCase().includes(kw))) score += 1;
        if (item.title.toLowerCase().includes(kw)) score += 3;
      }
      return { item, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Apply token budget cap (rough: ~150 tokens per item)
    const TOKENS_PER_ITEM = 150;
    let budget = DEFAULT_TOKEN_BUDGET;
    const cappedItems: MemoryItem[] = [];
    for (const { item } of scored) {
      if (budget - TOKENS_PER_ITEM < 0) break;
      cappedItems.push(item);
      budget -= TOKENS_PER_ITEM;
    }

    const totalTokenEstimate =
      cappedItems.length * TOKENS_PER_ITEM +
      matchedSkills.length * 200 +
      matchedDecisions.length * 150;

    const retrievalReason = keywords.length > 0
      ? `Matched keywords: ${keywords.slice(0, 5).join(', ')}`
      : 'No keyword matches — returning all active items';

    return {
      items: cappedItems,
      skills: matchedSkills,
      decisions: matchedDecisions,
      retrievalReason,
      triggerMatch: triggerText.slice(0, 100),
      totalTokenEstimate,
    };
  }

  /** Tag-based lookup. */
  retrieveByTags(projectId: string, tags: string[]): MemoryItem[] {
    return this.db.searchMemoryItems(projectId, { tags });
  }

  /** Trigger-condition matching. */
  retrieveByTrigger(projectId: string, triggerText: string): MemoryRetrievalResult {
    const items = this.db.searchMemoryItems(projectId, { triggerMatch: triggerText });
    const skills = this.db.listSkills(projectId, true).filter(s =>
      s.triggerConditions.some(tc => triggerText.toLowerCase().includes(tc.toLowerCase()))
    );
    const decisions = this.db.listDecisionRecords(projectId, true);

    return {
      items,
      skills,
      decisions,
      retrievalReason: `Trigger match: "${triggerText.slice(0, 50)}"`,
      triggerMatch: triggerText,
      totalTokenEstimate: items.length * 150 + skills.length * 200 + decisions.length * 150,
    };
  }

  /** Operator-pinned items. */
  getPinnedPacks(projectId: string): MemoryItem[] {
    // For now, return all active items — pinning is a UI-level concept
    // In a future iteration, we'd add a `pinned` column to memory_items
    return this.db.listMemoryItems(projectId, { activeOnly: true });
  }

  /** Rough token count estimation. */
  estimateTokenCount(result: MemoryRetrievalResult): number {
    return result.totalTokenEstimate;
  }

  /** Extract keywords from mission title and operator request. */
  private extractKeywords(missionTitle: string, operatorRequest: string): string[] {
    const text = `${missionTitle} ${operatorRequest}`.toLowerCase();
    // Split on non-alphanumeric, filter short words and common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because',
      'but', 'and', 'or', 'if', 'while', 'about', 'this', 'that', 'these',
      'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
      'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what',
      'which', 'who', 'whom',
    ]);

    return text
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }
}
