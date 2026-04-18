/**
 * SecretsSyncPanel — UI for encrypted secrets sync and full cloud sync.
 *
 * Track A: set passphrase → upload encrypted keytar secrets → restore on new device.
 * Track B: wired automatically on sign-in via SyncEngine.syncAll().
 */

import { useState, useEffect } from 'react';

export default function SecretsSyncPanel() {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'ok' | 'err' | 'info'>('info');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.vibeflow.secrets.hasPassphrase().then(setHasPassphrase).catch(() => {});
  }, []);

  const flash = (msg: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    setStatusMsg(msg);
    setStatusKind(kind);
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleSetPassphrase = async () => {
    if (!passphrase.trim()) { flash('Enter a passphrase first.', 'err'); return; }
    setBusy(true);
    const r = await window.vibeflow.secrets.setPassphrase(passphrase);
    setBusy(false);
    if (r.success) {
      setHasPassphrase(true);
      setPassphrase('');
      flash('Passphrase set for this session. You can now upload or restore secrets.', 'ok');
    } else {
      flash(r.error ?? 'Failed to set passphrase.', 'err');
    }
  };

  const handleClearPassphrase = async () => {
    await window.vibeflow.secrets.clearPassphrase();
    setHasPassphrase(false);
    flash('Passphrase cleared from memory.', 'info');
  };

  const handleSyncUp = async () => {
    setBusy(true);
    const r = await window.vibeflow.secrets.syncUp();
    setBusy(false);
    if (r.success) {
      flash(`Uploaded ${r.uploaded} secret${r.uploaded !== 1 ? 's' : ''} to cloud (encrypted).`, 'ok');
    } else {
      flash(r.error ?? 'Upload failed.', 'err');
    }
  };

  const handleSyncDown = async () => {
    setBusy(true);
    const r = await window.vibeflow.secrets.syncDown();
    setBusy(false);
    if (r.success) {
      flash(`Restored ${r.restored} secret${r.restored !== 1 ? 's' : ''} to this device.`, 'ok');
    } else {
      flash(r.error ?? 'Restore failed.', 'err');
    }
  };

  const statusColors = { ok: '#4caf50', err: '#f44336', info: '#90caf9' };

  return (
    <div style={{ padding: '16px 20px', maxWidth: 480, fontFamily: 'inherit' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 14, color: '#e0e0e0' }}>Cloud Secrets Sync</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888', lineHeight: '1.5' }}>
        Your API keys and credentials are stored locally on this computer. Use this panel to
        encrypt them with a passphrase and upload to the cloud, so other devices can restore
        them. The passphrase never leaves your device.
      </p>

      {/* Passphrase entry */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>
          {hasPassphrase ? 'Passphrase is set for this session' : 'Set encryption passphrase'}
        </label>
        {!hasPassphrase && (
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSetPassphrase(); }}
                placeholder="Enter a strong passphrase…"
                style={{
                  width: '100%', padding: '6px 32px 6px 8px', background: '#2a2a2a',
                  border: '1px solid #444', borderRadius: 4, color: '#e0e0e0',
                  fontSize: 12, boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowPassphrase(v => !v)}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11 }}
              >
                {showPassphrase ? 'hide' : 'show'}
              </button>
            </div>
            <button
              onClick={handleSetPassphrase}
              disabled={busy}
              style={{ padding: '6px 12px', background: '#1565c0', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: busy ? 'default' : 'pointer' }}
            >
              Set
            </button>
          </div>
        )}
        {hasPassphrase && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#4caf50' }}>✓ Passphrase active</span>
            <button
              onClick={handleClearPassphrase}
              style={{ padding: '2px 8px', background: 'none', border: '1px solid #555', borderRadius: 4, color: '#aaa', fontSize: 11, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Sync buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={handleSyncUp}
          disabled={busy || !hasPassphrase}
          title={!hasPassphrase ? 'Set a passphrase first' : 'Encrypt and upload all project secrets'}
          style={{
            flex: 1, padding: '8px 12px',
            background: hasPassphrase ? '#1b5e20' : '#2a2a2a',
            border: '1px solid ' + (hasPassphrase ? '#2e7d32' : '#444'),
            borderRadius: 4, color: hasPassphrase ? '#e0e0e0' : '#666',
            fontSize: 12, cursor: busy || !hasPassphrase ? 'default' : 'pointer',
          }}
        >
          {busy ? '…' : '↑  Upload secrets to cloud'}
        </button>
        <button
          onClick={handleSyncDown}
          disabled={busy || !hasPassphrase}
          title={!hasPassphrase ? 'Set a passphrase first' : 'Decrypt and restore all secrets to this device'}
          style={{
            flex: 1, padding: '8px 12px',
            background: hasPassphrase ? '#1a237e' : '#2a2a2a',
            border: '1px solid ' + (hasPassphrase ? '#283593' : '#444'),
            borderRadius: 4, color: hasPassphrase ? '#e0e0e0' : '#666',
            fontSize: 12, cursor: busy || !hasPassphrase ? 'default' : 'pointer',
          }}
        >
          {busy ? '…' : '↓  Restore secrets from cloud'}
        </button>
      </div>

      {/* Config + data sync note */}
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#666', lineHeight: '1.5' }}>
        <strong style={{ color: '#888' }}>Everything else</strong> — project settings, MCP servers,
        SSH targets, modes, conversations, missions, memory, skills, and decisions — syncs
        automatically whenever you sign in.
      </p>

      {/* Status message */}
      {statusMsg && (
        <div style={{
          padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: statusKind === 'ok' ? '#1b5e20' : statusKind === 'err' ? '#b71c1c' : '#1a237e',
          color: statusColors[statusKind],
          border: '1px solid ' + statusColors[statusKind] + '44',
        }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}
