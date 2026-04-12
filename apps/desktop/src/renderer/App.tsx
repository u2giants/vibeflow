/**
 * Root React component.
 * Shows SignInScreen if not authenticated, ProjectListScreen if authenticated.
 * Supports navigation to ModesScreen.
 */

import { useState, useEffect } from 'react';
import type { Mode } from '../lib/shared-types';
import SignInScreen from './screens/SignInScreen';
import ProjectListScreen from './screens/ProjectListScreen';
import ModesScreen from './screens/ModesScreen';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';

type Screen = 'projects' | 'modes';

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('projects');
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);
  const [openRouterConnected, setOpenRouterConnected] = useState(false);

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

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!email) {
    return <SignInScreen onSignedIn={handleSignedIn} />;
  }

  if (screen === 'modes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <TopBar email={email} />
        <ModesScreen onBack={() => setScreen('projects')} />
        <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar email={email} />
      <ProjectListScreen
        onSignOut={handleSignedOut}
        onOpenModes={() => setScreen('modes')}
      />
      <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
    </div>
  );
}
