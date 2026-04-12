/** SshScreen — SSH host discovery and connection testing. */

import { useState, useEffect } from 'react';
import type { SshHost, SshConnectionTestResult } from '../../lib/shared-types';

interface SshScreenProps {
  onBack: () => void;
}

interface TestResult {
  hostName: string;
  result: SshConnectionTestResult | null;
  testing: boolean;
}

export default function SshScreen({ onBack }: SshScreenProps) {
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.vibeflow.tooling.ssh.discoverHosts(),
      window.vibeflow.tooling.ssh.discoverKeys(),
    ]).then(([h, k]) => {
      setHosts(h);
      setKeys(k);
      setLoading(false);
    });
  }, []);

  const handleTestConnection = async (host: SshHost) => {
    setTestResults(prev => ({ ...prev, [host.name]: { hostName: host.name, result: null, testing: true } }));
    const result = await window.vibeflow.tooling.ssh.testConnection(host);
    setTestResults(prev => ({ ...prev, [host.name]: { hostName: host.name, result, testing: false } }));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#161b22', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            color: '#8b949e',
            border: '1px solid #30363d',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ← Back
        </button>
        <h3 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>🔑 SSH Connections</h3>
      </div>

      <div style={{ padding: 16 }}>
        {/* Discovered Hosts */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
          Discovered Hosts ({hosts.length})
        </h4>
        {loading ? (
          <div style={{ color: '#484f58', fontSize: 13 }}>Loading...</div>
        ) : hosts.length === 0 ? (
          <div style={{ color: '#484f58', fontSize: 13 }}>
            No SSH hosts found in ~/.ssh/config
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hosts.map(host => {
              const tr = testResults[host.name];
              return (
                <div key={host.name} style={{
                  padding: 12,
                  backgroundColor: '#0d1117',
                  borderRadius: 6,
                  border: '1px solid #30363d',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ color: '#58a6ff', fontWeight: 600, fontSize: 14 }}>{host.name}</span>
                      <span style={{ color: '#8b949e', fontSize: 12, marginLeft: 8 }}>
                        {host.user}@{host.hostname}:{host.port}
                      </span>
                    </div>
                    <button
                      onClick={() => handleTestConnection(host)}
                      disabled={tr?.testing}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: tr?.testing ? '#30363d' : '#238636',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: tr?.testing ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {tr?.testing ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                  {host.identityFile && (
                    <div style={{ color: '#484f58', fontSize: 11, fontFamily: 'monospace' }}>
                      Key: {host.identityFile}
                    </div>
                  )}
                  {tr && !tr.testing && tr.result && (
                    <div style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      backgroundColor: tr.result.success ? '#1a3a2a' : '#3d1f28',
                      color: tr.result.success ? '#3fb950' : '#f85149',
                    }}>
                      {tr.result.success
                        ? `✅ Connected — ${tr.result.latencyMs}ms`
                        : `❌ ${tr.result.error}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Discovered Keys */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>
          SSH Keys ({keys.length})
        </h4>
        {keys.length === 0 ? (
          <div style={{ color: '#484f58', fontSize: 13 }}>No SSH keys found in ~/.ssh</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {keys.map(key => (
              <div key={key} style={{
                padding: '6px 10px',
                backgroundColor: '#0d1117',
                borderRadius: 4,
                border: '1px solid #30363d',
                color: '#c9d1d9',
                fontSize: 12,
                fontFamily: 'monospace',
              }}>
                {key}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
