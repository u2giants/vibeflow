/**
 * UpdateBanner — non-intrusive banner shown below the TopBar when an update is available.
 * States:
 * - 'available': "Update available: v{version} — Install now or later"
 * - 'downloading': "Downloading update... {percent}%"
 * - 'ready': "Update ready — Restart to apply"
 * - null: nothing shown
 */

import { useState, useEffect } from 'react';

type UpdateState = 'available' | 'downloading' | 'ready' | null;

export default function UpdateBanner() {
  const [updateState, setUpdateState] = useState<UpdateState>(null);
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadPercent, setDownloadPercent] = useState(0);

  useEffect(() => {
    // Listen for update available
    window.vibeflow.updater.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState('available');
    });

    // Listen for download progress
    window.vibeflow.updater.onDownloadProgress((progress) => {
      setDownloadPercent(progress.percent);
      setUpdateState('downloading');
    });

    // Listen for update downloaded
    window.vibeflow.updater.onUpdateDownloaded(() => {
      setUpdateState('ready');
    });

    return () => {
      window.vibeflow.updater.removeListeners();
    };
  }, []);

  const handleInstallNow = () => {
    window.vibeflow.updater.downloadUpdate();
  };

  const handleLater = () => {
    setUpdateState(null);
  };

  const handleRestart = () => {
    window.vibeflow.updater.installUpdate();
  };

  if (!updateState) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: updateState === 'ready' ? '#2d6a4f' : '#3a0ca3',
        color: '#fff',
        fontSize: 13,
        borderBottom: '1px solid #555',
      }}
    >
      {updateState === 'available' && (
        <>
          <span>Update available: v{updateVersion}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleInstallNow}
              style={{
                padding: '4px 12px',
                backgroundColor: '#4cc9f0',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Install Now
            </button>
            <button
              onClick={handleLater}
              style={{
                padding: '4px 12px',
                backgroundColor: 'transparent',
                color: '#ccc',
                border: '1px solid #666',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </>
      )}

      {updateState === 'downloading' && (
        <>
          <span>Downloading update... {downloadPercent}%</span>
          <div
            style={{
              width: 200,
              height: 6,
              backgroundColor: '#555',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${downloadPercent}%`,
                height: '100%',
                backgroundColor: '#4cc9f0',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </>
      )}

      {updateState === 'ready' && (
        <>
          <span>Update ready — Restart to apply</span>
          <button
            onClick={handleRestart}
            style={{
              padding: '4px 12px',
              backgroundColor: '#4cc9f0',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Restart Now
          </button>
        </>
      )}
    </div>
  );
}
