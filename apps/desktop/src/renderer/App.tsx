/**
 * Root React component.
 * Shows SignInScreen if not authenticated, ProjectListScreen if authenticated.
 */

import { useState, useEffect } from 'react';
import SignInScreen from './screens/SignInScreen';
import ProjectListScreen from './screens/ProjectListScreen';
import TopBar from './components/TopBar';

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar email={email} />
      <ProjectListScreen onSignOut={handleSignedOut} />
    </div>
  );
}
