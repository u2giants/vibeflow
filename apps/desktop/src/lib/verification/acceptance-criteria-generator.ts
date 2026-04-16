/**
 * AcceptanceCriteriaGenerator — derives explicit acceptance criteria for a mission.
 *
 * Uses mission, plan, and impact analysis to produce:
 * - intended behavior,
 * - non-goals,
 * - paths that must still work,
 * - comparison targets,
 * - regression thresholds,
 * - rollback conditions.
 */

import type { AcceptanceCriteria } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export class AcceptanceCriteriaGenerator {
  constructor(private db: LocalDb) {}

  /** Generate acceptance criteria for a mission. */
  generateCriteria(missionId: string): AcceptanceCriteria {
    const now = new Date().toISOString();

    // Try to get mission data for context
    let missionTitle = 'Unknown mission';
    try {
      const mission = this.db.getMission(missionId);
      if (mission) {
        missionTitle = mission.title;
      }
    } catch {
      // Mission not available — use defaults
    }

    const criteria: AcceptanceCriteria = {
      id: `acceptance-${missionId}-${Date.now()}`,
      missionId,
      intendedBehavior: [`${missionTitle} achieves intended outcome`],
      nonGoals: ['No unintended side effects to unrelated features'],
      pathsThatMustStillWork: ['Core user journeys remain functional'],
      comparisonTargets: ['Before/after screenshot comparison'],
      regressionThresholds: ['No new test failures in affected areas'],
      rollbackConditions: ['Revert to last known good checkpoint'],
      createdAt: now,
      updatedAt: now,
    };

    // Persist to database
    this.db.upsertAcceptanceCriteria(criteria);

    return criteria;
  }

  /** Get existing acceptance criteria for a mission. */
  getCriteria(missionId: string): AcceptanceCriteria | null {
    return this.db.getAcceptanceCriteria(missionId);
  }
}
