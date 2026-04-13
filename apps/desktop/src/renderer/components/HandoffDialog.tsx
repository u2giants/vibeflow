import { useState } from 'react';
import type { HandoffResult } from '../../lib/shared-types';
import { C, R } from '../theme';

interface HandoffDialogProps {
  result: HandoffResult;
  onClose: () => void;
}

export default function HandoffDialog({ result, onClose }: HandoffDialogProps) {
  const [showDoc, setShowDoc] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.handoffPrompt); }
    catch {
      const t = document.createElement('textarea');
      t.value = result.handoffPrompt;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ta: React.CSSProperties = {
    width: '100%', padding: 12,
    backgroundColor: C.bg0,
    color: C.text2,
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: 11,
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: C.bg2,
        border: `1px solid ${C.border2}`,
        borderRadius: R['2xl'],
        width: '80%', maxWidth: 760,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: R.md,
              backgroundColor: C.accentBg, color: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>📋</div>
            <span style={{ color: C.text1, fontWeight: 600, fontSize: 15 }}>Handoff Ready</span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: C.text3, fontSize: 18, cursor: 'pointer', padding: '2px 6px',
            borderRadius: R.md,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <p style={{ fontSize: 13, color: C.text2, marginTop: 0, lineHeight: 1.6 }}>
            Copy the prompt below and paste it into a new AI session to continue seamlessly.
          </p>

          {result.storageUrl && (
            <div style={{
              padding: '8px 12px', backgroundColor: C.greenBg,
              border: `1px solid ${C.greenBd}`, borderRadius: R.md,
              color: C.green, fontSize: 12, marginBottom: 12,
            }}>✓ Saved to cloud storage</div>
          )}
          {result.error && (
            <div style={{
              padding: '8px 12px', backgroundColor: C.redBg,
              border: `1px solid ${C.redBd}`, borderRadius: R.md,
              color: C.red, fontSize: 12, marginBottom: 12,
            }}>⚠ Storage error: {result.error}</div>
          )}

          <button onClick={copy} style={{
            padding: '8px 18px',
            backgroundColor: copied ? C.green : C.accent,
            color: '#fff', border: 'none', borderRadius: R.lg,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            marginBottom: 12, fontFamily: 'inherit',
            transition: 'background-color 0.2s',
          }}>
            {copied ? '✓ Copied!' : '⎘ Copy Prompt'}
          </button>

          <textarea readOnly value={result.handoffPrompt} rows={8} style={ta} />

          <div style={{ marginTop: 14 }}>
            <button onClick={() => setShowDoc(!showDoc)} style={{
              background: 'transparent', border: `1px solid ${C.border2}`,
              color: C.accent, padding: '5px 12px', borderRadius: R.md,
              cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            }}>
              {showDoc ? '▼ Hide' : '▶ View'} Full Handoff Document
            </button>
            {showDoc && (
              <textarea readOnly value={result.handoffDoc} rows={12}
                style={{ ...ta, marginTop: 8 }} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px',
            backgroundColor: C.bg4, color: C.text1,
            border: `1px solid ${C.border2}`, borderRadius: R.lg,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
