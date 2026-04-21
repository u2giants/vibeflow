import { useState, useEffect } from 'react';
import { C } from '../theme';

type UpdateState = 'available' | 'downloading' | 'ready' | null;

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>(null);
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    window.vibeflow.updater.onUpdateAvailable(info => { setVersion(info.version); setState('available'); });
    window.vibeflow.updater.onDownloadProgress(p => { setPercent(p.percent); setState('downloading'); });
    window.vibeflow.updater.onUpdateDownloaded(() => setState('ready'));
    return () => { window.vibeflow.updater.removeListeners(); };
  }, []);

  if (!state) return null;

  const isReady = state === 'ready';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      backgroundColor: isReady ? C.greenBg : C.accentBg,
      borderBottom: `1px solid ${isReady ? C.greenBd : C.border}`,
      fontSize: 12,
      color: isReady ? C.green : C.text1,
      flexShrink: 0,
    }}>
      {state === 'available' && (
        <>
          <span>Update available: <strong>v{version}</strong></span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => window.vibeflow.updater.downloadUpdate()} style={{
              padding: '3px 10px', backgroundColor: C.accent, color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>Install</button>
            <button
              onClick={() => window.vibeflow.updater.openReleasePage()}
              style={{
                padding: '3px 10px', backgroundColor: 'transparent', color: C.text2,
                border: `1px solid ${C.border2}`, borderRadius: 4, cursor: 'pointer', fontSize: 11,
              }}
              title="Open GitHub Releases in browser"
            >Download manually</button>
            <button onClick={() => setState(null)} style={{
              padding: '3px 10px', backgroundColor: 'transparent', color: C.text2,
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            }}>Later</button>
          </div>
        </>
      )}
      {state === 'downloading' && (
        <>
          <span>Downloading update… {Math.round(percent)}%</span>
          <div style={{ width: 160, height: 4, backgroundColor: C.bg4, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${percent}%`, height: '100%', backgroundColor: C.accent, transition: 'width 0.3s' }} />
          </div>
        </>
      )}
      {state === 'ready' && (
        <>
          <span>Update ready to install</span>
          <button onClick={() => window.vibeflow.updater.installUpdate()} style={{
            padding: '3px 10px', backgroundColor: C.green, color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>Restart Now</button>
        </>
      )}
    </div>
  );
}
