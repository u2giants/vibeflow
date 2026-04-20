/**
 * NewProjectWizard — full-screen modal overlay wizard for creating a new project.
 * All styles are inline — no CSS files, no CSS modules.
 */

import { useState, useEffect } from 'react';
import type { Project, ProjectConfig, WizardSecret } from '../../lib/shared-types';
import { C, R } from '../theme';

// ── Local types ──────────────────────────────────────────────────────────────

interface McpServerDraft {
  name: string;
  description: string;
  command: string;
  args: string[];
  transport: 'stdio' | 'sse' | 'http';
  env: Record<string, string>;
}

interface NewProjectWizardProps {
  onCreated: (project: Project) => void;
  onCancel: () => void;
  existingProjects: Project[];
  /** When provided, wizard runs in edit mode — updates this project instead of creating a new one */
  editProject?: Project;
}

// ── Integration metadata ─────────────────────────────────────────────────────

interface IntegrationMeta {
  label: string;
  description: string;
  /** Credential types that must be non-empty for setup to be considered complete */
  requiredSecrets: string[];
}

const INTEGRATION_META: Record<string, IntegrationMeta> = {
  github:       { label: 'GitHub',                   description: 'Source control — read/write your code repository and run workflows', requiredSecrets: ['github-pat'] },
  coolify:      { label: 'Coolify',                  description: 'Self-hosted deployment — ship your app to your own server or VPS', requiredSecrets: ['coolify-token'] },
  railway:      { label: 'Railway',                  description: 'Cloud hosting — deploy backends and databases without DevOps setup', requiredSecrets: ['railway-key'] },
  supabase:     { label: 'Supabase',                 description: "Your project's database and auth — Postgres + Auth + Storage", requiredSecrets: ['supabase-service-role'] },
  ssh:          { label: 'SSH server',               description: 'Direct server access — run commands and manage files on a remote machine', requiredSecrets: [] },
  'custom-mcp': { label: 'Custom MCP server',        description: 'Extra AI tools — connect any MCP-compatible tool server to extend AI capabilities', requiredSecrets: [] },
  cloudflare:   { label: 'Cloudflare',               description: 'DNS, CDN, and edge workers — manage domains and global delivery', requiredSecrets: ['cloudflare-token'] },
  brevo:        { label: 'Brevo (email)',             description: 'Transactional email — send password resets, notifications, and newsletters', requiredSecrets: ['brevo-key'] },
  clawdtalk:    { label: 'ClawdTalk',                description: 'In-app chat messaging — real-time chat for your application users', requiredSecrets: ['clawdtalk-key'] },
  google:       { label: 'Google OAuth',             description: 'Sign in with Google — let users authenticate using their Google account', requiredSecrets: ['google-oauth-secret'] },
  azure:        { label: 'Microsoft / Azure OAuth',  description: 'Sign in with Microsoft — enterprise SSO and personal Microsoft account login', requiredSecrets: ['azure-oauth-secret'] },
};

const ALL_INTEGRATIONS = Object.keys(INTEGRATION_META);
const INTEGRATION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(INTEGRATION_META).map(([k, v]) => [k, v.label])
);

// ── Shared style helpers ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: C.text3,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 5,
};

const helpStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.text3,
  marginTop: 4,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: C.bg5,
  color: C.text1,
  border: `1px solid ${C.border2}`,
  borderRadius: R.md,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: 16,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: C.text1,
  marginBottom: 4,
  marginTop: 0,
};

const sectionSubheading: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  marginBottom: 20,
  marginTop: 0,
  lineHeight: 1.5,
};

const infoBoxStyle: React.CSSProperties = {
  padding: '10px 14px',
  backgroundColor: C.accentBg,
  border: `1px solid ${C.border2}`,
  borderRadius: R.md,
  fontSize: 12,
  color: C.text2,
  lineHeight: 1.6,
  marginTop: 4,
  marginBottom: 16,
};

const btnBase: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: R.md,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const primaryBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: C.accent,
  color: '#fff',
};

const ghostBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: 'transparent',
  color: C.text2,
  border: `1px solid ${C.border2}`,
};

const dangerBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: 'transparent',
  color: C.red,
  border: `1px solid ${C.redBd}`,
  fontSize: 12,
  padding: '4px 10px',
};

const subtleBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: C.bg4,
  color: C.text2,
  border: `1px solid ${C.border2}`,
  fontSize: 12,
  padding: '5px 12px',
};

// ── Masked input component (inline) ─────────────────────────────────────────

function MaskedInput({
  id,
  value,
  onChange,
  showSecrets,
  setShowSecrets,
  placeholder,
  style,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  showSecrets: Record<string, boolean>;
  setShowSecrets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={showSecrets[id] ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 60, ...(style ?? {}) }}
      />
      <button
        type="button"
        onClick={() => setShowSecrets(s => ({ ...s, [id]: !s[id] }))}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: C.text3,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
          padding: '2px 4px',
        }}
      >
        {showSecrets[id] ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldWrapStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
      {help && <div style={helpStyle}>{help}</div>}
    </div>
  );
}

// ── Copy-from-project row ────────────────────────────────────────────────────

function CopyFromProject({
  existingProjects,
  copySource,
  setCopySource,
  copying,
  onCopy,
}: {
  existingProjects: Project[];
  copySource: string;
  setCopySource: (v: string) => void;
  copying: boolean;
  onCopy: () => void;
}) {
  if (existingProjects.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      marginBottom: 16,
      padding: '8px 10px',
      backgroundColor: C.bg4,
      borderRadius: R.md,
      border: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 11, color: C.text3, flexShrink: 0 }}>Copy from:</span>
      <select
        value={copySource}
        onChange={e => setCopySource(e.target.value)}
        style={{
          flex: 1,
          padding: '4px 8px',
          backgroundColor: C.bg5,
          color: C.text2,
          border: `1px solid ${C.border2}`,
          borderRadius: R.sm,
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      >
        <option value="">— select project —</option>
        {existingProjects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!copySource || copying}
        onClick={onCopy}
        style={{
          ...subtleBtn,
          opacity: (!copySource || copying) ? 0.5 : 1,
          cursor: (!copySource || copying) ? 'not-allowed' : 'pointer',
        }}
      >
        {copying ? 'Copying…' : 'Copy'}
      </button>
    </div>
  );
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function WizardProgress({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  const stepLabels: Record<string, string> = {
    basics: 'Basics',
    checklist: 'Tools',
    summary: 'Review',
    ...INTEGRATION_LABELS,
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      marginBottom: 28,
      overflowX: 'auto',
      paddingBottom: 2,
    }}>
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isDone = idx < currentStep;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            {idx > 0 && (
              <div style={{
                width: 20,
                height: 1,
                backgroundColor: isDone ? C.accent : C.border2,
                flexShrink: 0,
              }} />
            )}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: isActive ? C.accent : isDone ? C.accentBg2 : C.bg4,
                color: isActive ? '#fff' : isDone ? C.accent : C.text3,
                border: `1.5px solid ${isActive ? C.accent : isDone ? C.accent : C.border2}`,
                transition: 'background 0.2s, color 0.2s',
              }}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: 9,
                color: isActive ? C.text1 : C.text3,
                fontWeight: isActive ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                maxWidth: 48,
                textAlign: 'center',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {(stepLabels[step] ?? step).slice(0, 8)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewProjectWizard({
  onCreated,
  onCancel,
  existingProjects,
  editProject,
}: NewProjectWizardProps) {
  const isEditing = !!editProject;
  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<string[]>(['basics', 'checklist', 'summary']);

  // Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  // Checklist
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);

  // GitHub
  const [githubPat, setGithubPat] = useState('');

  // Coolify
  const [coolifyBaseUrl, setCoolifyBaseUrl] = useState('');
  const [coolifyApiToken, setCoolifyApiToken] = useState('');
  const [coolifyAppId, setCoolifyAppId] = useState('');

  // Railway
  const [railwayApiKey, setRailwayApiKey] = useState('');
  const [railwayProjectId, setRailwayProjectId] = useState('');
  const [railwayServiceId, setRailwayServiceId] = useState('');

  // Supabase
  const [supabaseProjectUrl, setSupabaseProjectUrl] = useState('');
  const [supabaseProjectRef, setSupabaseProjectRef] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState('');

  // SSH
  const [sshHostname, setSshHostname] = useState('');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshIdentityFilePath, setSshIdentityFilePath] = useState('');
  const [sshTestResult, setSshTestResult] = useState<string | null>(null);
  const [sshTesting, setSshTesting] = useState(false);

  // Cloudflare
  const [cloudflareAccountId, setCloudflareAccountId] = useState('');
  const [cloudflareApiToken, setCloudflareApiToken] = useState('');
  const [cloudflareZoneId, setCloudflareZoneId] = useState('');

  // Railway connection test
  const [railwayTesting, setRailwayTesting] = useState(false);
  const [railwayTestResult, setRailwayTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Brevo
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoTesting, setBrevoTesting] = useState(false);
  const [brevoTestResult, setBrevoTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ClawdTalk
  const [clawdtalkApiKey, setClawdtalkApiKey] = useState('');
  const [clawdtalkTesting, setClawdtalkTesting] = useState(false);
  const [clawdtalkTestResult, setClawdtalkTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Google OAuth
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleServiceAccountJson, setGoogleServiceAccountJson] = useState('');

  // Azure OAuth
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  // Azure Service Principal (for auto-create)
  const [azureSpClientId, setAzureSpClientId] = useState('');
  const [azureSpClientSecret, setAzureSpClientSecret] = useState('');
  const [azureSpTenantId, setAzureSpTenantId] = useState('');
  const [azureAutoCreating, setAzureAutoCreating] = useState(false);
  const [azureAutoMsg, setAzureAutoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Custom MCP servers
  const [mcpServers, setMcpServers] = useState<McpServerDraft[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [mcpFormMode, setMcpFormMode] = useState<'fields' | 'json'>('fields');
  const [mcpDraftName, setMcpDraftName] = useState('');
  const [mcpDraftDescription, setMcpDraftDescription] = useState('');
  const [mcpDraftCommand, setMcpDraftCommand] = useState('');
  const [mcpDraftArgs, setMcpDraftArgs] = useState('');
  const [mcpDraftTransport, setMcpDraftTransport] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [mcpDraftEnv, setMcpDraftEnv] = useState('');
  const [mcpDraftJson, setMcpDraftJson] = useState('');
  const [mcpDraftJsonError, setMcpDraftJsonError] = useState<string | null>(null);

  // Show/hide toggles
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Copy from project
  const [copySource, setCopySource] = useState('');
  const [copying, setCopying] = useState(false);

  // Submission
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Pre-populate from existing project config (edit mode) ─────────────────

  useEffect(() => {
    if (!editProject) return;
    setName(editProject.name);
    setDescription(editProject.description ?? '');
    window.vibeflow.projects.getConfig(editProject.id).then((cfg: ProjectConfig | null) => {
      if (!cfg) return;
      setLocalFolderPath(cfg.localFolderPath ?? '');
      setRepoUrl(cfg.repoUrl ?? '');
      setCoolifyBaseUrl(cfg.coolifyBaseUrl ?? '');
      setCoolifyAppId(cfg.coolifyAppId ?? '');
      setRailwayProjectId(cfg.railwayProjectId ?? '');
      setRailwayServiceId(cfg.railwayServiceId ?? '');
      setSupabaseProjectUrl(cfg.supabaseProjectUrl ?? '');
      setSupabaseProjectRef(cfg.supabaseProjectRef ?? '');
      setSupabaseAnonKey(cfg.supabaseAnonKey ?? '');
      setCloudflareAccountId(cfg.cloudflareAccountId ?? '');
      setCloudflareZoneId(cfg.cloudflareZoneId ?? '');
      setGoogleClientId(cfg.googleOAuthClientId ?? '');
      setAzureClientId(cfg.azureOAuthClientId ?? '');
      setAzureTenantId(cfg.azureOAuthTenantId ?? '');
      if (cfg.enabledIntegrations?.length) {
        setSelectedIntegrations(cfg.enabledIntegrations);
        const newSteps = ['basics', 'checklist', ...cfg.enabledIntegrations, 'summary'];
        setSteps(newSteps);
      }
    }).catch(() => {});
    // Secrets are write-only (never sent to renderer); leave blank — empty = "no change" on save
  }, [editProject]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const toggleIntegration = (id: string) => {
    setSelectedIntegrations(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const buildSteps = (integrations: string[]) => {
    return ['basics', 'checklist', ...integrations, 'summary'];
  };

  const goNext = () => {
    const stepId = steps[currentStep];
    if (stepId === 'checklist') {
      const newSteps = buildSteps(selectedIntegrations);
      setSteps(newSteps);
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const goBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleCopyFromProject = async (credentialTypes: Record<string, (v: string) => void>) => {
    if (!copySource) return;
    setCopying(true);
    try {
      for (const [credentialType, setter] of Object.entries(credentialTypes)) {
        const value = await window.vibeflow.projects.copyCredential(copySource, credentialType);
        if (value) setter(value);
      }
    } catch {
      // non-fatal
    } finally {
      setCopying(false);
    }
  };

  const handleSshTest = async () => {
    if (!sshHostname) return;
    setSshTesting(true);
    setSshTestResult(null);
    try {
      const result = await window.vibeflow.connectionTest.ssh({
        hostname: sshHostname,
        username: sshUsername || 'root',
        port: parseInt(sshPort) || 22,
        identityFile: sshIdentityFilePath || undefined,
      });
      setSshTestResult(result.message);
    } catch (e: unknown) {
      setSshTestResult(`Connection test failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSshTesting(false);
    }
  };

  const addMcpServer = () => {
    if (mcpFormMode === 'json') {
      try {
        const parsed = JSON.parse(mcpDraftJson);
        const draft: McpServerDraft = {
          name: parsed.name ?? 'Custom Server',
          description: parsed.description ?? '',
          command: parsed.command ?? '',
          args: Array.isArray(parsed.args) ? parsed.args : [],
          transport: parsed.transport ?? 'stdio',
          env: typeof parsed.env === 'object' && parsed.env !== null ? parsed.env : {},
        };
        setMcpServers(prev => [...prev, draft]);
        resetMcpForm();
      } catch {
        setMcpDraftJsonError('Invalid JSON — please check the format.');
      }
      return;
    }
    if (!mcpDraftName || !mcpDraftCommand) return;
    const envObj: Record<string, string> = {};
    mcpDraftEnv.split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        envObj[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
    });
    setMcpServers(prev => [...prev, {
      name: mcpDraftName,
      description: mcpDraftDescription,
      command: mcpDraftCommand,
      args: mcpDraftArgs.split(' ').filter(Boolean),
      transport: mcpDraftTransport,
      env: envObj,
    }]);
    resetMcpForm();
  };

  const resetMcpForm = () => {
    setShowMcpForm(false);
    setMcpFormMode('fields');
    setMcpDraftName('');
    setMcpDraftDescription('');
    setMcpDraftCommand('');
    setMcpDraftArgs('');
    setMcpDraftTransport('stdio');
    setMcpDraftEnv('');
    setMcpDraftJson('');
    setMcpDraftJsonError(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    // Warn for integrations that were checked but have no credentials entered
    const secretValuesByType: Record<string, string> = {
      'github-pat': githubPat,
      'coolify-token': coolifyApiToken,
      'railway-key': railwayApiKey,
      'supabase-service-role': supabaseServiceRoleKey,
      'cloudflare-token': cloudflareApiToken,
      'brevo-key': brevoApiKey,
      'clawdtalk-key': clawdtalkApiKey,
      'google-oauth-secret': googleClientSecret,
      'azure-oauth-secret': azureClientSecret,
    };
    const emptyIntegrations = selectedIntegrations.filter(id => {
      const required = INTEGRATION_META[id]?.requiredSecrets ?? [];
      return required.length > 0 && required.every(s => !secretValuesByType[s]?.trim());
    });
    if (emptyIntegrations.length > 0) {
      const names = emptyIntegrations.map(id => INTEGRATION_META[id].label).join(', ');
      const confirmed = window.confirm(
        `You selected ${names} but didn't enter credentials for ${emptyIntegrations.length === 1 ? 'it' : 'them'}.\n\nCreate the project anyway? You can add credentials later.`
      );
      if (!confirmed) return;
    }

    setCreating(true);
    setError(null);
    try {
      const secrets: WizardSecret[] = [];
      if (githubPat) secrets.push({ credentialType: 'github-pat', value: githubPat });
      if (coolifyApiToken) secrets.push({ credentialType: 'coolify-token', value: coolifyApiToken });
      if (railwayApiKey) secrets.push({ credentialType: 'railway-key', value: railwayApiKey });
      if (supabaseServiceRoleKey) secrets.push({ credentialType: 'supabase-service-role', value: supabaseServiceRoleKey });
      if (cloudflareApiToken) secrets.push({ credentialType: 'cloudflare-token', value: cloudflareApiToken });
      if (brevoApiKey) secrets.push({ credentialType: 'brevo-key', value: brevoApiKey });
      if (clawdtalkApiKey) secrets.push({ credentialType: 'clawdtalk-key', value: clawdtalkApiKey });
      if (googleClientSecret) secrets.push({ credentialType: 'google-oauth-secret', value: googleClientSecret });
      if (googleServiceAccountJson.trim()) secrets.push({ credentialType: 'google-service-account-json', value: googleServiceAccountJson.trim() });
      if (azureClientSecret) secrets.push({ credentialType: 'azure-oauth-secret', value: azureClientSecret });

      const wizardArgs = {
        name: name.trim(),
        description: description.trim() || undefined,
        wizardPayload: {
          name: name.trim(),
          description: description.trim() || undefined,
          config: {
            repoUrl: repoUrl || null,
            localFolderPath: localFolderPath || null,
            coolifyBaseUrl: coolifyBaseUrl || null,
            coolifyAppId: coolifyAppId || null,
            supabaseProjectUrl: supabaseProjectUrl || null,
            supabaseProjectRef: supabaseProjectRef || null,
            supabaseAnonKey: supabaseAnonKey || null,
            railwayProjectId: railwayProjectId || null,
            railwayServiceId: railwayServiceId || null,
            cloudflareAccountId: cloudflareAccountId || null,
            cloudflareZoneId: cloudflareZoneId || null,
            googleOAuthClientId: googleClientId || null,
            azureOAuthClientId: azureClientId || null,
            azureOAuthTenantId: azureTenantId || null,
            enabledIntegrations: selectedIntegrations,
          },
          secrets,
          sshTarget: selectedIntegrations.includes('ssh') && sshHostname ? {
            name: sshHostname,
            hostname: sshHostname,
            user: sshUsername,
            port: parseInt(sshPort) || 22,
            identityFile: sshIdentityFilePath || null,
          } : undefined,
          mcpServers: mcpServers.length > 0 ? mcpServers : undefined,
        },
      };

      if (isEditing && editProject) {
        await window.vibeflow.projects.updateWizard(editProject.id, wizardArgs);
        onCreated({ ...editProject, name: name.trim(), description: description.trim() || null });
      } else {
        const project = await window.vibeflow.projects.create(wizardArgs);
        onCreated(project as Project);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEditing ? 'Failed to save changes' : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderBasics = () => (
    <div>
      <h2 style={sectionHeading}>Let's set up your project</h2>
      <p style={sectionSubheading}>You can always add credentials later from the project settings.</p>

      <Field label="Project name *">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Awesome Project"
          autoFocus
          required
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional — describe what this project does"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Local folder"
        help="The folder on this machine where your project code lives. The AI will read and write files here."
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={localFolderPath}
            onChange={e => setLocalFolderPath(e.target.value)}
            placeholder="Click Browse or type a path"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={async () => {
              const picked = await window.vibeflow.projects.pickFolder();
              if (picked) setLocalFolderPath(picked);
            }}
            style={{
              padding: '8px 12px', background: C.bg4,
              border: `1px solid ${C.border2}`, borderRadius: R.md,
              color: C.text2, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Browse…
          </button>
        </div>
      </Field>

      <Field
        label="GitHub repo URL"
        help="Optional — needed for git operations and GitHub integration."
      >
        <input
          type="text"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="https://github.com/yourname/yourrepo"
          style={inputStyle}
        />
      </Field>
    </div>
  );

  const renderChecklist = () => (
    <div>
      <h2 style={sectionHeading}>Which tools does this project use?</h2>
      <p style={sectionSubheading}>We'll ask for the credentials you need. You can skip any of these.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        {ALL_INTEGRATIONS.map(id => {
          const checked = selectedIntegrations.includes(id);
          const meta = INTEGRATION_META[id];
          return (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 14px',
                backgroundColor: checked ? C.accentBg : C.bg4,
                border: `1px solid ${checked ? C.accent + '55' : C.border2}`,
                borderRadius: R.md,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleIntegration(id)}
                style={{ accentColor: C.accent, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: checked ? C.text1 : C.text2 }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2, lineHeight: 1.5 }}>
                  {meta.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>

    </div>
  );

  const renderGithub = () => (
    <div>
      <h2 style={sectionHeading}>GitHub</h2>
      <p style={sectionSubheading}>A Personal Access Token lets the AI read and write code in your repo.</p>

      <Field
        label="Personal Access Token"
        help="Create one at github.com/settings/tokens. Need scopes: repo, workflow, read:org"
      >
        <MaskedInput
          id="github-pat"
          value={githubPat}
          onChange={setGithubPat}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
      </Field>

      <div style={infoBoxStyle}>
        VibeFlow will automatically configure a GitHub MCP server for this project using this token. No extra setup needed.
      </div>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({ 'github-pat': setGithubPat })}
      />
    </div>
  );

  const renderCoolify = () => (
    <div>
      <h2 style={sectionHeading}>Coolify</h2>

      <Field
        label="Coolify URL"
        help="The base URL of your Coolify instance."
      >
        <input
          type="text"
          value={coolifyBaseUrl}
          onChange={e => setCoolifyBaseUrl(e.target.value)}
          placeholder="https://coolify.yourserver.com"
          style={inputStyle}
        />
      </Field>

      <Field
        label="API token"
        help="Found in Coolify → Settings → API Tokens"
      >
        <MaskedInput
          id="coolify-token"
          value={coolifyApiToken}
          onChange={setCoolifyApiToken}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <Field
        label="App ID (optional)"
        help="The application ID in Coolify. You can add this later if you don't know it yet."
      >
        <input
          type="text"
          value={coolifyAppId}
          onChange={e => setCoolifyAppId(e.target.value)}
          placeholder="app-id-from-coolify"
          style={inputStyle}
        />
      </Field>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'coolify-token': setCoolifyApiToken,
          'coolify-base-url': setCoolifyBaseUrl,
          'coolify-app-id': setCoolifyAppId,
        })}
      />
    </div>
  );

  const handleRailwayTest = async () => {
    setRailwayTesting(true);
    setRailwayTestResult(null);
    const r = await window.vibeflow.connectionTest.railway(railwayApiKey);
    setRailwayTestResult(r);
    setRailwayTesting(false);
  };

  const renderRailway = () => (
    <div>
      <h2 style={sectionHeading}>Railway</h2>

      <Field
        label="API key"
        help="Found at railway.app/account/tokens"
      >
        <MaskedInput
          id="railway-key"
          value={railwayApiKey}
          onChange={(v) => { setRailwayApiKey(v); setRailwayTestResult(null); }}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <Field
        label="Project ID"
        help="The Railway project ID (from your project URL or settings)"
      >
        <input
          type="text"
          value={railwayProjectId}
          onChange={e => setRailwayProjectId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Service ID (optional)"
        help="The specific Railway service. You can add this later."
      >
        <input
          type="text"
          value={railwayServiceId}
          onChange={e => setRailwayServiceId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={inputStyle}
        />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleRailwayTest}
          disabled={railwayTesting || !railwayApiKey.trim()}
          style={{
            padding: '7px 14px', background: 'transparent',
            border: `1px solid ${C.border2}`, borderRadius: R.md,
            color: C.text2, fontSize: 12, cursor: railwayTesting || !railwayApiKey.trim() ? 'default' : 'pointer',
            opacity: !railwayApiKey.trim() ? 0.5 : 1,
          }}
        >
          {railwayTesting ? 'Testing…' : 'Test connection'}
        </button>
        {railwayTestResult && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: R.md, fontSize: 12,
            backgroundColor: railwayTestResult.success ? C.greenBg : C.redBg,
            color: railwayTestResult.success ? C.green : C.red,
            border: `1px solid ${railwayTestResult.success ? C.greenBd : C.redBd}`,
          }}>
            {railwayTestResult.message}
          </div>
        )}
      </div>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'railway-key': setRailwayApiKey,
          'railway-project-id': setRailwayProjectId,
          'railway-service-id': setRailwayServiceId,
        })}
      />
    </div>
  );

  const renderSupabase = () => (
    <div>
      <h2 style={sectionHeading}>Supabase</h2>

      <div style={{
        padding: '8px 12px',
        backgroundColor: C.yellowBg,
        border: `1px solid ${C.yellowBd}`,
        borderRadius: R.md,
        fontSize: 12,
        color: C.yellow,
        fontWeight: 600,
        marginBottom: 16,
      }}>
        This is for YOUR PROJECT'S Supabase — not the VibeFlow application database.
      </div>

      <Field
        label="Project URL"
        help="Found in Supabase dashboard → Settings → API"
      >
        <input
          type="text"
          value={supabaseProjectUrl}
          onChange={e => setSupabaseProjectUrl(e.target.value)}
          placeholder="https://abcdefghij.supabase.co"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Project ref"
        help="The short ID at the start of your project URL"
      >
        <input
          type="text"
          value={supabaseProjectRef}
          onChange={e => setSupabaseProjectRef(e.target.value)}
          placeholder="abcdefghij"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Anon key (public)"
        help="The public anon key. Safe to share. Found in Supabase → Settings → API"
      >
        <input
          type="text"
          value={supabaseAnonKey}
          onChange={e => setSupabaseAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          style={inputStyle}
        />
      </Field>

      <Field
        label="Service role key"
        help="⚠️ Keep this secret. Admin-level access. Found in Supabase → Settings → API"
      >
        <MaskedInput
          id="supabase-service-role"
          value={supabaseServiceRoleKey}
          onChange={setSupabaseServiceRoleKey}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        />
      </Field>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'supabase-service-role': setSupabaseServiceRoleKey,
          'supabase-anon-key': setSupabaseAnonKey,
          'supabase-project-url': setSupabaseProjectUrl,
          'supabase-project-ref': setSupabaseProjectRef,
        })}
      />
    </div>
  );

  const renderSsh = () => {
    const sshTestSuccess = sshTestResult !== null && !sshTestResult.toLowerCase().startsWith('connection failed') && !sshTestResult.toLowerCase().startsWith('connection test failed');
    return (
      <div>
        <h2 style={sectionHeading}>SSH server</h2>
        <p style={sectionSubheading}>The live server where your app is deployed.</p>

        <Field label="Hostname">
          <input
            type="text"
            value={sshHostname}
            onChange={e => setSshHostname(e.target.value)}
            placeholder="192.168.1.1 or myserver.com"
            style={inputStyle}
          />
        </Field>

        <Field label="Username">
          <input
            type="text"
            value={sshUsername}
            onChange={e => setSshUsername(e.target.value)}
            placeholder="ubuntu"
            style={inputStyle}
          />
        </Field>

        <Field label="Port">
          <input
            type="text"
            value={sshPort}
            onChange={e => setSshPort(e.target.value)}
            placeholder="22"
            style={{ ...inputStyle, width: 100 }}
          />
        </Field>

        <Field
          label="Identity file path"
          help="Path to your SSH private key on this machine. Leave blank to use the system default."
        >
          <input
            type="text"
            value={sshIdentityFilePath}
            onChange={e => setSshIdentityFilePath(e.target.value)}
            placeholder="~/.ssh/id_rsa"
            style={inputStyle}
          />
        </Field>

        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            disabled={sshTesting || !sshHostname}
            onClick={handleSshTest}
            style={{
              ...subtleBtn,
              opacity: (sshTesting || !sshHostname) ? 0.6 : 1,
              cursor: (sshTesting || !sshHostname) ? 'not-allowed' : 'pointer',
            }}
          >
            {sshTesting ? 'Testing…' : 'Test connection'}
          </button>

          {sshTestResult && (
            <div style={{
              marginTop: 8,
              padding: '6px 12px',
              borderRadius: R.md,
              fontSize: 12,
              backgroundColor: sshTestSuccess ? C.greenBg : C.redBg,
              color: sshTestSuccess ? C.green : C.red,
              border: `1px solid ${sshTestSuccess ? C.greenBd : C.redBd}`,
            }}>
              {sshTestResult}
            </div>
          )}
        </div>

        <CopyFromProject
          existingProjects={existingProjects}
          copySource={copySource}
          setCopySource={setCopySource}
          copying={copying}
          onCopy={() => handleCopyFromProject({
            'ssh-hostname': setSshHostname,
            'ssh-username': setSshUsername,
            'ssh-port': setSshPort,
            'ssh-identity-file': setSshIdentityFilePath,
          })}
        />
      </div>
    );
  };

  const renderCustomMcp = () => (
    <div>
      <h2 style={sectionHeading}>Custom MCP servers</h2>

      {mcpServers.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mcpServers.map((srv, idx) => (
            <div key={idx} style={{
              padding: '10px 14px',
              backgroundColor: C.bg4,
              border: `1px solid ${C.border2}`,
              borderRadius: R.md,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ color: C.text1, fontWeight: 600, fontSize: 13 }}>{srv.name}</div>
                {srv.description && (
                  <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>{srv.description}</div>
                )}
                <div style={{ color: C.text3, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                  {srv.command} {srv.args.join(' ')} · {srv.transport}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMcpServers(prev => prev.filter((_, i) => i !== idx))}
                style={dangerBtn}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!showMcpForm ? (
        <button
          type="button"
          onClick={() => setShowMcpForm(true)}
          style={ghostBtn}
        >
          + Add another server
        </button>
      ) : (
        <div style={{
          padding: 16,
          backgroundColor: C.bg4,
          border: `1px solid ${C.border2}`,
          borderRadius: R.md,
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['fields', 'json'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setMcpFormMode(mode)}
                style={{
                  ...subtleBtn,
                  backgroundColor: mcpFormMode === mode ? C.accentBg2 : C.bg5,
                  color: mcpFormMode === mode ? C.accent : C.text2,
                  border: `1px solid ${mcpFormMode === mode ? C.accent + '55' : C.border2}`,
                }}
              >
                {mode === 'fields' ? 'Fill in fields' : 'Paste JSON'}
              </button>
            ))}
          </div>

          {mcpFormMode === 'fields' ? (
            <>
              <Field label="Name *">
                <input type="text" value={mcpDraftName} onChange={e => setMcpDraftName(e.target.value)} placeholder="My MCP Server" style={inputStyle} />
              </Field>
              <Field label="Description">
                <input type="text" value={mcpDraftDescription} onChange={e => setMcpDraftDescription(e.target.value)} placeholder="What does this server do?" style={inputStyle} />
              </Field>
              <Field label="Command *">
                <input type="text" value={mcpDraftCommand} onChange={e => setMcpDraftCommand(e.target.value)} placeholder="npx" style={inputStyle} />
              </Field>
              <Field label="Args (space-separated)">
                <input type="text" value={mcpDraftArgs} onChange={e => setMcpDraftArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-github" style={inputStyle} />
              </Field>
              <Field label="Transport">
                <select
                  value={mcpDraftTransport}
                  onChange={e => setMcpDraftTransport(e.target.value as 'stdio' | 'sse' | 'http')}
                  style={selectStyle}
                >
                  <option value="stdio">stdio (spawn process)</option>
                  <option value="sse">SSE (Server-Sent Events)</option>
                  <option value="http">HTTP (JSON-RPC)</option>
                </select>
              </Field>
              <Field label="Env vars (KEY=VALUE, one per line)">
                <textarea
                  value={mcpDraftEnv}
                  onChange={e => setMcpDraftEnv(e.target.value)}
                  placeholder="GITHUB_TOKEN=ghp_xxx"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="JSON config">
                <textarea
                  value={mcpDraftJson}
                  onChange={e => {
                    setMcpDraftJson(e.target.value);
                    setMcpDraftJsonError(null);
                  }}
                  onBlur={() => {
                    if (!mcpDraftJson.trim()) return;
                    try { JSON.parse(mcpDraftJson); setMcpDraftJsonError(null); }
                    catch { setMcpDraftJsonError('Invalid JSON.'); }
                  }}
                  placeholder={'{\n  "name": "My Server",\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-github"],\n  "transport": "stdio"\n}'}
                  rows={7}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
              </Field>
              {mcpDraftJsonError && (
                <div style={{ color: C.red, fontSize: 12, marginTop: -8, marginBottom: 8 }}>
                  {mcpDraftJsonError}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={addMcpServer} style={primaryBtn}>Add</button>
            <button type="button" onClick={resetMcpForm} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => {/* MCP copy via project config — handled at creation time */}}
      />
    </div>
  );

  const renderCloudflare = () => (
    <div>
      <h2 style={sectionHeading}>Cloudflare</h2>

      <Field
        label="Account ID"
        help="Found in Cloudflare dashboard → right sidebar"
      >
        <input
          type="text"
          value={cloudflareAccountId}
          onChange={e => setCloudflareAccountId(e.target.value)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          style={inputStyle}
        />
      </Field>

      <Field
        label="API token"
        help="Create at dash.cloudflare.com/profile/api-tokens. Need: Zone:Read, Cache Purge, DNS:Edit permissions (adjust to your needs)"
      >
        <MaskedInput
          id="cloudflare-token"
          value={cloudflareApiToken}
          onChange={setCloudflareApiToken}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <Field
        label="Zone ID (optional)"
        help="The Zone ID for a specific domain. Found in the domain's overview page. Leave blank if you're using account-level tokens."
      >
        <input
          type="text"
          value={cloudflareZoneId}
          onChange={e => setCloudflareZoneId(e.target.value)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          style={inputStyle}
        />
      </Field>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'cloudflare-token': setCloudflareApiToken,
          'cloudflare-account-id': setCloudflareAccountId,
          'cloudflare-zone-id': setCloudflareZoneId,
        })}
      />
    </div>
  );

  const handleBrevoTest = async () => {
    setBrevoTesting(true);
    setBrevoTestResult(null);
    const r = await window.vibeflow.connectionTest.brevo(brevoApiKey);
    setBrevoTestResult(r);
    setBrevoTesting(false);
  };

  const renderBrevo = () => (
    <div>
      <h2 style={sectionHeading}>Brevo (email)</h2>

      <Field
        label="API key"
        help="Found at app.brevo.com → Settings → API Keys"
      >
        <MaskedInput
          id="brevo-key"
          value={brevoApiKey}
          onChange={(v) => { setBrevoApiKey(v); setBrevoTestResult(null); }}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleBrevoTest}
          disabled={brevoTesting || !brevoApiKey.trim()}
          style={{
            padding: '7px 14px', background: 'transparent',
            border: `1px solid ${C.border2}`, borderRadius: R.md,
            color: C.text2, fontSize: 12, cursor: brevoTesting || !brevoApiKey.trim() ? 'default' : 'pointer',
            opacity: !brevoApiKey.trim() ? 0.5 : 1,
          }}
        >
          {brevoTesting ? 'Testing…' : 'Test connection'}
        </button>
        {brevoTestResult && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: R.md, fontSize: 12,
            backgroundColor: brevoTestResult.success ? C.greenBg : C.redBg,
            color: brevoTestResult.success ? C.green : C.red,
            border: `1px solid ${brevoTestResult.success ? C.greenBd : C.redBd}`,
          }}>
            {brevoTestResult.message}
          </div>
        )}
      </div>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({ 'brevo-key': setBrevoApiKey })}
      />
    </div>
  );

  const handleClawdtalkTest = async () => {
    setClawdtalkTesting(true);
    setClawdtalkTestResult(null);
    const r = await window.vibeflow.connectionTest.clawdtalk(clawdtalkApiKey);
    setClawdtalkTestResult(r);
    setClawdtalkTesting(false);
  };

  const renderClawdtalk = () => (
    <div>
      <h2 style={sectionHeading}>ClawdTalk</h2>

      <Field
        label="API key"
        help="Found in your ClawdTalk account settings at clawdtalk.com"
      >
        <MaskedInput
          id="clawdtalk-key"
          value={clawdtalkApiKey}
          onChange={(v) => { setClawdtalkApiKey(v); setClawdtalkTestResult(null); }}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleClawdtalkTest}
          disabled={clawdtalkTesting || !clawdtalkApiKey.trim()}
          style={{
            padding: '7px 14px', background: 'transparent',
            border: `1px solid ${C.border2}`, borderRadius: R.md,
            color: C.text2, fontSize: 12, cursor: clawdtalkTesting || !clawdtalkApiKey.trim() ? 'default' : 'pointer',
            opacity: !clawdtalkApiKey.trim() ? 0.5 : 1,
          }}
        >
          {clawdtalkTesting ? 'Testing…' : 'Test connection'}
        </button>
        {clawdtalkTestResult && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: R.md, fontSize: 12,
            backgroundColor: clawdtalkTestResult.success ? C.greenBg : C.redBg,
            color: clawdtalkTestResult.success ? C.green : C.red,
            border: `1px solid ${clawdtalkTestResult.success ? C.greenBd : C.redBd}`,
          }}>
            {clawdtalkTestResult.message}
          </div>
        )}
      </div>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({ 'clawdtalk-key': setClawdtalkApiKey })}
      />
    </div>
  );

  const googleProjectId = (() => {
    try { return googleServiceAccountJson.trim() ? (JSON.parse(googleServiceAccountJson) as Record<string, unknown>).project_id as string : null; }
    catch { return null; }
  })();

  const renderGoogle = () => (
    <div>
      <h2 style={sectionHeading}>Google OAuth</h2>
      <p style={sectionSubheading}>Set up Google sign-in for your project.</p>

      <Field
        label="Client ID"
        help="From Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs"
      >
        <input
          type="text"
          value={googleClientId}
          onChange={e => setGoogleClientId(e.target.value)}
          placeholder="xxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Client Secret"
        help="From the same Credentials page"
      >
        <MaskedInput
          id="google-oauth-secret"
          value={googleClientSecret}
          onChange={setGoogleClientSecret}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <div style={{ ...infoBoxStyle, marginTop: 12 }}>
        <strong style={{ color: '#90caf9' }}>Add these redirect URIs in Google Cloud Console:</strong><br />
        <div style={{ margin: '8px 0 4px', fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0' }}>
          https://[your-app-domain]/auth/google/callback
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0' }}>
          http://localhost:[port]/auth/google/callback
        </div>
        {googleProjectId ? (
          <div style={{ marginTop: 10 }}>
            <a
              href={`https://console.cloud.google.com/apis/credentials?project=${googleProjectId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#64b5f6', fontSize: 12 }}
            >
              → Open Google Cloud Console for project &ldquo;{googleProjectId}&rdquo;
            </a>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
            Paste your Service Account JSON below to get a direct link to the right Google Cloud project.
          </div>
        )}
      </div>

      <Field
        label="Service Account JSON (optional)"
        help="Paste your service account JSON to auto-link to the correct Google Cloud project and store it encrypted for future automation"
      >
        <textarea
          value={googleServiceAccountJson}
          onChange={e => setGoogleServiceAccountJson(e.target.value)}
          placeholder={'{\n  "type": "service_account",\n  "project_id": "your-project",\n  ...\n}'}
          rows={5}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
        />
      </Field>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'google-oauth-client-id': setGoogleClientId,
          'google-oauth-secret': setGoogleClientSecret,
        })}
      />
    </div>
  );

  const handleAzureAutoCreate = async () => {
    if (!azureSpClientId.trim() || !azureSpClientSecret.trim() || !azureSpTenantId.trim()) {
      setAzureAutoMsg({ text: 'Fill in all three Service Principal fields first.', ok: false });
      return;
    }
    setAzureAutoCreating(true);
    setAzureAutoMsg(null);
    try {
      const result = await window.vibeflow.oauth.createAzureApp({
        sp: { tenantId: azureSpTenantId.trim(), clientId: azureSpClientId.trim(), clientSecret: azureSpClientSecret.trim() },
        appDisplayName: name.trim() || 'VibeFlow App',
        redirectUris: [
          'https://[your-app-domain]/auth/microsoft/callback',
          'http://localhost:3000/auth/microsoft/callback',
        ],
      });
      if (result.success && result.appId && result.clientSecret) {
        setAzureClientId(result.appId);
        setAzureClientSecret(result.clientSecret);
        setAzureTenantId(azureSpTenantId.trim());
        setAzureAutoMsg({ text: `App registered successfully. Client ID and secret have been pre-filled.`, ok: true });
      } else {
        setAzureAutoMsg({ text: result.error ?? 'Auto-registration failed.', ok: false });
      }
    } catch (err) {
      setAzureAutoMsg({ text: String(err instanceof Error ? err.message : err), ok: false });
    } finally {
      setAzureAutoCreating(false);
    }
  };

  const renderAzure = () => (
    <div>
      <h2 style={sectionHeading}>Microsoft / Azure OAuth</h2>
      <p style={sectionSubheading}>Set up Microsoft sign-in for your project. Enter credentials manually, or auto-create an app registration using a Service Principal.</p>

      {/* Manual entry */}
      <Field
        label="Client ID (Application ID)"
        help="From Azure Portal → App registrations → your app → Overview"
      >
        <input
          type="text"
          value={azureClientId}
          onChange={e => setAzureClientId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Client Secret"
        help="From Azure Portal → your app → Certificates & secrets"
      >
        <MaskedInput
          id="azure-oauth-secret"
          value={azureClientSecret}
          onChange={setAzureClientSecret}
          showSecrets={showSecrets}
          setShowSecrets={setShowSecrets}
        />
      </Field>

      <Field
        label="Tenant ID"
        help="Use 'common' for multi-tenant apps, or your specific Azure tenant ID for single-tenant"
      >
        <input
          type="text"
          value={azureTenantId}
          onChange={e => setAzureTenantId(e.target.value)}
          placeholder="common"
          style={inputStyle}
        />
      </Field>

      <div style={{ ...infoBoxStyle, marginBottom: 16 }}>
        <strong style={{ color: '#90caf9' }}>Register these redirect URIs in Azure Portal → Authentication:</strong><br />
        <div style={{ margin: '8px 0 4px', fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0' }}>
          https://[your-app-domain]/auth/microsoft/callback
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0' }}>
          http://localhost:[port]/auth/microsoft/callback
        </div>
      </div>

      {/* Auto-create via Service Principal */}
      <div style={{ border: '1px solid #333', borderRadius: 6, padding: '14px 16px', marginBottom: 16, backgroundColor: '#161b22' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#90caf9', marginBottom: 4 }}>
          Auto-create app registration
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: '1.6' }}>
          Provide a Service Principal with <code style={{ color: '#aaa' }}>Application.ReadWrite.OwnedBy</code> permission.
          VibeFlow will call the Microsoft Graph API to create the app registration and generate a client secret.
        </div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 12, lineHeight: '1.7', borderLeft: '2px solid #333', paddingLeft: 10 }}>
          <strong style={{ color: '#888', display: 'block', marginBottom: 4 }}>Don't have a Service Principal? Create one in 3 steps:</strong>
          1. <a href="https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps" target="_blank" rel="noreferrer" style={{ color: '#64b5f6' }}>Azure Portal → App registrations → New registration</a><br />
          2. Go to <strong style={{ color: '#999' }}>Certificates &amp; secrets → New client secret</strong> and copy the value<br />
          3. Go to <strong style={{ color: '#999' }}>API permissions → Add → Microsoft Graph → Application → Application.ReadWrite.OwnedBy → Grant admin consent</strong>
        </div>

        <Field label="Service Principal — Tenant ID" help="The Azure tenant where the Service Principal lives">
          <input
            type="text"
            value={azureSpTenantId}
            onChange={e => setAzureSpTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={inputStyle}
          />
        </Field>

        <Field label="Service Principal — Client ID" help="Application (client) ID of the Service Principal">
          <input
            type="text"
            value={azureSpClientId}
            onChange={e => setAzureSpClientId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={inputStyle}
          />
        </Field>

        <Field label="Service Principal — Client Secret" help="Secret credential of the Service Principal (not stored)">
          <MaskedInput
            id="azure-sp-secret"
            value={azureSpClientSecret}
            onChange={setAzureSpClientSecret}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        </Field>

        <button
          onClick={handleAzureAutoCreate}
          disabled={azureAutoCreating || !azureSpClientId.trim() || !azureSpClientSecret.trim() || !azureSpTenantId.trim()}
          style={{
            padding: '8px 16px', background: azureAutoCreating ? '#1a237e' : '#283593',
            border: '1px solid #3949ab', borderRadius: 4, color: '#e0e0e0',
            fontSize: 12, cursor: azureAutoCreating ? 'default' : 'pointer',
            opacity: (!azureSpClientId.trim() || !azureSpClientSecret.trim() || !azureSpTenantId.trim()) ? 0.5 : 1,
          }}
        >
          {azureAutoCreating ? 'Creating…' : '⚡ Auto-create app registration'}
        </button>

        {azureAutoMsg && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12,
            background: azureAutoMsg.ok ? '#1b3a1f' : '#3a1b1b',
            color: azureAutoMsg.ok ? '#69f0ae' : '#ff5252',
            border: `1px solid ${azureAutoMsg.ok ? '#2e7d3244' : '#c6282844'}`,
          }}>
            {azureAutoMsg.text}
          </div>
        )}
      </div>

      <CopyFromProject
        existingProjects={existingProjects}
        copySource={copySource}
        setCopySource={setCopySource}
        copying={copying}
        onCopy={() => handleCopyFromProject({
          'azure-oauth-client-id': setAzureClientId,
          'azure-oauth-secret': setAzureClientSecret,
          'azure-oauth-tenant-id': setAzureTenantId,
        })}
      />
    </div>
  );

  const renderSummary = () => {
    const items: Array<{ label: string; value: string; ok: boolean }> = [
      { label: 'Project name', value: name.trim() || '(not set)', ok: !!name.trim() },
      { label: 'Local folder', value: localFolderPath || 'not set', ok: true },
      { label: 'GitHub repo', value: repoUrl || 'not set', ok: true },
    ];

    if (selectedIntegrations.includes('github')) {
      items.push({ label: 'GitHub PAT', value: githubPat ? 'configured + MCP server will be created' : 'not set', ok: !!githubPat });
    }
    if (selectedIntegrations.includes('coolify')) {
      items.push({ label: 'Coolify', value: coolifyBaseUrl || 'URL not set', ok: !!coolifyBaseUrl });
    }
    if (selectedIntegrations.includes('railway')) {
      items.push({ label: 'Railway', value: railwayProjectId ? `Project ID: ${railwayProjectId}` : 'Project ID not set', ok: !!railwayProjectId });
    }
    if (selectedIntegrations.includes('supabase')) {
      items.push({ label: 'Supabase', value: supabaseProjectUrl || 'URL not set', ok: !!supabaseProjectUrl });
    }
    if (selectedIntegrations.includes('ssh')) {
      items.push({ label: 'SSH', value: sshHostname ? `${sshUsername ? sshUsername + '@' : ''}${sshHostname}:${sshPort}` : 'Hostname not set', ok: !!sshHostname });
    }
    if (selectedIntegrations.includes('custom-mcp')) {
      items.push({ label: 'Custom MCP servers', value: mcpServers.length > 0 ? `${mcpServers.length} server(s) configured` : 'none', ok: true });
    }
    if (selectedIntegrations.includes('cloudflare')) {
      items.push({ label: 'Cloudflare', value: cloudflareAccountId ? `Account: ${cloudflareAccountId.slice(0, 8)}…` : 'Account ID not set', ok: !!cloudflareAccountId });
    }
    if (selectedIntegrations.includes('brevo')) {
      items.push({ label: 'Brevo', value: brevoApiKey ? 'API key configured' : 'not set', ok: !!brevoApiKey });
    }
    if (selectedIntegrations.includes('clawdtalk')) {
      items.push({ label: 'ClawdTalk', value: clawdtalkApiKey ? 'API key configured' : 'not set', ok: !!clawdtalkApiKey });
    }
    if (selectedIntegrations.includes('google')) {
      items.push({ label: 'Google OAuth', value: googleClientId ? `Client ID: ${googleClientId.slice(0, 16)}…` : 'not set', ok: !!googleClientId });
    }
    if (selectedIntegrations.includes('azure')) {
      items.push({ label: 'Azure OAuth', value: azureClientId ? `Client ID: ${azureClientId.slice(0, 16)}…` : 'not set', ok: !!azureClientId });
    }

    return (
      <div>
        <h2 style={sectionHeading}>Ready to create your project</h2>

        <div style={{
          backgroundColor: C.bg4,
          border: `1px solid ${C.border2}`,
          borderRadius: R.md,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 14px',
              borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{
                fontSize: 13,
                color: item.ok ? C.green : C.text3,
                flexShrink: 0,
                marginTop: 1,
              }}>
                {item.ok ? '✓' : '○'}
              </span>
              <span style={{ fontSize: 12, color: C.text3, flexShrink: 0, width: 140 }}>{item.label}:</span>
              <span style={{ fontSize: 12, color: C.text2, flex: 1 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: C.redBg,
            border: `1px solid ${C.redBd}`,
            borderRadius: R.md,
            color: C.red,
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}
      </div>
    );
  };

  // ── Step dispatcher ──────────────────────────────────────────────────────────

  const renderStep = () => {
    const stepId = steps[currentStep];
    switch (stepId) {
      case 'basics': return renderBasics();
      case 'checklist': return renderChecklist();
      case 'github': return renderGithub();
      case 'coolify': return renderCoolify();
      case 'railway': return renderRailway();
      case 'supabase': return renderSupabase();
      case 'ssh': return renderSsh();
      case 'custom-mcp': return renderCustomMcp();
      case 'cloudflare': return renderCloudflare();
      case 'brevo': return renderBrevo();
      case 'clawdtalk': return renderClawdtalk();
      case 'google': return renderGoogle();
      case 'azure': return renderAzure();
      case 'summary': return renderSummary();
      default: return <div style={{ color: C.text3 }}>Unknown step: {stepId}</div>;
    }
  };

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        backgroundColor: C.bg1,
        borderRadius: 12,
        padding: 40,
        width: 560,
        maxHeight: '88vh',
        overflow: 'auto',
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
        border: `1px solid ${C.border2}`,
        boxSizing: 'border-box',
      }}>
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close wizard"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: C.text3,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>

        {/* Edit mode label */}
        {isEditing && (
          <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
            Configure project — {editProject?.name}
          </div>
        )}

        {/* Progress */}
        <WizardProgress steps={steps} currentStep={currentStep} />

        {/* Step content */}
        <div style={{ minHeight: 200 }}>
          {renderStep()}
        </div>

        {/* Navigation bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 28,
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
        }}>
          {/* Back */}
          <button
            type="button"
            onClick={goBack}
            disabled={isFirstStep}
            style={{
              ...ghostBtn,
              opacity: isFirstStep ? 0.35 : 1,
              cursor: isFirstStep ? 'not-allowed' : 'pointer',
            }}
          >
            ← Back
          </button>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isLastStep && (
              <button
                type="button"
                onClick={goNext}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.text3,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  padding: '7px 4px',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Skip for now →
              </button>
            )}
            {isLastStep ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                style={{
                  ...primaryBtn,
                  padding: '9px 24px',
                  fontSize: 14,
                  opacity: (creating || !name.trim()) ? 0.6 : 1,
                  cursor: (creating || !name.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save Changes' : 'Create Project')}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={steps[currentStep] === 'basics' && !name.trim()}
                style={{
                  ...primaryBtn,
                  opacity: (steps[currentStep] === 'basics' && !name.trim()) ? 0.6 : 1,
                  cursor: (steps[currentStep] === 'basics' && !name.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
