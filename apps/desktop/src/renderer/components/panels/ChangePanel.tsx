/** ChangePanel — displays semantic change groups, blast radius, verification state, and raw diff drill-down. */

import { useState, useEffect, useCallback } from 'react';
import type { ChangeSet, SemanticChangeGroup, FileEdit, DuplicateWarning, Checkpoint, EvidenceItem } from '../../../lib/shared-types';

interface ChangePanelProps {
  workspaceRunId?: string;
}

export default function ChangePanel({ workspaceRunId }: ChangePanelProps) {
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [semanticGroups, setSemanticGroups] = useState<SemanticChangeGroup[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFileEdit, setSelectedFileEdit] = useState<FileEdit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!workspaceRunId) return;
    setLoading(true);
    setError(null);
    try {
      const [cs, groups, warnings, cps] = await Promise.all([
        window.vibeflow.changeEngine.getChangeSet(workspaceRunId),
        window.vibeflow.changeEngine.getSemanticGroups(workspaceRunId),
        window.vibeflow.changeEngine.getDuplicateWarnings(workspaceRunId),
        window.vibeflow.changeEngine.listCheckpoints(workspaceRunId),
      ]);
      setChangeSet(cs);
      setSemanticGroups(groups);
      setDuplicateWarnings(warnings);
      setCheckpoints(cps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load change data');
    } finally {
      setLoading(false);
    }
  }, [workspaceRunId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getFileEditById = (id: string): FileEdit | undefined => {
    return changeSet?.fileEdits.find(e => e.id === id);
  };

  const getVerificationSummary = (items: EvidenceItem[]): { pass: number; fail: number; warning: number; skipped: number } => {
    const summary = { pass: 0, fail: 0, warning: 0, skipped: 0 };
    for (const item of items) {
      if (item.status === 'pass') summary.pass++;
      else if (item.status === 'fail') summary.fail++;
      else if (item.status === 'warning') summary.warning++;
      else summary.skipped++;
    }
    return summary;
  };

  const blastRadiusColor = (radius: string): string => {
    switch (radius) {
      case 'critical': return '#dc2626';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#22c55e';
    }
  };

  if (!workspaceRunId) {
    return (
      <div style={{ color: '#484f58', fontSize: 13 }}>
        <p style={{ margin: '0 0 8px 0' }}>Change panel</p>
        <p style={{ margin: 0 }}>
          Select an active workspace run to view changes. Changes are grouped by meaning
          rather than file order, with blast radius indicators and verification status.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: '#484f58', fontSize: 13 }}>Loading changes...</div>;
  }

  if (error) {
    return <div style={{ color: '#dc2626', fontSize: 13 }}>Error: {error}</div>;
  }

  if (!changeSet && semanticGroups.length === 0) {
    return (
      <div style={{ color: '#484f58', fontSize: 13 }}>
        <p style={{ margin: '0 0 8px 0' }}>No changes yet</p>
        <p style={{ margin: 0 }}>
          Apply patches to the workspace to see semantic change groups, blast radius,
          and verification results here.
        </p>
      </div>
    );
  }

  const verificationSummary = changeSet ? getVerificationSummary(changeSet.verificationState) : null;

  return (
    <div style={{ color: '#e2e8f0', fontSize: 13, overflow: 'auto', height: '100%' }}>
      {/* Summary header */}
      {changeSet && (
        <div style={{ marginBottom: 12, padding: 8, background: '#1e293b', borderRadius: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{changeSet.summary}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              background: blastRadiusColor(changeSet.blastRadius), color: '#000',
            }}>
              Blast: {changeSet.blastRadius}
            </span>
            {verificationSummary && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Checks: {verificationSummary.pass} pass, {verificationSummary.fail} fail, {verificationSummary.warning} warn, {verificationSummary.skipped} skip
              </span>
            )}
            {checkpoints.length > 0 && (
              <span style={{ fontSize: 11, color: '#22c55e' }}>
                {checkpoints.length} checkpoint{checkpoints.length > 1 ? 's' : ''} available
              </span>
            )}
          </div>
        </div>
      )}

      {/* Duplicate warnings */}
      {duplicateWarnings.length > 0 && (
        <div style={{ marginBottom: 12, padding: 8, background: '#451a03', borderRadius: 4, border: '1px solid #f97316' }}>
          <div style={{ fontWeight: 600, color: '#f97316', marginBottom: 4 }}>Duplicate Warnings</div>
          {duplicateWarnings.map(w => (
            <div key={w.id} style={{ fontSize: 12, marginBottom: 4 }}>
              <div>{w.warning}</div>
              {w.reuseSuggestion && (
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  Consider reusing: {w.reuseSuggestion.existingSymbol} at {w.reuseSuggestion.existingPath}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Semantic change groups */}
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Change Groups</div>
      {semanticGroups.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        return (
          <div key={group.id} style={{ marginBottom: 8, background: '#1e293b', borderRadius: 4 }}>
            <div
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => toggleGroup(group.id)}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{group.label}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>
                  {group.fileEdits.length} file{group.fileEdits.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span style={{
                padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: blastRadiusColor(group.blastRadius), color: '#000',
              }}>
                {group.blastRadius}
              </span>
            </div>
            {isExpanded && (
              <div style={{ padding: '0 12px 8px' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{group.description}</div>
                {group.fileEdits.map(editId => {
                  const edit = getFileEditById(editId);
                  if (!edit) return null;
                  return (
                    <div
                      key={edit.id}
                      style={{
                        padding: '4px 8px', margin: '2px 0', background: '#0f172a', borderRadius: 3,
                        cursor: 'pointer', fontSize: 12,
                        border: selectedFileEdit?.id === edit.id ? '1px solid #3b82f6' : '1px solid transparent',
                      }}
                      onClick={() => setSelectedFileEdit(edit)}
                    >
                      <span style={{ color: edit.operation === 'create' ? '#22c55e' : edit.operation === 'delete' ? '#dc2626' : '#eab308' }}>
                        [{edit.operation}]
                      </span>{' '}
                      {edit.filePath}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Raw diff drill-down */}
      {selectedFileEdit && (
        <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>Diff: {selectedFileEdit.filePath}</span>
            <button
              onClick={() => setSelectedFileEdit(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <pre style={{
            fontSize: 11, overflow: 'auto', maxHeight: 200, color: '#94a3b8',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {selectedFileEdit.diff}
          </pre>
          {selectedFileEdit.validityResults.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Validity:</div>
              {selectedFileEdit.validityResults.map(v => (
                <div key={v.id} style={{ color: v.status === 'pass' ? '#22c55e' : v.status === 'fail' ? '#dc2626' : '#eab308' }}>
                  {v.title}: {v.status}{v.detail ? ` — ${v.detail.slice(0, 100)}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
