/**
 * PassphraseOnboarding — shown after sign-in if no passphrase is active.
 * Cloud sync of API keys requires a passphrase that is held only in memory.
 * This modal prompts the user to set it (or skip) so they don't miss the feature.
 */

import { useState } from 'react';
import { C, R } from '../theme';

interface PassphraseOnboardingProps {
  onDone: () => void;
}

export default function PassphraseOnboarding({ onDone }: PassphraseOnboardingProps) {
  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSet = async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    const r = await window.vibeflow.secrets.setPassphrase(passphrase);
    setBusy(false);
    if (r.success) {
      setMsg({ text: 'Passphrase set. Your API keys can now sync to the cloud.', ok: true });
      setTimeout(onDone, 1400);
    } else {
      setMsg({ text: r.error ?? 'Failed to set passphrase.', ok: false });
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, backgroundColor: C.bg2,
        border: `1px solid ${C.border2}`, borderRadius: R.xl,
        padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12, textAlign: 'center' }}>🔑</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: C.text1, textAlign: 'center' }}>
          Secure your API keys
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 1.6 }}>
          VibeFlow can encrypt your API keys and sync them to the cloud so any computer
          you sign in to has them ready. Set a passphrase to enable this — it never
          leaves your device.
        </p>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={show ? 'text' : 'password'}
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSet(); }}
            placeholder="Choose a strong passphrase…"
            autoFocus
            style={{
              width: '100%', padding: '9px 36px 9px 12px',
              backgroundColor: C.bg5, color: C.text1,
              border: `1px solid ${C.border2}`, borderRadius: R.md,
              fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => setShow(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 11 }}
          >
            {show ? 'hide' : 'show'}
          </button>
        </div>

        {msg && (
          <div style={{
            padding: '8px 12px', borderRadius: R.md, fontSize: 12, marginBottom: 12,
            backgroundColor: msg.ok ? C.greenBg : C.redBg,
            color: msg.ok ? C.green : C.red,
            border: `1px solid ${msg.ok ? C.greenBd : C.redBd}`,
          }}>
            {msg.text}
          </div>
        )}

        <button
          onClick={handleSet}
          disabled={busy || !passphrase.trim()}
          style={{
            width: '100%', padding: '10px', backgroundColor: C.accent, color: '#fff',
            border: 'none', borderRadius: R.lg, cursor: busy || !passphrase.trim() ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            opacity: !passphrase.trim() ? 0.6 : 1,
            marginBottom: 8,
          }}
        >
          {busy ? 'Setting…' : 'Set passphrase'}
        </button>

        <button
          onClick={onDone}
          style={{
            width: '100%', padding: '8px', backgroundColor: 'transparent', color: C.text3,
            border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}
        >
          Skip for now — I'll set this later in the Sync panel
        </button>
      </div>
    </div>
  );
}
