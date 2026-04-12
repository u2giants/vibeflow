/** Bottom status bar — shows current Mode, model, and connection status. */

import type { Mode } from '../../lib/shared-types';

interface BottomBarProps {
  currentMode: Mode | null;
  openRouterConnected: boolean;
}

export default function BottomBar({ currentMode, openRouterConnected }: BottomBarProps) {
  const modeLabel = currentMode ? `${currentMode.icon} ${currentMode.name}` : 'No Mode selected';
  const modelLabel = currentMode ? currentMode.modelId : '—';
  const connectionLabel = openRouterConnected ? 'OpenRouter ✅' : 'OpenRouter ❌';
  const connectionColor = openRouterConnected ? '#28a745' : '#dc3545';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 16px',
        backgroundColor: '#1a1a2e',
        color: '#ccc',
        fontSize: 12,
        borderTop: '1px solid #333',
      }}
    >
      <div style={{ display: 'flex', gap: 24 }}>
        <span>
          Mode: <strong style={{ color: '#fff' }}>{modeLabel}</strong>
        </span>
        <span>
          Model: <strong style={{ color: '#fff' }}>{modelLabel}</strong>
        </span>
      </div>
      <span style={{ color: connectionColor }}>{connectionLabel}</span>
    </div>
  );
}
