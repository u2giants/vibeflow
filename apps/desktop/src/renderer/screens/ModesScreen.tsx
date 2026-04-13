/** Modes settings screen — list, edit souls, assign models, manage API key. */

import { useState, useEffect, useCallback } from 'react';
import type { Mode, OpenRouterModel } from '../../lib/shared-types';

interface ModesScreenProps {
  onBack: () => void;
}

export default function ModesScreen({ onBack }: ModesScreenProps) {
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [soulDraft, setSoulDraft] = useState('');
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMessage, setModelsMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load modes on mount
  useEffect(() => {
    window.vibeflow.modes.list().then((list) => {
      setModes(list);
      if (list.length > 0) {
        setSelectedMode(list[0]);
        setSoulDraft(list[0].soul);
      }
    });
    window.vibeflow.openrouter.getApiKey().then((r) => setHasApiKey(r.hasKey));
  }, []);

  // Load models from OpenRouter with loading and error handling
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
    setSaveMessage(null);
  };

  const handleSaveSoul = async () => {
    if (!selectedMode) return;
    await window.vibeflow.modes.updateSoul({
      modeId: selectedMode.id,
      soul: soulDraft,
    });
    // Update local state
    setModes((prev) =>
      prev.map((m) =>
        m.id === selectedMode.id ? { ...m, soul: soulDraft } : m
      )
    );
    setSelectedMode((prev) => (prev ? { ...prev, soul: soulDraft } : null));
    setSaveMessage('Soul saved ✅');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSaveModel = async (modelId: string) => {
    if (!selectedMode) return;
    await window.vibeflow.modes.updateModel({
      modeId: selectedMode.id,
      modelId,
    });
    setModes((prev) =>
      prev.map((m) =>
        m.id === selectedMode.id ? { ...m, modelId } : m
      )
    );
    setSelectedMode((prev) => (prev ? { ...prev, modelId } : null));
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

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          borderBottom: '1px solid #333',
        }}
      >
        <button
          onClick={onBack}
          style={{
            marginRight: 12,
            padding: '4px 12px',
            backgroundColor: 'transparent',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Modes Settings</h2>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar — mode list */}
        <div
          style={{
            width: 240,
            minWidth: 240,
            borderRight: '1px solid #ddd',
            overflow: 'auto',
            backgroundColor: '#f8f9fa',
          }}
        >
          {modes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => handleSelectMode(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                backgroundColor:
                  selectedMode?.id === mode.id ? '#e9ecef' : 'transparent',
                borderLeft:
                  selectedMode?.id === mode.id
                    ? `3px solid ${mode.color}`
                    : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 18 }}>{mode.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{mode.name}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{mode.modelId}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — mode details */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column' }}>
          {selectedMode ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>{selectedMode.icon}</span>
                <h3 style={{ margin: 0 }}>{selectedMode.name}</h3>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 12,
                    backgroundColor: selectedMode.color,
                    color: '#fff',
                  }}
                >
                  {selectedMode.approvalPolicy}
                </span>
              </div>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
                {selectedMode.description}
              </p>

              {/* Soul editor */}
              <label style={{ fontWeight: 600, fontSize: 14 }}>Mode Soul (Instructions)</label>
              <textarea
                value={soulDraft}
                onChange={(e) => setSoulDraft(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 200,
                  padding: 12,
                  marginTop: 4,
                  marginBottom: 8,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  onClick={handleSaveSoul}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Save Soul
                </button>
                {saveMessage && (
                  <span style={{ color: '#28a745', fontSize: 13 }}>{saveMessage}</span>
                )}
              </div>

              {/* Model picker */}
              <label style={{ fontWeight: 600, fontSize: 14 }}>Assigned Model</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <select
                  value={selectedMode.modelId}
                  onChange={(e) => handleSaveModel(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  {/* Keep current model visible even if not in refreshed list */}
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
                      {m.name} — ${m.inputPricePerMillion.toFixed(2)}/M in, $
                      {m.outputPricePerMillion.toFixed(2)}/M out
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadModels}
                  disabled={modelsLoading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: modelsLoading ? '#6c757d' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: modelsLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                  }}
                >
                  {modelsLoading ? 'Refreshing...' : 'Refresh Models'}
                </button>
              </div>
              {modelsMessage && (
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 4,
                    marginBottom: 4,
                    color: modelsMessage.includes('✅') ? '#28a745' : '#dc3545',
                  }}
                >
                  {modelsMessage}
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#666' }}>Select a Mode to edit its settings.</p>
          )}

          {/* OpenRouter API Key section */}
          <div
            style={{
              marginTop: 32,
              padding: 16,
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              border: '1px solid #dee2e6',
            }}
          >
            <h4 style={{ margin: '0 0 8px' }}>OpenRouter API Key</h4>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
              {hasApiKey
                ? 'API key is set ✅'
                : 'No API key — enter one to enable AI features and see model pricing.'}
            </p>
            {!hasApiKey && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="password"
                  placeholder="sk-or-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                />
                <button
                  onClick={handleSaveApiKey}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Save Key
                </button>
              </div>
            )}
            <button
              onClick={handleTestConnection}
              style={{
                padding: '6px 16px',
                backgroundColor: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Test Connection
            </button>
            {testResult && (
              <p style={{ fontSize: 13, marginTop: 8, color: testResult.includes('✅') ? '#28a745' : '#dc3545' }}>
                {testResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
