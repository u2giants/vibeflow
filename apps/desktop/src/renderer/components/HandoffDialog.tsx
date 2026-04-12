/** HandoffDialog — displays generated handoff prompt with copy-to-clipboard. */

import { useState } from 'react';
import type { HandoffResult } from '../../lib/shared-types';

interface HandoffDialogProps {
  result: HandoffResult;
  onClose: () => void;
}

export default function HandoffDialog({ result, onClose }: HandoffDialogProps) {
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(result.handoffPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = result.handoffPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 12,
        width: '80%',
        maxWidth: 800,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, color: '#c9d1d9', fontSize: 18 }}>
            Handoff Generated ✅
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              fontSize: 20,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <p style={{ color: '#8b949e', fontSize: 14, marginTop: 0 }}>
            Your handoff prompt is ready. Copy it and paste it into a new AI session.
          </p>

          {/* Storage status */}
          {result.storageUrl && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#1a3a2a',
              border: '1px solid #238636',
              borderRadius: 6,
              color: '#3fb950',
              fontSize: 13,
              marginBottom: 12,
            }}>
              ✅ Saved to cloud
            </div>
          )}

          {result.error && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#3d1f28',
              border: '1px solid #f85149',
              borderRadius: 6,
              color: '#f85149',
              fontSize: 13,
              marginBottom: 12,
            }}>
              ⚠️ Storage error: {result.error}
            </div>
          )}

          {/* Copy button */}
          <button
            onClick={handleCopyPrompt}
            style={{
              padding: '8px 20px',
              backgroundColor: copied ? '#238636' : '#0969da',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
          </button>

          {/* Prompt text area */}
          <textarea
            readOnly
            value={result.handoffPrompt}
            style={{
              width: '100%',
              minHeight: 200,
              padding: 12,
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 6,
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {/* Expandable full doc */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowFullDoc(!showFullDoc)}
              style={{
                background: 'transparent',
                border: '1px solid #30363d',
                color: '#58a6ff',
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {showFullDoc ? '▼ Hide' : '▶ View'} Full Handoff Document
            </button>
            {showFullDoc && (
              <textarea
                readOnly
                value={result.handoffDoc}
                style={{
                  width: '100%',
                  minHeight: 300,
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              backgroundColor: '#30363d',
              color: '#c9d1d9',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
