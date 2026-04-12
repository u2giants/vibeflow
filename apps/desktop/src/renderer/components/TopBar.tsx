/**
 * Top bar — shows version, commit SHA, sync status, and account email.
 * Reads build metadata from the main process via IPC.
 */

import { useState, useEffect } from 'react';
import { SyncStatus } from '../../lib/shared-types';

interface TopBarProps {
  email: string;
}

interface BuildInfo {
  version: string;
  commitSha: string;
}

export default function TopBar({ email }: TopBarProps) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({
    version: 'dev',
    commitSha: 'dev',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.Connecting);

  useEffect(() => {
    window.vibeflow.buildMetadata.get().then((meta) => {
      setBuildInfo({ version: meta.version, commitSha: meta.commitSha });
    });

    // TODO: Replace with real sync status subscription
    const timer = setTimeout(() => {
      setSyncStatus(SyncStatus.Offline);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const syncLabel: Record<SyncStatus, string> = {
    [SyncStatus.Offline]: 'Offline',
    [SyncStatus.Connecting]: 'Connecting...',
    [SyncStatus.Connected]: 'Connected',
    [SyncStatus.Syncing]: 'Syncing...',
    [SyncStatus.Error]: 'Sync Error',
  };

  const syncColor: Record<SyncStatus, string> = {
    [SyncStatus.Offline]: '#999',
    [SyncStatus.Connecting]: '#ffc107',
    [SyncStatus.Connected]: '#28a745',
    [SyncStatus.Syncing]: '#007bff',
    [SyncStatus.Error]: '#dc3545',
  };

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
        <span>VibeFlow {buildInfo.version}</span>
        <span style={{ color: '#888' }}>commit: {buildInfo.commitSha}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ color: syncColor[syncStatus] }}>
          ● {syncLabel[syncStatus]}
        </span>
        <span>{email}</span>
      </div>
    </div>
  );
}
