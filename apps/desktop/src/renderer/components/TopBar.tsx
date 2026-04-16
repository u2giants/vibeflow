import { useState, useEffect } from 'react';
import type { SyncStatus } from '../../lib/shared-types';
import { C, SYNC_DOT } from '../theme';

interface TopBarProps {
  email: string;
}

interface BuildInfo {
  version: string;
  commitSha: string;
  releaseChannel: string;
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  synced:   'Synced',
  syncing:  'Syncing',
  degraded: 'Degraded',
  offline:  'Offline',
};

export default function TopBar({ email }: TopBarProps) {
  const [build, setBuild] = useState<BuildInfo>({ version: '…', commitSha: '', releaseChannel: 'dev' });
  const [sync, setSync] = useState<SyncStatus>('offline');

  useEffect(() => {
    window.vibeflow.buildMetadata.get().then(m =>
      setBuild({ version: m.version, commitSha: m.commitSha.slice(0, 7), releaseChannel: m.releaseChannel })
    );
    const unsub = window.vibeflow.syncStatus.subscribe(setSync);
    return unsub;
  }, []);

  const dot = SYNC_DOT[sync] ?? C.text3;
  const syncing = sync === 'syncing';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 36,
      backgroundColor: C.bg0,
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      {/* Left — logo + version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={C.accent} stroke={C.accent} strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: C.text1, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
            VibeFlow
          </span>
        </div>
        <span style={{
          color: C.text3,
          fontSize: 11,
          padding: '1px 6px',
          backgroundColor: C.bg3,
          borderRadius: 4,
          letterSpacing: '0.02em',
        }}>
          v{build.version}
        </span>
        {build.commitSha && (
          <span style={{ color: C.text3, fontSize: 11, fontFamily: 'monospace' }}>
            {build.commitSha}
          </span>
        )}
      </div>

      {/* Right — sync + email */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dot,
            animation: syncing ? 'pulse 1.4s ease infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: C.text2 }}>{SYNC_LABEL[sync]}</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          backgroundColor: C.bg2,
          borderRadius: 20,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: C.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>
            {email.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: C.text2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </span>
        </div>
      </div>
    </div>
  );
}
