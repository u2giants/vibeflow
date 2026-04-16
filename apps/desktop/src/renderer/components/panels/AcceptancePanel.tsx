/**
 * AcceptancePanel — displays acceptance criteria for the current mission.
 *
 * Shows:
 * - Intended behavior
 * - Non-goals
 * - Paths that must still work
 * - Comparison targets
 * - Regression thresholds
 * - Rollback conditions
 */

import React, { useState, useEffect } from 'react';
import type { AcceptanceCriteria } from '../../../lib/shared-types';

interface AcceptancePanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

export const AcceptancePanel: React.FC<AcceptancePanelProps> = ({ mission }) => {
  const missionId = mission?.id ?? '';
  const [criteria, setCriteria] = useState<AcceptanceCriteria | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCriteria();
  }, [mission?.id]);

  const loadCriteria = async () => {
    if (!missionId) return;
    setLoading(true);
    try {
      const existing = await window.vibeflow.acceptance.get(missionId);
      if (existing) {
        setCriteria(existing);
      }
    } catch (err) {
      console.error('[AcceptancePanel] Failed to load acceptance criteria:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateCriteria = async () => {
    if (!missionId) return;
    setLoading(true);
    try {
      const result = await window.vibeflow.acceptance.generate({ missionId });
      setCriteria(result);
    } catch (err) {
      console.error('[AcceptancePanel] Failed to generate acceptance criteria:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading acceptance criteria...</div>;
  }

  if (!criteria) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Acceptance Criteria</h3>
        <p style={styles.emptyText}>No acceptance criteria defined for this mission.</p>
        <button style={styles.generateButton} onClick={generateCriteria}>
          Generate Acceptance Criteria
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Acceptance Criteria</h3>

      <Section title="Intended Behavior" items={criteria.intendedBehavior} color="#22c55e" />
      <Section title="Non-Goals" items={criteria.nonGoals} color="#64748b" />
      <Section title="Paths That Must Still Work" items={criteria.pathsThatMustStillWork} color="#3b82f6" />
      <Section title="Comparison Targets" items={criteria.comparisonTargets} color="#a855f7" />
      <Section title="Regression Thresholds" items={criteria.regressionThresholds} color="#f59e0b" />
      <Section title="Rollback Conditions" items={criteria.rollbackConditions} color="#ef4444" />

      <div style={styles.footer}>
        <span style={styles.updatedAt}>
          Updated: {new Date(criteria.updatedAt).toLocaleString()}
        </span>
        <button style={styles.regenerateButton} onClick={generateCriteria}>
          Regenerate
        </button>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; items: string[]; color: string }> = ({ title, items, color }) => (
  <div style={styles.section}>
    <h4 style={{ ...styles.sectionTitle, color }}>{title}</h4>
    <ul style={styles.list}>
      {items.map((item, i) => (
        <li key={i} style={styles.listItem}>{item}</li>
      ))}
    </ul>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: 16,
    overflow: 'auto',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: 16,
    fontWeight: 600,
  },
  loading: {
    padding: 16,
    color: '#94a3b8',
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  generateButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    marginTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    margin: 0,
    paddingLeft: 20,
  },
  listItem: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #1e293b',
  },
  updatedAt: {
    fontSize: 11,
    color: '#64748b',
  },
  regenerateButton: {
    padding: '6px 12px',
    backgroundColor: '#475569',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
};
