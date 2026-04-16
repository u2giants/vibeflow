/** ApprovalCard — modal overlay for Tier 3 human approval. */

import type { ActionRequest, RiskClass } from '../../lib/shared-types';
import { C, R } from '../theme';

interface ApprovalCardProps {
  action: ActionRequest;
  onApprove: () => void;
  onReject: () => void;
  onAskMore: () => void;
  /** Component 19: Optional risk class display. */
  riskClass?: RiskClass;
}

const RISK = {
  easy:       { color: C.green,  bg: C.greenBg,  label: 'Easy rollback' },
  difficult:  { color: C.yellow, bg: C.yellowBg, label: 'Difficult rollback' },
  impossible: { color: C.red,    bg: C.redBg,    label: 'Irreversible' },
};

/** Component 19: Color-coded risk class badges. */
const RISK_CLASS_COLORS: Record<RiskClass, string> = {
  'informational': '#6b7280',
  'low': '#28a745',
  'medium': '#ffc107',
  'high': '#fd7e14',
  'destructive': '#dc3545',
  'privileged-production': '#e83e8c',
};

const RISK_CLASS_LABELS: Record<RiskClass, string> = {
  'informational': 'Informational',
  'low': 'Low Risk',
  'medium': 'Medium Risk',
  'high': 'High Risk',
  'destructive': 'Destructive',
  'privileged-production': 'Privileged Production',
};

export default function ApprovalCard({ action, onApprove, onReject, onAskMore, riskClass }: ApprovalCardProps) {
  const risk = RISK[action.rollbackDifficulty] ?? RISK.easy;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: C.bg2,
        border: `1px solid ${C.border2}`,
        borderRadius: R['2xl'],
        padding: 28,
        width: 480,
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: R.lg,
            backgroundColor: risk.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>⚠️</div>
          <div>
            <div style={{ color: C.text1, fontWeight: 600, fontSize: 15 }}>Action requires approval</div>
            <div style={{ color: C.text3, fontSize: 12, marginTop: 1 }}>
              {action.requestingModeId} · {action.requestingModelId.split('/').pop()}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          padding: 14, backgroundColor: C.bg3, borderRadius: R.lg,
          marginBottom: 12, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What</div>
          <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.5 }}>{action.description}</div>
        </div>

        <div style={{
          padding: 14, backgroundColor: C.bg3, borderRadius: R.lg,
          marginBottom: 12, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Why</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{action.reason}</div>
        </div>

        {action.affectedResources.length > 0 && (
          <div style={{
            padding: 14, backgroundColor: C.bg3, borderRadius: R.lg,
            marginBottom: 12, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Affected</div>
            {action.affectedResources.map((r, i) => (
              <div key={i} style={{
                fontSize: 12, color: C.text2, fontFamily: 'monospace',
                padding: '2px 0', paddingLeft: 8, borderLeft: `2px solid ${C.border2}`,
                marginBottom: 2,
              }}>{r}</div>
            ))}
          </div>
        )}

        {/* Risk badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{
            padding: '4px 10px', borderRadius: R.full,
            backgroundColor: risk.bg, color: risk.color,
            fontSize: 11, fontWeight: 600,
          }}>
            {risk.label}
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Requested by:</strong>
          <span style={{ marginLeft: 8, fontSize: 13 }}>
            {action.requestingModeId} mode ({action.requestingModelId})
          </span>
        </div>

        {/* Component 19: Risk class badge */}
        {riskClass && (
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#8b949e', fontSize: 12 }}>Risk Level:</strong>
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: RISK_CLASS_COLORS[riskClass] + '22',
                color: RISK_CLASS_COLORS[riskClass],
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {RISK_CLASS_LABELS[riskClass]}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid #30363d',
          }}
        >
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Approve
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: '#da3633',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reject
          </button>
          <button
            onClick={onAskMore}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: '#1f6feb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Ask for more info
          </button>
        </div>
      </div>
    </div>
  );
}
