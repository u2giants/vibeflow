/** SecretsPanel — Component 18 secrets inventory UI. */

import { useState, useEffect } from 'react';
import type { SecretRecord } from '../../../lib/shared-types';

interface SecretsPanelProps {
  projectId: string;
}

const SENSITIVITY_COLORS: Record<string, string> = {
  public: '#28a745',
  internal: '#17a2b8',
  confidential: '#ffc107',
  restricted: '#dc3545',
};

export default function SecretsPanel({ projectId }: SecretsPanelProps) {
  const [secrets, setSecrets] = useState<SecretRecord[]>([]);
  const [summary, setSummary] = useState<{ total: number; missing: number; verified: number }>({ total: 0, missing: 0, verified: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [records, invSummary] = await Promise.all([
        window.vibeflow.secrets.list(projectId),
        window.vibeflow.secrets.getInventorySummary(projectId),
      ]);
      setSecrets(records);
      setSummary(invSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(id: string) {
    try {
      const result = await window.vibeflow.secrets.verify(id);
      if (result.success) {
        loadData();
      } else {
        setError(result.error ?? 'Verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  }

  if (loading) {
    return <div style={{ color: '#484f58', fontSize: 13, padding: 16 }}>Loading secrets inventory...</div>;
  }

  if (error) {
    return (
      <div style={{ color: '#dc2626', fontSize: 13, padding: 16 }}>
        <p>Error: {error}</p>
        <button onClick={loadData} style={{ marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 13, color: '#c9d1d9' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ color: '#6b7280' }}>Total: </span>
          <span>{summary.total}</span>
        </div>
        <div>
          <span style={{ color: '#6b7280' }}>Missing: </span>
          <span style={{ color: summary.missing > 0 ? '#dc3545' : '#28a745' }}>{summary.missing}</span>
        </div>
        <div>
          <span style={{ color: '#6b7280' }}>Verified: </span>
          <span style={{ color: summary.verified > 0 ? '#28a745' : '#6b7280' }}>{summary.verified}</span>
        </div>
      </div>

      {/* Missing secrets alert */}
      {summary.missing > 0 && (
        <div style={{
          padding: 8,
          marginBottom: 16,
          backgroundColor: '#dc354520',
          border: '1px solid #dc3545',
          borderRadius: 4,
          color: '#dc3545',
          fontSize: 12,
        }}>
          ⚠️ {summary.missing} secret(s) not stored in keytar. Configure them before deploy.
        </div>
      )}

      {/* Secrets list */}
      {secrets.length === 0 ? (
        <div style={{ color: '#484f58', fontSize: 13 }}>
          <p>No secrets configured yet.</p>
          <p style={{ margin: 0 }}>Add secrets through the migration planning workflow or project intelligence detection.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {secrets.map((secret) => (
            <div
              key={secret.id}
              style={{
                padding: 12,
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{secret.keyName}</span>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: `${SENSITIVITY_COLORS[secret.sensitivityLevel]}20`,
                    border: `1px solid ${SENSITIVITY_COLORS[secret.sensitivityLevel]}`,
                    borderRadius: 4,
                    fontSize: 11,
                    color: SENSITIVITY_COLORS[secret.sensitivityLevel],
                  }}
                >
                  {secret.sensitivityLevel}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
                {secret.description || 'No description'}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                <span>Category: {secret.category}</span>
                <span>Stored: {secret.storedInKeytar ? '✅' : '❌'}</span>
                {secret.lastVerifiedAt && (
                  <span>Verified: {new Date(secret.lastVerifiedAt).toLocaleDateString()}</span>
                )}
              </div>
              {secret.codeReferences.length > 0 && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  Referenced in: {secret.codeReferences.join(', ')}
                </div>
              )}
              {!secret.storedInKeytar && (
                <button
                  onClick={() => handleVerify(secret.id)}
                  style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    backgroundColor: '#1a2332',
                    color: '#58a6ff',
                    border: '1px solid #30363d',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Verify Presence
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
