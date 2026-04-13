/**
 * Root React component.
 * Shows SignInScreen if not authenticated, ProjectListScreen if authenticated.
 * Supports navigation to ModesScreen and ProjectScreen.
 */

import { useState, useEffect } from 'react';
import type { Mode, Project } from '../lib/shared-types';
import SignInScreen from './screens/SignInScreen';
import ProjectListScreen from './screens/ProjectListScreen';
import ProjectScreen from './screens/ProjectScreen';
import ModesScreen from './screens/ModesScreen';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';
import UpdateBanner from './components/UpdateBanner';

type Screen = 'projects' | 'modes' | 'project';

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('projects');
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);
  const [openRouterConnected, setOpenRouterConnected] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    window.vibeflow.auth
      .getSession()
      .then((session) => {
        setEmail(session.email);
      })
      .catch(() => {
        setEmail(null);
      })
      .finally(() => {
        setLoading(false);
      });

    // Load current mode (first mode) and OpenRouter status
    window.vibeflow.modes.list().then((modes) => {
      if (modes.length > 0) setCurrentMode(modes[0]);
    });
    window.vibeflow.openrouter.getApiKey().then((r) => setOpenRouterConnected(r.hasKey));
  }, []);

  const handleSignedIn = (userEmail: string) => {
    setEmail(userEmail);
  };

  const handleSignedOut = () => {
    setEmail(null);
  };

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setScreen('project');
  };

  const handleBackToProjects = () => {
    setActiveProject(null);
    setScreen('projects');
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!email) {
    return <SignInScreen onSignedIn={handleSignedIn} />;
  }

  if (screen === 'project' && activeProject) {
    return (
      <ProjectScreen
        project={activeProject}
        email={email}
        currentMode={currentMode}
        onBack={handleBackToProjects}
        onOpenModes={() => setScreen('modes')}
      />
    );
  }

  if (screen === 'modes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <TopBar email={email} />
        <UpdateBanner />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ModesScreen onBack={() => activeProject ? setScreen('project') : setScreen('projects')} />
        </div>
        <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar email={email} />
      <UpdateBanner />
      <ProjectListScreen
        onSignOut={handleSignedOut}
        onOpenModes={() => setScreen('modes')}
        onOpenProject={handleOpenProject}
      />
      <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
    </div>
  );
}
