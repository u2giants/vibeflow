/**
 * Root React component.
 * Shows SignInScreen if not authenticated, ProjectListScreen if authenticated.
 * Supports navigation to ModesScreen and ProjectScreen.
 * Component 10: Integrated left rail + panel layout for project screens.
 */

import { useState, useEffect } from 'react';
import type { Mode, Project } from '../lib/shared-types';
import SignInScreen from './screens/SignInScreen';
import ProjectListScreen from './screens/ProjectListScreen';
import ProjectScreen from './screens/ProjectScreen';
import ModesScreen from './screens/ModesScreen';
import McpScreen from './screens/McpScreen';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';
import UpdateBanner from './components/UpdateBanner';
import LeftRail, { type LeftRailSection } from './components/LeftRail';
import ProjectHeader from './components/ProjectHeader';
import EvidenceRail from './components/EvidenceRail';
import PanelWorkspace from './components/PanelWorkspace';
import { useUiState } from './hooks/useUiState';

type Screen = 'projects' | 'modes' | 'project' | 'mcp';

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('projects');
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);
  const [openRouterConnected, setOpenRouterConnected] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Component 10: UI state
  const { state: uiState, setLeftRailSection, setLastActiveProject, setLeftRailCollapsed } = useUiState();

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
    setLastActiveProject(project.id);
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

  // Component 10: Project screen with left rail + panel layout
  if (screen === 'project' && activeProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* TopBar stays visible on project screens (guardrail 1) */}
        <TopBar email={email} />
        <UpdateBanner />

        {/* Project header sits below top bar (guardrail 1) */}
        <ProjectHeader
          project={activeProject}
          environment={null}
          activeMission={null}
          pendingApprovalCount={0}
          unhealthyCapabilityCount={0}
          lastDeployStatus="none"
        />

        {/* Main content: left rail + center + evidence rail */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left rail navigation */}
          <LeftRail
            activeSection={uiState.leftRailSection as LeftRailSection}
            onSectionChange={setLeftRailSection}
            collapsed={uiState.leftRailCollapsed}
            onToggleCollapse={() => setLeftRailCollapsed(!uiState.leftRailCollapsed)}
          />

          {/* Center content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {uiState.leftRailSection === 'missions' ? (
              /* Mission workspace with panel layout + conversation reachable */
              <PanelWorkspace
                activeMission={null}
                activeProject={activeProject}
                email={email}
                currentMode={currentMode}
              />
            ) : uiState.leftRailSection === 'capabilities' ? (
              /* Component 14: MCP server management screen */
              <McpScreen />
            ) : (
              /* Legacy project screen for other sections (preserves existing behavior) */
              <ProjectScreen
                project={activeProject}
                email={email}
                currentMode={currentMode}
                onBack={handleBackToProjects}
                onOpenModes={() => setScreen('modes')}
                hideChrome
              />
            )}
          </div>

          {/* Right evidence rail */}
          <EvidenceRail
            evidenceItems={[]}
            toolCallCount={0}
            riskAlertCount={0}
          />
        </div>

        <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
      </div>
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
