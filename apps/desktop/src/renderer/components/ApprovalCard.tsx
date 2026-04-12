/** ApprovalCard — modal overlay for Tier 3 human approval. */

import type { ActionRequest } from '../../lib/shared-types';

interface ApprovalCardProps {
  action: ActionRequest;
  onApprove: () => void;
  onReject: () => void;
  onAskMore: () => void;
}

const ROLLBACK_COLORS: Record<string, string> = {
  easy: '#28a745',
  difficult: '#ffc107',
  impossible: '#dc3545',
};

export default function ApprovalCard({ action, onApprove, onReject, onAskMore }: ApprovalCardProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          color: '#c9d1d9',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#58a6ff' }}>
          Action Requires Your Approval
        </h2>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>What:</strong>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>{action.description}</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Why:</strong>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>{action.reason}</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Affected:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13 }}>
            {action.affectedResources.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Rollback Difficulty:</strong>
          <span
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: ROLLBACK_COLORS[action.rollbackDifficulty] + '22',
              color: ROLLBACK_COLORS[action.rollbackDifficulty],
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {action.rollbackDifficulty}
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: '#8b949e', fontSize: 12 }}>Requested by:</strong>
          <span style={{ marginLeft: 8, fontSize: 13 }}>
            {action.requestingModeId} mode ({action.requestingModelId})
          </span>
        </div>

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
