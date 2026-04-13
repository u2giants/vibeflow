/** Modes settings screen — list, edit souls, assign models, manage API key. */

import { useState, useEffect, useCallback } from 'react';
import type { Mode, OpenRouterModel } from '../../lib/shared-types';
import { C, R } from '../theme';

interface ModesScreenProps {
  onBack: () => void;
}

export default function ModesScreen({ onBack }: ModesScreenProps) {
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [soulDraft, setSoulDraft] = useState('');
  const [temperatureDraft, setTemperatureDraft] = useState(0.7);
  const [approvalPolicyDraft, setApprovalPolicyDraft] = useState<'auto' | 'second-model' | 'human'>('auto');
  const [fallbackModelDraft, setFallbackModelDraft] = useState<string>('');
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMessage, setModelsMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [backHov, setBackHov] = useState(false);
  const [saveSoulHov, setSaveSoulHov] = useState(false);
  const [saveConfigHov, setSaveConfigHov] = useState(false);
  const [saveKeyHov, setSaveKeyHov] = useState(false);
  const [testHov, setTestHov] = useState(false);
  const [refreshHov, setRefreshHov] = useState(false);

  useEffect(() => {
    window.vibeflow.modes.list().then((list) => {
      setModes(list);
      if (list.length > 0) {
        setSelectedMode(list[0]);
        setSoulDraft(list[0].soul);
        setTemperatureDraft(list[0].temperature);
        setApprovalPolicyDraft(list[0].approvalPolicy);
        setFallbackModelDraft(list[0].fallbackModelId ?? '');
      }
    });
    window.vibeflow.openrouter.getApiKey().then((r) => setHasApiKey(r.hasKey));
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsMessage(null);
    try {
      const list = await window.vibeflow.openrouter.listModels();
      setModels(list);
      setModelsMessage(`Loaded ${list.length} models ✅`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setModelsMessage(`Failed to load models: ${message}`);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasApiKey) loadModels();
  }, [hasApiKey, loadModels]);

  const handleSelectMode = (mode: Mode) => {
    setSelectedMode(mode);
    setSoulDraft(mode.soul);
    setTemperatureDraft(mode.temperature);
    setApprovalPolicyDraft(mode.approvalPolicy);
    setFallbackModelDraft(mode.fallbackModelId ?? '');
    setSaveMessage(null);
  };

  const handleSaveSoul = async () => {
    if (!selectedMode) return;
    await window.vibeflow.modes.updateSoul({ modeId: selectedMode.id, soul: soulDraft });
    setModes((prev) => prev.map((m) => m.id === selectedMode.id ? { ...m, soul: soulDraft } : m));
    setSelectedMode((prev) => (prev ? { ...prev, soul: soulDraft } : null));
    setSaveMessage('Soul saved ✅');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSaveModel = async (modelId: string) => {
    if (!selectedMode) return;
    await window.vibeflow.modes.updateModel({ modeId: selectedMode.id, modelId });
    setModes((prev) => prev.map((m) => m.id === selectedMode.id ? { ...m, modelId } : m));
    setSelectedMode((prev) => (prev ? { ...prev, modelId } : null));
  };

  const handleSaveConfig = async () => {
    if (!selectedMode) return;
    await window.vibeflow.modes.updateConfig({
      modeId: selectedMode.id,
      temperature: temperatureDraft,
      approvalPolicy: approvalPolicyDraft,
      fallbackModelId: fallbackModelDraft || null,
    });
    setModes((prev) => prev.map((m) =>
      m.id === selectedMode.id
        ? { ...m, temperature: temperatureDraft, approvalPolicy: approvalPolicyDraft, fallbackModelId: fallbackModelDraft || null }
        : m
    ));
    setSelectedMode((prev) =>
      prev ? { ...prev, temperature: temperatureDraft, approvalPolicy: approvalPolicyDraft, fallbackModelId: fallbackModelDraft || null } : null
    );
    setSaveMessage('Config saved ✅');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await window.vibeflow.openrouter.setApiKey(apiKeyInput.trim());
    setHasApiKey(true);
    setApiKeyInput('');
    setTestResult(null);
    await loadModels();
  };

  const handleTestConnection = async () => {
    const result = await window.vibeflow.openrouter.testConnection();
    setTestResult(result.success ? 'Connection OK ✅' : `Failed: ${result.error}`);
  };

  const labelStyle = {
    fontSize: 11,
    color: C.text3,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: 6,
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: C.bg5,
    color: C.text1,
    border: `1px solid ${C.border2}`,
    borderRadius: R.md,
    outline: 'none',
    fontSize: 13,
    boxSizing: 'border-box' as const,
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', backgroundColor: C.bg0 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        backgroundColor: C.bg1,
        borderBottom: `1px solid ${C.border}`,
        gap: 12,
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
        <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>Modes Settings</h2>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar — mode list */}
        <div style={{
          width: 240,
          minWidth: 240,
          borderRight: `1px solid ${C.border}`,
          overflow: 'auto',
          backgroundColor: C.bg1,
        }}>
          {modes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => handleSelectMode(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                backgroundColor: selectedMode?.id === mode.id ? C.bg3 : 'transparent',
                borderLeft: selectedMode?.id === mode.id ? `3px solid ${mode.color}` : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: R.full,
                  backgroundColor: mode.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: selectedMode?.id === mode.id ? C.text1 : C.text2 }}>
                  {mode.icon} {mode.name}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mode.modelId}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — mode details */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20, backgroundColor: C.bg0 }}>
          {selectedMode ? (
            <div>
              {/* Mode header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{selectedMode.icon}</span>
                <h3 style={{ margin: 0, fontSize: 18, color: C.text1 }}>{selectedMode.name}</h3>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: R.full,
                  backgroundColor: selectedMode.color + '22',
                  color: selectedMode.color,
                  fontWeight: 600,
                  border: `1px solid ${selectedMode.color}44`,
                }}>
                  {selectedMode.approvalPolicy}
                </span>
              </div>
              <p style={{ color: C.text3, fontSize: 13, marginBottom: 20, marginTop: 4 }}>
                {selectedMode.description}
              </p>

              {/* Soul editor */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Mode Soul (Instructions)</label>
                <textarea
                  value={soulDraft}
                  onChange={(e) => setSoulDraft(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 180,
                    padding: 12,
                    backgroundColor: C.bg2,
                    color: C.text1,
                    border: `1px solid ${C.border2}`,
                    borderRadius: R.lg,
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: 12,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                    lineHeight: 1.6,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={handleSaveSoul}
                    onMouseEnter={() => setSaveSoulHov(true)}
                    onMouseLeave={() => setSaveSoulHov(false)}
                    style={{
                      padding: '7px 18px',
                      backgroundColor: saveSoulHov ? C.accentHov : C.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                  >
                    Save Soul
                  </button>
                  {saveMessage && (
                    <span style={{ color: C.green, fontSize: 13 }}>{saveMessage}</span>
                  )}
                </div>
              </div>

              {/* Model picker */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Assigned Model</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={selectedMode.modelId}
                    onChange={(e) => handleSaveModel(e.target.value)}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    {models.length === 0 && !modelsLoading && (
                      <option value={selectedMode.modelId}>
                        {selectedMode.modelId} (enter API key to see all models)
                      </option>
                    )}
                    {models.length > 0 && !models.some((m) => m.id === selectedMode.modelId) && (
                      <option value={selectedMode.modelId}>
                        {selectedMode.modelId} (current, not in refreshed list)
                      </option>
                    )}
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — ${m.inputPricePerMillion.toFixed(2)}/M in, ${m.outputPricePerMillion.toFixed(2)}/M out
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadModels}
                    disabled={modelsLoading}
                    onMouseEnter={() => setRefreshHov(true)}
                    onMouseLeave={() => setRefreshHov(false)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: modelsLoading ? C.bg4 : refreshHov ? C.accentHov : C.accent,
                      color: modelsLoading ? C.text3 : '#fff',
                      border: 'none',
                      borderRadius: R.md,
                      cursor: modelsLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                      transition: 'background 0.15s',
                    }}
                  >
                    {modelsLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                {modelsMessage && (
                  <p style={{
                    fontSize: 12,
                    marginTop: 6,
                    color: modelsMessage.includes('✅') ? C.green : C.red,
                  }}>
                    {modelsMessage}
                  </p>
                )}
              </div>

              {/* Advanced config */}
              <div style={{
                padding: 16,
                backgroundColor: C.bg2,
                border: `1px solid ${C.border}`,
                borderRadius: R.xl,
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Advanced Config
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={labelStyle}>Temperature: {temperatureDraft.toFixed(1)}</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperatureDraft}
                      onChange={(e) => setTemperatureDraft(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: C.accent }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.text3, marginTop: 2 }}>
                      <span>0.0</span><span>0.5</span><span>1.0</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={labelStyle}>Approval Policy</label>
                    <select
                      value={approvalPolicyDraft}
                      onChange={(e) => setApprovalPolicyDraft(e.target.value as 'auto' | 'second-model' | 'human')}
                      style={selectStyle}
                    >
                      <option value="auto">Auto (no review)</option>
                      <option value="second-model">Second Model Review</option>
                      <option value="human">Human Approval</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Fallback Model ID</label>
                  <input
                    type="text"
                    placeholder="e.g. openai/gpt-4o-mini (leave blank for none)"
                    value={fallbackModelDraft}
                    onChange={(e) => setFallbackModelDraft(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={handleSaveConfig}
                    onMouseEnter={() => setSaveConfigHov(true)}
                    onMouseLeave={() => setSaveConfigHov(false)}
                    style={{
                      padding: '7px 18px',
                      backgroundColor: saveConfigHov ? C.accentHov : C.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: R.md,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                  >
                    Save Config
                  </button>
                  {saveMessage && (
                    <span style={{ color: C.green, fontSize: 13 }}>{saveMessage}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <p style={{ color: C.text3, fontSize: 14 }}>Select a mode to edit its settings.</p>
            </div>
          )}

          {/* OpenRouter API Key section */}
          <div style={{
            padding: 16,
            backgroundColor: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            marginTop: 8,
          }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              OpenRouter API Key
            </div>
            <p style={{ fontSize: 13, color: hasApiKey ? C.green : C.text2, margin: '0 0 12px' }}>
              {hasApiKey ? 'API key is set ✅' : 'No API key — enter one to enable AI features and model pricing.'}
            </p>
            {!hasApiKey && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="password"
                  placeholder="sk-or-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleSaveApiKey}
                  onMouseEnter={() => setSaveKeyHov(true)}
                  onMouseLeave={() => setSaveKeyHov(false)}
                  style={{
                    padding: '7px 16px',
                    backgroundColor: saveKeyHov ? '#0ea471' : C.green,
                    color: '#fff',
                    border: 'none',
                    borderRadius: R.md,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s',
                  }}
                >
                  Save Key
                </button>
              </div>
            )}
            <button
              onClick={handleTestConnection}
              onMouseEnter={() => setTestHov(true)}
              onMouseLeave={() => setTestHov(false)}
              style={{
                padding: '6px 14px',
                backgroundColor: testHov ? C.bg5 : C.bg4,
                color: C.text2,
                border: `1px solid ${C.border2}`,
                borderRadius: R.md,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.15s',
              }}
            >
              Test Connection
            </button>
            {testResult && (
              <p style={{ fontSize: 13, marginTop: 8, color: testResult.includes('✅') ? C.green : C.red }}>
                {testResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
