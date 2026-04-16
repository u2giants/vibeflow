/**
 * MemoryPanel — UI for Component 20: Memory, Skills, and Decision Knowledge.
 *
 * 4 tabs: Memories, Skills, Decisions, Lifecycle
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { MemoryItem, Skill, DecisionRecord, MemoryCategory, MemoryDashboard } from '../../../lib/shared-types';

interface MemoryPanelProps {
  projectId?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'prior-fix': '#e74c3c',
  'architecture-rule': '#3498db',
  'deployment-rule': '#2ecc71',
  'auth-identity': '#9b59b6',
  'provider-gotcha': '#e67e22',
  'style-pattern': '#1abc9c',
  'incident-postmortem': '#c0392b',
  'idiosyncrasy': '#f39c12',
  'fragile-area': '#d35400',
  'coding-standard': '#2980b9',
  'release-rule': '#27ae60',
  'skill-runbook': '#8e44ad',
};

const MemoryPanel: React.FC<MemoryPanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'memories' | 'skills' | 'decisions' | 'lifecycle'>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [memRes, skillRes, decRes, dashRes] = await Promise.all([
        window.vibeflow.memory.list(projectId),
        window.vibeflow.skills.list(projectId),
        window.vibeflow.decisions.list(projectId),
        window.vibeflow.memory.getDashboard(projectId),
      ]);
      setMemories(memRes);
      setSkills(skillRes);
      setDecisions(decRes);
      setDashboard(dashRes);
    } catch (err) {
      console.error('[MemoryPanel] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetire = async (id: string) => {
    if (!projectId) return;
    await window.vibeflow.memory.retire(id, 'Retired by operator');
    loadData();
  };

  const handleReactivate = async (id: string) => {
    await window.vibeflow.memory.reactivate(id);
    loadData();
  };

  const handleSkillRetire = async (id: string) => {
    await window.vibeflow.skills.retire(id);
    loadData();
  };

  const handleSupersede = async (id: string) => {
    if (!projectId) return;
    // In a full implementation, this would open a dialog to select the superseding decision
    const newId = prompt('Enter the ID of the superseding decision:');
    if (newId) {
      await window.vibeflow.decisions.supersede(id, newId);
      loadData();
    }
  };

  const handleEvictStale = async () => {
    if (!projectId) return;
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const count = await window.vibeflow.memory.evictStale(projectId, cutoff);
    alert(`Retired ${count} stale memory items.`);
    loadData();
  };

  const handleSummarize = async (category: MemoryCategory) => {
    if (!projectId) return;
    if (!confirm(`Summarize all active "${category}" items into one? Originals will be retired.`)) return;
    await window.vibeflow.memory.summarizeGroup(projectId, category);
    loadData();
  };

  const tabs = [
    { key: 'memories' as const, label: `Memories (${memories.length})` },
    { key: 'skills' as const, label: `Skills (${skills.length})` },
    { key: 'decisions' as const, label: `Decisions (${decisions.length})` },
    { key: 'lifecycle' as const, label: 'Lifecycle' },
  ];

  const getStalenessLabel = (item: MemoryItem) => {
    if (!item.lastReviewedAt) return { label: 'Never reviewed', color: '#95a5a6' };
    const days = Math.floor((Date.now() - new Date(item.lastReviewedAt).getTime()) / 86400000);
    if (days > 30) return { label: `Stale (${days}d)`, color: '#e74c3c' };
    if (days > 14) return { label: `${days}d ago`, color: '#f39c12' };
    return { label: `${days}d ago`, color: '#2ecc71' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e2e', color: '#cdd6f4' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #313244', padding: '0 8px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab.key ? '#313244' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #89b4fa' : '2px solid transparent',
              color: activeTab === tab.key ? '#89b4fa' : '#a6adc8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading && <p style={{ color: '#a6adc8' }}>Loading...</p>}

        {/* ── Memories Tab ── */}
        {activeTab === 'memories' && (
          <div>
            {memories.length === 0 && <p style={{ color: '#a6adc8' }}>No memory items yet.</p>}
            {memories.map(mem => {
              const staleness = getStalenessLabel(mem);
              const isExpanded = expandedId === mem.id;
              return (
                <div
                  key={mem.id}
                  style={{
                    marginBottom: 8,
                    border: '1px solid #313244',
                    borderRadius: 6,
                    overflow: 'hidden',
                    opacity: mem.isActive ? 1 : 0.5,
                  }}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: CATEGORY_COLORS[mem.category] ?? '#666',
                      flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{mem.title}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: CATEGORY_COLORS[mem.category] ?? '#666',
                      color: '#fff',
                    }}>
                      {mem.category}
                    </span>
                    <span style={{ fontSize: 11, color: staleness.color }}>{staleness.label}</span>
                    {!mem.isActive && <span style={{ fontSize: 11, color: '#e74c3c' }}>Retired</span>}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#bac2de' }}>
                      <p><strong>Scope:</strong> {mem.scope}</p>
                      <p><strong>Description:</strong> {mem.description}</p>
                      {mem.freeFormNotes && <p><strong>Notes:</strong> {mem.freeFormNotes}</p>}
                      {mem.tags.length > 0 && <p><strong>Tags:</strong> {mem.tags.join(', ')}</p>}
                      {mem.triggerConditions.length > 0 && <p><strong>Triggers:</strong> {mem.triggerConditions.join(', ')}</p>}
                      {mem.examples.length > 0 && <p><strong>Examples:</strong> {mem.examples.join('; ')}</p>}
                      {mem.revisionHistory.length > 0 && (
                        <div>
                          <strong>Revision History:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {mem.revisionHistory.map(rev => (
                              <li key={rev.revisionNumber}>
                                r{rev.revisionNumber} — {rev.changeSummary} ({rev.changedBy}, {new Date(rev.changedAt).toLocaleDateString()})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {mem.isActive ? (
                          <button onClick={() => handleRetire(mem.id)} style={btnStyle('#e74c3c')}>Retire</button>
                        ) : (
                          <button onClick={() => handleReactivate(mem.id)} style={btnStyle('#2ecc71')}>Reactivate</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Skills Tab ── */}
        {activeTab === 'skills' && (
          <div>
            {skills.length === 0 && <p style={{ color: '#a6adc8' }}>No skills yet.</p>}
            {skills.map(skill => {
              const isExpanded = expandedId === skill.id;
              return (
                <div
                  key={skill.id}
                  style={{
                    marginBottom: 8,
                    border: '1px solid #313244',
                    borderRadius: 6,
                    overflow: 'hidden',
                    opacity: skill.isActive ? 1 : 0.5,
                  }}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{skill.title}</span>
                    <span style={{ fontSize: 11, color: '#a6adc8' }}>v{skill.version}</span>
                    <span style={{ fontSize: 11, color: '#a6adc8' }}>{skill.steps.length} steps</span>
                    {!skill.isActive && <span style={{ fontSize: 11, color: '#e74c3c' }}>Retired</span>}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#bac2de' }}>
                      <p>{skill.description}</p>
                      <strong>Steps:</strong>
                      <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                        {skill.steps.map(step => (
                          <li key={step.order}>
                            {step.instruction}
                            {step.checkCondition && <span style={{ color: '#f39c12' }}> (if: {step.checkCondition})</span>}
                            {step.fallbackAction && <span style={{ color: '#e74c3c' }}> (fallback: {step.fallbackAction})</span>}
                          </li>
                        ))}
                      </ol>
                      {skill.triggerConditions.length > 0 && <p><strong>Triggers:</strong> {skill.triggerConditions.join(', ')}</p>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {skill.isActive && (
                          <button onClick={() => handleSkillRetire(skill.id)} style={btnStyle('#e74c3c')}>Retire</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Decisions Tab ── */}
        {activeTab === 'decisions' && (
          <div>
            {decisions.length === 0 && <p style={{ color: '#a6adc8' }}>No decision records yet.</p>}
            {decisions.map(dec => {
              const isExpanded = expandedId === dec.id;
              return (
                <div
                  key={dec.id}
                  style={{
                    marginBottom: 8,
                    border: '1px solid #313244',
                    borderRadius: 6,
                    overflow: 'hidden',
                    opacity: dec.isActive ? 1 : 0.5,
                  }}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : dec.id)}
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 11, color: '#89b4fa', fontWeight: 600 }}>#{dec.decisionNumber}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{dec.title}</span>
                    <span style={{ fontSize: 11, color: '#a6adc8' }}>{new Date(dec.date).toLocaleDateString()}</span>
                    {!dec.isActive && <span style={{ fontSize: 11, color: '#e74c3c' }}>Superseded</span>}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#bac2de' }}>
                      <p><strong>Decided by:</strong> {dec.decidedBy}</p>
                      <p><strong>Decision:</strong> {dec.decision}</p>
                      <p><strong>Rationale:</strong> {dec.rationale}</p>
                      {dec.alternativesConsidered.length > 0 && (
                        <div>
                          <strong>Alternatives:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {dec.alternativesConsidered.map((alt, i) => (
                              <li key={i}><strong>{alt.option}</strong> — {alt.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {dec.consequences.length > 0 && <p><strong>Consequences:</strong> {dec.consequences.join('; ')}</p>}
                      {dec.relatedFiles.length > 0 && <p><strong>Related files:</strong> {dec.relatedFiles.join(', ')}</p>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {dec.isActive && (
                          <button onClick={() => handleSupersede(dec.id)} style={btnStyle('#e74c3c')}>Supersede</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Lifecycle Tab ── */}
        {activeTab === 'lifecycle' && dashboard && (
          <div>
            <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>Memory Dashboard</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard label="Total Memories" value={dashboard.totalMemories} />
              <StatCard label="Active" value={dashboard.activeMemories} color="#2ecc71" />
              <StatCard label="Retired" value={dashboard.retiredMemories} color="#e74c3c" />
              <StatCard label="Stale" value={dashboard.staleMemories} color="#f39c12" />
              <StatCard label="Skills" value={`${dashboard.activeSkills}/${dashboard.totalSkills}`} />
              <StatCard label="Decisions" value={`${dashboard.activeDecisions}/${dashboard.totalDecisions}`} />
            </div>

            {dashboard.lastWriteAt && (
              <p style={{ fontSize: 12, color: '#a6adc8' }}>Last write: {new Date(dashboard.lastWriteAt).toLocaleString()}</p>
            )}
            {dashboard.lastReviewAt && (
              <p style={{ fontSize: 12, color: '#a6adc8' }}>Last review: {new Date(dashboard.lastReviewAt).toLocaleString()}</p>
            )}

            <h4 style={{ fontSize: 13, margin: '16px 0 8px' }}>Memories by Category</h4>
            {Object.entries(dashboard.memoriesByCategory).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat] ?? '#666' }} />
                <span style={{ fontSize: 12, flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 12, color: '#a6adc8' }}>{count}</span>
                <button onClick={() => handleSummarize(cat as MemoryCategory)} style={{ ...btnStyle('#89b4fa'), padding: '2px 8px', fontSize: 11 }}>
                  Summarize
                </button>
              </div>
            ))}

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button onClick={handleEvictStale} style={btnStyle('#e74c3c')}>Evict Stale (30d+)</button>
              <button onClick={loadData} style={btnStyle('#89b4fa')}>Refresh</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => (
  <div style={{ background: '#313244', borderRadius: 6, padding: 12, textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 600, color: color ?? '#cdd6f4' }}>{value}</div>
    <div style={{ fontSize: 11, color: '#a6adc8', marginTop: 4 }}>{label}</div>
  </div>
);

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
});

export default MemoryPanel;
