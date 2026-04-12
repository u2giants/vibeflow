/**
 * Top bar — shows version, commit SHA, sync status, and account email.
 * Reads build metadata from the main process via IPC.
 */

import { useState, useEffect } from 'react';
import type { SyncStatus } from '../../lib/shared-types';

interface TopBarProps {
  email: string;
}

interface BuildInfo {
  version: string;
  commitSha: string;
  commitDate: string;
  releaseChannel: string;
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing...',
  degraded: 'Degraded',
  offline: 'Offline',
};

const SYNC_ICONS: Record<SyncStatus, string> = {
  synced: '🟢',
  syncing: '🟡',
  degraded: '🟡',
  offline: '🔴',
};

export default function TopBar({ email }: TopBarProps) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({
    version: 'dev',
    commitSha: 'dev',
    commitDate: '',
    releaseChannel: 'dev',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');

  useEffect(() => {
    window.vibeflow.buildMetadata.get().then((meta) => {
      setBuildInfo({
        version: meta.version,
        commitSha: meta.commitSha,
        commitDate: meta.commitDate,
        releaseChannel: meta.releaseChannel,
      });
    });

    // Subscribe to real sync status events
    const unsubscribe = window.vibeflow.syncStatus.subscribe((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        backgroundColor: '#1a1a2e',
        color: '#fff',
        fontSize: 12,
        borderBottom: '1px solid #333',
      }}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <span>VibeFlow v{buildInfo.version}</span>
        <span style={{ color: '#888' }}>{buildInfo.commitSha}</span>
        <span style={{ color: '#888' }}>{buildInfo.releaseChannel}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span title={SYNC_LABELS[syncStatus]}>
          {SYNC_ICONS[syncStatus]} {SYNC_LABELS[syncStatus]}
        </span>
        <span>{email}</span>
      </div>
    </div>
  );
}
