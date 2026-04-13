import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../lib/shared-types';
import { C, R } from '../theme';

interface ProjectListScreenProps {
  onSignOut: () => void;
  onOpenModes: () => void;
  onOpenProject: (project: Project) => void;
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const initials = project.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = (project.name.charCodeAt(0) * 37 + project.name.charCodeAt(Math.min(1, project.name.length - 1)) * 13) % 360;
  const color = project.isSelfMaintenance ? C.yellow : `hsl(${hue},60%,65%)`;
  const bg = project.isSelfMaintenance ? C.yellowBg : `hsla(${hue},60%,60%,0.12)`;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '14px 16px',
        backgroundColor: hover ? C.bg3 : C.bg2,
        border: `1px solid ${hover ? C.border2 : C.border}`,
        borderRadius: R.xl, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'background-color 0.15s, border-color 0.15s, transform 0.1s',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: R.lg,
        backgroundColor: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: project.isSelfMaintenance ? 18 : 14, fontWeight: 700, flexShrink: 0,
      }}>
        {project.isSelfMaintenance ? '⚡' : initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text1, fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
          {project.name}
        </div>
        {project.description && (
          <div style={{ color: C.text3, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.description}
          </div>
        )}
      </div>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M6 3l5 5-5 5" stroke={hover ? C.text2 : C.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

export default function ProjectListScreen({ onSignOut, onOpenModes, onOpenProject }: ProjectListScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setProjects((await window.vibeflow.projects.list()) as Project[]); }
    catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await window.vibeflow.projects.create({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(''); setNewDesc(''); setShowNew(false);
      await load();
    } finally { setCreating(false); }
  };

  const handleSignOut = async () => { await window.vibeflow.auth.signOut(); onSignOut(); };

  const openSelfMaintenance = useCallback(async () => {
    try {
      // In packaged builds, check that the repo path has been set
      const repoPath = await window.vibeflow.projects.getVibeFlowRepoPath();
      if (!repoPath) {
        const picked = await window.vibeflow.projects.pickVibeFlowRepoPath();
        if (!picked) return; // user cancelled
      }
      const ex = await window.vibeflow.projects.getSelfMaintenance();
      if (ex) { onOpenProject(ex as Project); return; }
      const created = await window.vibeflow.projects.createSelfMaintenance();
      onOpenProject(created as Project);
    } catch (err) {
      alert(`Could not open VibeFlow project: ${String(err)}`);
    }
  }, [onOpenProject]);

  const iStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    backgroundColor: C.bg3, color: C.text1,
    border: `1px solid ${C.border2}`, borderRadius: R.md,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', backgroundColor: C.bg1, padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text1, letterSpacing: '-0.02em' }}>Projects</h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: C.text3 }}>
            {projects.filter(p => !p.isSelfMaintenance).length} project{projects.filter(p => !p.isSelfMaintenance).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNew(true)} style={{
            padding: '7px 14px', backgroundColor: C.accent, color: '#fff',
            border: 'none', borderRadius: R.lg, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>+</span> New Project
          </button>
          <button onClick={onOpenModes} style={{
            padding: '7px 14px', backgroundColor: C.bg3, color: C.text2,
            border: `1px solid ${C.border2}`, borderRadius: R.lg,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>⚙ Modes</button>
          <button onClick={handleSignOut} style={{
            padding: '7px 14px', backgroundColor: 'transparent', color: C.text3,
            border: `1px solid ${C.border}`, borderRadius: R.lg,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>Sign out</button>
        </div>
      </div>

      {/* New project form */}
      {showNew && (
        <form onSubmit={handleCreate} style={{
          padding: 20, marginBottom: 20,
          backgroundColor: C.bg2, border: `1px solid ${C.border2}`,
          borderRadius: R.xl, animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 14 }}>New project</div>
          <div style={{ marginBottom: 10 }}>
            <input type="text" placeholder="Project name" value={newName}
              onChange={e => setNewName(e.target.value)} required autoFocus style={iStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <input type="text" placeholder="Description (optional)" value={newDesc}
              onChange={e => setNewDesc(e.target.value)} style={iStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={creating} style={{
              padding: '7px 16px', backgroundColor: C.accent, color: '#fff',
              border: 'none', borderRadius: R.md, cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}>{creating ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowNew(false)} style={{
              padding: '7px 16px', backgroundColor: 'transparent', color: C.text2,
              border: `1px solid ${C.border2}`, borderRadius: R.md,
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Project list */}
      {projects.filter(p => !p.isSelfMaintenance).length === 0 && !showNew ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text3, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗂</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 12 }}>Create one to start building with AI</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {projects.filter(p => !p.isSelfMaintenance).map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
          ))}
        </div>
      )}

      {/* Self-maintenance */}
      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <button onClick={openSelfMaintenance} style={{
          width: '100%', padding: '12px 16px',
          backgroundColor: C.yellowBg, border: `1px dashed ${C.yellowBd}`,
          borderRadius: R.xl, cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: C.yellow,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'inherit',
        }}>
          <span>⚡</span> Work on VibeFlow itself
        </button>
      </div>
    </div>
  );
}
