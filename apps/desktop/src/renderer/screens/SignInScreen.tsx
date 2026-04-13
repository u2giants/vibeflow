import { useState } from 'react';
import { C, R } from '../theme';

interface SignInScreenProps {
  onSignedIn: (email: string) => void;
}

export default function SignInScreen({ onSignedIn }: SignInScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [mode, setMode] = useState<'github' | 'email'>('github');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGitHub = async () => {
    setError(null);
    setNotConfigured(false);
    setLoading(true);
    try {
      const result = await window.vibeflow.auth.signInWithGitHub();
      if (!result.success) {
        if (result.error?.includes('not configured')) setNotConfigured(true);
        setError(result.error ?? 'Sign-in failed');
        return;
      }
      onSignedIn(result.account?.email ?? '');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await window.vibeflow.auth.signInWithEmail(email, password);
      if (!result.success) {
        setError(result.error ?? 'Sign-in failed');
        return;
      }
      onSignedIn(result.account?.email ?? email);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    backgroundColor: C.bg3, color: C.text1,
    border: `1px solid ${C.border2}`, borderRadius: R.md,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', backgroundColor: C.bg0,
      backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,106,247,0.15) 0%, transparent 70%)`,
    }}>
      <div style={{
        backgroundColor: C.bg2, border: `1px solid ${C.border2}`,
        borderRadius: R['2xl'], padding: '40px 36px', width: 380,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'fadeIn 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: R['2xl'],
            backgroundColor: C.accentBg2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, border: `1px solid rgba(124,106,247,0.3)`,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={C.accent} strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text1, letterSpacing: '-0.03em' }}>
            VibeFlow
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.text3 }}>
            AI-powered development, synchronized
          </p>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, backgroundColor: C.bg3, borderRadius: R.md, padding: 3 }}>
          {(['github', 'email'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '6px 0', border: 'none', borderRadius: R.sm,
                backgroundColor: mode === m ? C.bg5 : 'transparent',
                color: mode === m ? C.text1 : C.text3,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.1s',
              }}>
              {m === 'github' ? 'GitHub' : 'Email'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 16,
            backgroundColor: notConfigured ? C.yellowBg : C.redBg,
            border: `1px solid ${notConfigured ? C.yellowBd : C.redBd}`,
            color: notConfigured ? C.yellow : C.red,
            borderRadius: R.lg, fontSize: 12, lineHeight: 1.5,
          }}>{error}</div>
        )}

        {mode === 'github' ? (
          <>
            <button onClick={handleGitHub} disabled={loading} style={{
              width: '100%', padding: '12px 16px',
              backgroundColor: loading ? C.bg4 : '#ededf8',
              color: loading ? C.text3 : '#0d0d18',
              border: 'none', borderRadius: R.lg,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'inherit',
            }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: `2px solid ${C.text3}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Waiting for GitHub…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  Continue with GitHub
                </>
              )}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: C.text3, marginTop: 16, marginBottom: 0 }}>
              Secure OAuth · credentials stay with GitHub
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
              style={inputStyle}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
              style={inputStyle}
            />
            <button onClick={handleEmail} disabled={loading} style={{
              width: '100%', padding: '11px 16px',
              backgroundColor: loading ? C.bg4 : C.accent,
              color: loading ? C.text3 : '#fff',
              border: 'none', borderRadius: R.lg,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', marginTop: 2,
            }}>
              {loading ? (
                <><div style={{ width: 16, height: 16, border: `2px solid ${C.text3}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in…</>
              ) : 'Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
