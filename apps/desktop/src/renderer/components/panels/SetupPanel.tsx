/**
 * SetupPanel — shows integration health for the active project.
 * Reads the project config, maps each enabled integration to its credential
 * type, and lets the user run connection tests inline.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ProjectConfig } from '../../../lib/shared-types';
import { C, R } from '../../theme';

interface IntegrationStatus {
  id: string;
  label: string;
  description: string;
  testable: boolean;
  testKey: 'railway' | 'brevo' | 'clawdtalk' | 'ssh' | null;
  testResult: { success: boolean; message: string } | null;
  testing: boolean;
}

const INTEGRATION_INFO: Record<string, { label: string; description: string; testKey: IntegrationStatus['testKey'] }> = {
  github:       { label: 'GitHub',                  description: 'Source control and CI/CD',               testKey: null },
  coolify:      { label: 'Coolify',                 description: 'Self-hosted deployment',                 testKey: null },
  railway:      { label: 'Railway',                 description: 'Cloud hosting platform',                 testKey: 'railway' },
  supabase:     { label: 'Supabase',                description: 'Database and auth',                      testKey: null },
  ssh:          { label: 'SSH server',              description: 'Direct server access',                   testKey: 'ssh' },
  'custom-mcp': { label: 'Custom MCP servers',      description: 'Extended AI tool access',                testKey: null },
  cloudflare:   { label: 'Cloudflare',              description: 'DNS, CDN, and edge workers',             testKey: null },
  brevo:        { label: 'Brevo (email)',            description: 'Transactional email sending',            testKey: 'brevo' },
  clawdtalk:    { label: 'ClawdTalk',               description: 'In-app chat messaging',                  testKey: 'clawdtalk' },
  google:       { label: 'Google OAuth',            description: 'Sign in with Google',                    testKey: null },
  azure:        { label: 'Microsoft / Azure OAuth', description: 'Sign in with Microsoft',                 testKey: null },
};

interface SetupPanelProps {
  projectId: string;
  onOpenWizard: () => void;
}

export default function SetupPanel({ projectId, onOpenWizard }: SetupPanelProps) {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);

  const load = useCallback(async () => {
    const cfg = await window.vibeflow.projects.getConfig(projectId);
    setConfig(cfg as ProjectConfig | null);
    const enabled = (cfg as ProjectConfig | null)?.enabledIntegrations ?? [];
    setStatuses(enabled.map(id => ({
      id,
      label: INTEGRATION_INFO[id]?.label ?? id,
      description: INTEGRATION_INFO[id]?.description ?? '',
      testable: !!INTEGRATION_INFO[id]?.testKey,
      testKey: INTEGRATION_INFO[id]?.testKey ?? null,
      testResult: null,
      testing: false,
    })));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const runTest = async (idx: number) => {
    const s = statuses[idx];
    if (!s.testKey) return;
    setStatuses(prev => prev.map((x, i) => i === idx ? { ...x, testing: true, testResult: null } : x));

    let result: { success: boolean; message: string };
    try {
      if (s.testKey === 'railway') {
        const key = await window.vibeflow.projects.copyCredential(projectId, 'railway-key');
        if (!key) { result = { success: false, message: 'No API key stored — configure in wizard.' }; }
        else result = await window.vibeflow.connectionTest.railway(key);
      } else if (s.testKey === 'brevo') {
        const key = await window.vibeflow.projects.copyCredential(projectId, 'brevo-key');
        if (!key) { result = { success: false, message: 'No API key stored — configure in wizard.' }; }
        else result = await window.vibeflow.connectionTest.brevo(key);
      } else if (s.testKey === 'clawdtalk') {
        const key = await window.vibeflow.projects.copyCredential(projectId, 'clawdtalk-key');
        if (!key) { result = { success: false, message: 'No API key stored — configure in wizard.' }; }
        else result = await window.vibeflow.connectionTest.clawdtalk(key);
      } else if (s.testKey === 'ssh') {
        const cfg2 = config as ProjectConfig | null;
        if (!cfg2) { result = { success: false, message: 'No project config loaded.' }; }
        else result = await window.vibeflow.connectionTest.ssh({ hostname: '', username: 'root' });
        // Note: full SSH test requires hostname from SshTarget records, not just config
      } else {
        result = { success: false, message: 'Unknown test.' };
      }
    } catch (e) {
      result = { success: false, message: String(e instanceof Error ? e.message : e) };
    }

    setStatuses(prev => prev.map((x, i) => i === idx ? { ...x, testing: false, testResult: result } : x));
  };

  const hasConfig = config && config.enabledIntegrations.length > 0;

  return (
    <div style={{ padding: '24px', overflow: 'auto', flex: 1, backgroundColor: C.bg1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text1 }}>Project Setup</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text3 }}>
            Integrations connected to this project
          </p>
        </div>
        <button
          onClick={onOpenWizard}
          style={{
            padding: '7px 14px', backgroundColor: C.accent, color: '#fff',
            border: 'none', borderRadius: R.lg, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          Configure…
        </button>
      </div>

      {!hasConfig && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          color: C.text3, fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>No integrations configured</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>
            Connect GitHub, Railway, Supabase, and other tools this project uses.
          </div>
          <button
            onClick={onOpenWizard}
            style={{
              padding: '8px 18px', backgroundColor: C.accent, color: '#fff',
              border: 'none', borderRadius: R.lg, cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit',
            }}
          >
            Set up integrations
          </button>
        </div>
      )}

      {hasConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statuses.map((s, idx) => (
            <div
              key={s.id}
              style={{
                padding: '12px 14px',
                backgroundColor: C.bg2,
                border: `1px solid ${C.border}`,
                borderRadius: R.lg,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{s.description}</div>
                {s.testResult && (
                  <div style={{
                    marginTop: 6, fontSize: 11,
                    color: s.testResult.success ? C.green : C.red,
                  }}>
                    {s.testResult.success ? '✓' : '✗'} {s.testResult.message}
                  </div>
                )}
              </div>
              {s.testable && (
                <button
                  onClick={() => runTest(idx)}
                  disabled={s.testing}
                  style={{
                    padding: '4px 10px', background: 'transparent',
                    border: `1px solid ${C.border2}`, borderRadius: R.md,
                    color: C.text3, fontSize: 11,
                    cursor: s.testing ? 'default' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {s.testing ? 'Testing…' : 'Test'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {config && (
        <div style={{ marginTop: 24, padding: '12px 14px', backgroundColor: C.bg2, border: `1px solid ${C.border}`, borderRadius: R.lg }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Project Config
          </div>
          {[
            { label: 'Local folder', value: config.localFolderPath },
            { label: 'Repo URL', value: config.repoUrl },
            { label: 'Supabase URL', value: config.supabaseProjectUrl },
            { label: 'Railway project', value: config.railwayProjectId },
            { label: 'Coolify URL', value: config.coolifyBaseUrl },
            { label: 'Cloudflare account', value: config.cloudflareAccountId },
          ].filter(f => f.value).map(f => (
            <div key={f.label} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.text3, minWidth: 100 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: C.text2, wordBreak: 'break-all' }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
