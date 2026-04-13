/** SshScreen — SSH host discovery, connection testing, and saved targets. */

import { useState, useEffect } from 'react';
import type { SshHost, SshConnectionTestResult, SshTarget } from '../../lib/shared-types';

interface SshScreenProps {
  onBack: () => void;
  projectId?: string | null;
}

interface TestResult {
  hostName: string;
  result: SshConnectionTestResult | null;
  testing: boolean;
}

const emptyForm = { name: '', hostname: '', username: 'root', port: 22, identityFile: '' };

export default function SshScreen({ onBack, projectId = null }: SshScreenProps) {
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);
  const [savedTargets, setSavedTargets] = useState<SshTarget[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      window.vibeflow.tooling.ssh.discoverHosts(),
      window.vibeflow.tooling.ssh.discoverKeys(),
      window.vibeflow.sshTargets.list(projectId),
    ]).then(([h, k, targets]) => {
      setHosts(h);
      setKeys(k);
      setSavedTargets(targets);
      setLoading(false);
    });
  }, [projectId]);

  const handleTestConnection = async (host: SshHost) => {
    setTestResults(prev => ({ ...prev, [host.name]: { hostName: host.name, result: null, testing: true } }));
    const result = await window.vibeflow.tooling.ssh.testConnection(host);
    setTestResults(prev => ({ ...prev, [host.name]: { hostName: host.name, result, testing: false } }));
  };

  const handleSaveFromDiscovered = async (host: SshHost) => {
    const target = await window.vibeflow.sshTargets.save({
      projectId,
      name: host.name,
      hostname: host.hostname,
      username: host.user,
      port: host.port,
      identityFile: host.identityFile,
    });
    setSavedTargets(prev => [...prev, target]);
  };

  const handleSaveManual = async () => {
    if (!form.name || !form.hostname || !form.username) {
      setFormMsg('Name, hostname, and username are required.');
      return;
    }
    setFormSaving(true);
    try {
      const target = await window.vibeflow.sshTargets.save({
        projectId,
        name: form.name,
        hostname: form.hostname,
        username: form.username,
        port: form.port,
        identityFile: form.identityFile || null,
      });
      setSavedTargets(prev => [...prev, target]);
      setForm(emptyForm);
      setFormMsg('Target saved ✅');
      setTimeout(() => setFormMsg(null), 3000);
    } catch (err) {
      setFormMsg(`Error: ${String(err)}`);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    await window.vibeflow.sshTargets.delete(id);
    setSavedTargets(prev => prev.filter(t => t.id !== id));
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

        {/* Saved Targets */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>
          Saved Targets ({savedTargets.length})
        </h4>
        {savedTargets.length === 0 ? (
          <div style={{ color: '#484f58', fontSize: 13 }}>No saved targets yet. Save a discovered host or add one manually below.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedTargets.map(t => (
              <div key={t.id} style={{ padding: '8px 12px', backgroundColor: '#0d1117', borderRadius: 6, border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#58a6ff', fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                  <span style={{ color: '#8b949e', fontSize: 12, marginLeft: 8 }}>{t.username}@{t.hostname}:{t.port}</span>
                </div>
                <button
                  onClick={() => handleDeleteTarget(t.id)}
                  style={{ padding: '3px 8px', backgroundColor: 'transparent', color: '#f85149', border: '1px solid #f85149', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save discovered host as target */}
        {hosts.length > 0 && (
          <>
            <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>
              Save Discovered Host
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hosts.map(host => (
                <button
                  key={host.name}
                  onClick={() => handleSaveFromDiscovered(host)}
                  style={{ padding: '4px 10px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                >
                  + Save "{host.name}"
                </button>
              ))}
            </div>
          </>
        )}

        {/* Add manually */}
        <h4 style={{ color: '#8b949e', fontSize: 13, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>
          Add Target Manually
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
          {[
            { label: 'Name', field: 'name', placeholder: 'My Server' },
            { label: 'Hostname', field: 'hostname', placeholder: '192.168.1.10' },
            { label: 'Username', field: 'username', placeholder: 'root' },
            { label: 'Identity File (optional)', field: 'identityFile', placeholder: '~/.ssh/id_rsa' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label style={{ fontSize: 12, color: '#8b949e' }}>{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={(form as Record<string, string | number>)[field] as string}
                onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                style={{ width: '100%', marginTop: 2, padding: '5px 8px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, color: '#8b949e' }}>Port</label>
            <input
              type="number"
              value={form.port}
              onChange={e => setForm(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
              style={{ width: 80, marginTop: 2, marginLeft: 0, padding: '5px 8px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#c9d1d9', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSaveManual}
              disabled={formSaving}
              style={{ padding: '6px 14px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
            >
              {formSaving ? 'Saving...' : 'Add Target'}
            </button>
            {formMsg && <span style={{ fontSize: 12, color: formMsg.includes('✅') ? '#3fb950' : '#f85149' }}>{formMsg}</span>}
          </div>
        </div>

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
