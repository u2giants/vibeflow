/** SshScreen — SSH host discovery, connection testing, and saved targets. */

import { useState, useEffect } from 'react';
import type { SshHost, SshConnectionTestResult, SshTarget } from '../../lib/shared-types';
import { C, R } from '../theme';

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
  const [backHov, setBackHov] = useState(false);
  const [addHov, setAddHov] = useState(false);

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

  const labelStyle = {
    fontSize: 11,
    color: C.text3,
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'block' as const,
    marginBottom: 5,
  };

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    backgroundColor: C.bg5,
    color: C.text1,
    border: `1px solid ${C.border2}`,
    borderRadius: R.md,
    outline: 'none',
    fontSize: 13,
    boxSizing: 'border-box' as const,
    marginTop: 2,
  };

  const sectionLabel = {
    fontSize: 11,
    color: C.text3,
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 10,
    marginTop: 24,
    display: 'block' as const,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.bg0, overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.bg1,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHov(true)}
          onMouseLeave={() => setBackHov(false)}
          style={{
            padding: '5px 12px',
            backgroundColor: backHov ? C.bg4 : 'transparent',
            color: C.text2,
            border: `1px solid ${C.border2}`,
            borderRadius: R.md,
            cursor: 'pointer',
            fontSize: 13,
            transition: 'background 0.15s',
          }}
        >
          ← Back
        </button>
        <h3 style={{ margin: 0, color: C.text1, fontSize: 16, fontWeight: 600 }}>SSH Connections</h3>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* Discovered Hosts */}
        <span style={sectionLabel}>Discovered Hosts ({hosts.length})</span>
        {loading ? (
          <div style={{ color: C.text3, fontSize: 13 }}>Scanning...</div>
        ) : hosts.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            backgroundColor: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            color: C.text3,
            fontSize: 13,
          }}>
            No SSH hosts found in ~/.ssh/config
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hosts.map(host => {
              const tr = testResults[host.name];
              return (
                <div key={host.name} style={{
                  padding: '12px 14px',
                  backgroundColor: C.bg2,
                  borderRadius: R.xl,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <span style={{ color: C.blue, fontWeight: 600, fontSize: 14 }}>{host.name}</span>
                      <span style={{ color: C.text3, fontSize: 12, marginLeft: 10 }}>
                        {host.user}@{host.hostname}:{host.port}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleTestConnection(host)}
                        disabled={tr?.testing}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: tr?.testing ? C.bg4 : C.accentBg,
                          color: tr?.testing ? C.text3 : C.accent,
                          border: `1px solid ${tr?.testing ? C.border : C.accent + '55'}`,
                          borderRadius: R.md,
                          cursor: tr?.testing ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {tr?.testing ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleSaveFromDiscovered(host)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: C.greenBg,
                          color: C.green,
                          border: `1px solid ${C.greenBd}`,
                          borderRadius: R.md,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        + Save
                      </button>
                    </div>
                  </div>
                  {host.identityFile && (
                    <div style={{ color: C.text3, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                      {host.identityFile}
                    </div>
                  )}
                  {tr && !tr.testing && tr.result && (
                    <div style={{
                      marginTop: 8,
                      padding: '5px 10px',
                      borderRadius: R.md,
                      fontSize: 12,
                      backgroundColor: tr.result.success ? C.greenBg : C.redBg,
                      color: tr.result.success ? C.green : C.red,
                      border: `1px solid ${tr.result.success ? C.greenBd : C.redBd}`,
                    }}>
                      {tr.result.success
                        ? `Connected — ${tr.result.latencyMs}ms`
                        : tr.result.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Saved Targets */}
        <span style={sectionLabel}>Saved Targets ({savedTargets.length})</span>
        {savedTargets.length === 0 ? (
          <div style={{
            padding: '12px 14px',
            backgroundColor: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            color: C.text3,
            fontSize: 13,
          }}>
            No saved targets yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedTargets.map(t => (
              <div key={t.id} style={{
                padding: '10px 14px',
                backgroundColor: C.bg2,
                borderRadius: R.xl,
                border: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ color: C.text1, fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                  <span style={{ color: C.text3, fontSize: 12, marginLeft: 10 }}>
                    {t.username}@{t.hostname}:{t.port}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteTarget(t.id)}
                  style={{
                    padding: '3px 10px',
                    backgroundColor: 'transparent',
                    color: C.red,
                    border: `1px solid ${C.redBd}`,
                    borderRadius: R.md,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add manually */}
        <span style={sectionLabel}>Add Target Manually</span>
        <div style={{
          padding: 16,
          backgroundColor: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          maxWidth: 520,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Name', field: 'name', placeholder: 'My Server' },
              { label: 'Hostname', field: 'hostname', placeholder: '192.168.1.10' },
              { label: 'Username', field: 'username', placeholder: 'root' },
              { label: 'Identity File (optional)', field: 'identityFile', placeholder: '~/.ssh/id_rsa' },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={(form as Record<string, string | number>)[field] as string}
                  onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Port</label>
              <input
                type="number"
                value={form.port}
                onChange={e => setForm(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                style={{ ...inputStyle, width: 90 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              <button
                onClick={handleSaveManual}
                disabled={formSaving}
                onMouseEnter={() => setAddHov(true)}
                onMouseLeave={() => setAddHov(false)}
                style={{
                  padding: '7px 18px',
                  backgroundColor: formSaving ? C.bg4 : addHov ? '#0ea471' : C.green,
                  color: formSaving ? C.text3 : '#fff',
                  border: 'none',
                  borderRadius: R.md,
                  cursor: formSaving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
              >
                {formSaving ? 'Saving...' : 'Add Target'}
              </button>
              {formMsg && (
                <span style={{ fontSize: 12, color: formMsg.includes('✅') ? C.green : C.red }}>
                  {formMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Discovered Keys */}
        {keys.length > 0 && (
          <>
            <span style={sectionLabel}>SSH Keys ({keys.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {keys.map(key => (
                <div key={key} style={{
                  padding: '6px 12px',
                  backgroundColor: C.bg2,
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  color: C.text2,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}>
                  {key}
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
