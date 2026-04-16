/**
 * VerificationPanel — displays verification runs for the current mission.
 *
 * Shows:
 * - Verification runs list with status and verdict
 * - Individual check results per layer
 * - Missing required checks
 * - Verdict with reason
 */

import React, { useState, useEffect } from 'react';
import type { VerificationRun, VerificationBundle } from '../../../lib/shared-types';

interface VerificationPanelProps {
  mission?: { id: string } | null;
  projectId?: string;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ mission }) => {
  const missionId = mission?.id ?? '';
  const [runs, setRuns] = useState<VerificationRun[]>([]);
  const [bundles, setBundles] = useState<VerificationBundle[]>([]);
  const [selectedRun, setSelectedRun] = useState<VerificationRun | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVerificationData();
  }, [mission?.id]);

  const loadVerificationData = async () => {
    setLoading(true);
    try {
      const [runsData, bundlesData] = await Promise.all([
        window.vibeflow.verification.getRunsForMission(missionId),
        window.vibeflow.verification.getBundles(),
      ]);
      setRuns(runsData);
      setBundles(bundlesData);
      if (runsData.length > 0) {
        setSelectedRun(runsData[0]);
      }
    } catch (err) {
      console.error('[VerificationPanel] Failed to load verification data:', err);
    } finally {
      setLoading(false);
    }
  };

  const runVerification = async (bundleId?: string) => {
    if (!missionId) return;
    try {
      const result = await window.vibeflow.verification.run({
        missionId,
        bundleId,
      });
      setSelectedRun(result);
      await loadVerificationData();
    } catch (err) {
      console.error('[VerificationPanel] Failed to run verification:', err);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pass': return '#22c55e';
      case 'fail': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'blocked': return '#8b5cf6';
      case 'running': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getVerdictBadge = (verdict: string | null): { bg: string; text: string } => {
    switch (verdict) {
      case 'promote': return { bg: '#22c55e20', text: '#22c55e' };
      case 'block': return { bg: '#ef444420', text: '#ef4444' };
      case 'needs-review': return { bg: '#f59e0b20', text: '#f59e0b' };
      default: return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading verification data...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Verification Results</h3>
        <button
          style={styles.runButton}
          onClick={() => runVerification()}
          disabled={loading}
        >
          Run Verification
        </button>
      </div>

      {/* Verification runs list */}
      <div style={styles.runsList}>
        {runs.length === 0 ? (
          <p style={styles.emptyText}>No verification runs yet. Click "Run Verification" to start.</p>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              style={{
                ...styles.runItem,
                borderLeft: `3px solid ${getStatusColor(run.overallStatus)}`,
                backgroundColor: selectedRun?.id === run.id ? '#1e293b' : 'transparent',
              }}
              onClick={() => setSelectedRun(run)}
            >
              <div style={styles.runHeader}>
                <span style={styles.runStatus}>
                  <span style={{ ...styles.statusDot, backgroundColor: getStatusColor(run.overallStatus) }} />
                  {run.overallStatus}
                </span>
                <span style={styles.runTime}>{new Date(run.startedAt).toLocaleString()}</span>
              </div>
              {run.verdict && (
                <span style={{
                  ...styles.verdictBadge,
                  backgroundColor: getVerdictBadge(run.verdict).bg,
                  color: getVerdictBadge(run.verdict).text,
                }}>
                  {run.verdict}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selected run details */}
      {selectedRun && (
        <div style={styles.details}>
          <h4 style={styles.detailsTitle}>Verification Details</h4>

          {/* Verdict */}
          {selectedRun.verdict && (
            <div style={styles.verdictSection}>
              <span style={{
                ...styles.verdictBadge,
                backgroundColor: getVerdictBadge(selectedRun.verdict).bg,
                color: getVerdictBadge(selectedRun.verdict).text,
                fontSize: 14,
                padding: '4px 12px',
              }}>
                {selectedRun.verdict.toUpperCase()}
              </span>
              {selectedRun.verdictReason && (
                <p style={styles.verdictReason}>{selectedRun.verdictReason}</p>
              )}
            </div>
          )}

          {/* Check results by layer */}
          <div style={styles.checksSection}>
            <h5 style={styles.checksTitle}>Check Results</h5>
            {selectedRun.checks.map((check) => (
              <div key={check.id} style={styles.checkItem}>
                <span style={{
                  ...styles.checkStatus,
                  color: getStatusColor(check.status),
                }}>
                  {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'warning' ? '⚠' : '○'}
                </span>
                <div style={styles.checkInfo}>
                  <span style={styles.checkName}>{check.checkName}</span>
                  <span style={styles.checkLayer}>{check.layer}</span>
                  {check.detail && <span style={styles.checkDetail}>{check.detail}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Missing checks */}
          {selectedRun.missingRequiredChecks.length > 0 && (
            <div style={styles.missingSection}>
              <h5 style={styles.missingTitle}>Missing Required Checks</h5>
              {selectedRun.missingRequiredChecks.map((layer) => (
                <span key={layer} style={styles.missingTag}>{layer}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  runButton: {
    padding: '6px 16px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  loading: {
    padding: 16,
    color: '#94a3b8',
  },
  runsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  runItem: {
    padding: '8px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  runHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  runTime: {
    fontSize: 11,
    color: '#64748b',
  },
  verdictBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  details: {
    borderTop: '1px solid #1e293b',
    paddingTop: 16,
  },
  detailsTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontWeight: 600,
  },
  verdictSection: {
    marginBottom: 16,
  },
  verdictReason: {
    margin: '8px 0 0 0',
    fontSize: 13,
    color: '#94a3b8',
  },
  checksSection: {
    marginBottom: 16,
  },
  checksTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 500,
    color: '#94a3b8',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 0',
    borderBottom: '1px solid #1e293b20',
  },
  checkStatus: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
  },
  checkInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  checkName: {
    fontSize: 13,
    fontWeight: 500,
  },
  checkLayer: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  checkDetail: {
    fontSize: 11,
    color: '#94a3b8',
  },
  missingSection: {
    marginBottom: 16,
  },
  missingTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 500,
    color: '#ef4444',
  },
  missingTag: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#ef444420',
    color: '#ef4444',
    borderRadius: 4,
    fontSize: 11,
    marginRight: 4,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
};
