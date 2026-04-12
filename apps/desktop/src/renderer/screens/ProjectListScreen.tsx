/**
 * Project list screen — shows projects and allows creating new ones.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../lib/shared-types';

interface ProjectListScreenProps {
  onSignOut: () => void;
  onOpenModes: () => void;
  onOpenProject: (project: Project) => void;
}

export default function ProjectListScreen({ onSignOut, onOpenModes, onOpenProject }: ProjectListScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await window.vibeflow.projects.list();
      setProjects(list as Project[]);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading(true);
    try {
      await window.vibeflow.projects.create({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName('');
      setNewDescription('');
      setShowNewProject(false);
      await loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await window.vibeflow.auth.signOut();
    onSignOut();
  };

  const handleOpenSelfMaintenance = useCallback(async () => {
    try {
      // Check if self-maintenance project already exists
      const existing = await window.vibeflow.projects.getSelfMaintenance();
      if (existing) {
        onOpenProject(existing as Project);
        return;
      }

      // Create new self-maintenance project
      const project = await window.vibeflow.projects.createSelfMaintenance();
      onOpenProject(project as Project);
    } catch (err) {
      console.error('Failed to open self-maintenance project:', err);
    }
  }, [onOpenProject]);

  return (
    <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Projects</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowNewProject(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            New Project
          </button>
          <button
            onClick={onOpenModes}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6f42c1',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ⚙️ Modes
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {showNewProject && (
        <form
          onSubmit={handleCreateProject}
          style={{
            padding: 16,
            marginBottom: 16,
            backgroundColor: '#f8f9fa',
            borderRadius: 8,
            border: '1px solid #dee2e6',
          }}
        >
          <h3 style={{ margin: '0 0 12px' }}>New Project</h3>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '6px 16px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewProject(false)}
              style={{
                padding: '6px 16px',
                backgroundColor: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <p style={{ color: '#666' }}>No projects yet. Create one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onOpenProject(project)}
              style={{
                padding: 16,
                backgroundColor: project.isSelfMaintenance ? '#fff8e1' : '#fff',
                border: project.isSelfMaintenance ? '2px solid #ffc107' : '1px solid #dee2e6',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <h3 style={{ margin: '0 0 4px' }}>
                {project.isSelfMaintenance ? '🔧 ' : ''}{project.name}
              </h3>
              {project.description && (
                <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                  {project.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Self-maintenance button */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #dee2e6' }}>
        <button
          onClick={handleOpenSelfMaintenance}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#fff8e1',
            color: '#856404',
            border: '2px dashed #ffc107',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          🔧 Work on VibeFlow itself →
        </button>
      </div>
    </div>
  );
}
