import { useState } from 'react';
import { C } from '../theme';

interface ApprovalQueueProps {
  pendingCount: number;
  recentApprovals: Array<{ decision: string; tier: number; description: string; reviewerModel: string | null }>;
  onPendingClick: () => void;
}

export default function ApprovalQueue({ pendingCount, recentApprovals, onPendingClick }: ApprovalQueueProps) {
  const [open, setOpen] = useState(false);
  const hasPending = pendingCount > 0;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          backgroundColor: hasPending ? C.yellowBg : 'transparent',
          border: hasPending ? `1px solid ${C.yellowBd}` : '1px solid transparent',
          borderRadius: 4, cursor: 'pointer',
          fontSize: 11, color: hasPending ? C.yellow : C.text3,
          fontFamily: 'inherit',
        }}
      >
        {hasPending ? (
          <><span style={{ animation: 'pulse 1.4s infinite' }}>●</span> {pendingCount} pending</>
        ) : (
          <><span style={{ color: C.green }}>✓</span> Auto-approved</>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0,
          width: 300, maxHeight: 280, overflow: 'auto',
          backgroundColor: C.bg2, border: `1px solid ${C.border2}`,
          borderRadius: 10, padding: 12, marginBottom: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 200,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Approval Queue
          </div>

          {hasPending && (
            <div onClick={onPendingClick} style={{
              padding: '8px 10px', backgroundColor: C.yellowBg,
              border: `1px solid ${C.yellowBd}`, borderRadius: 6,
              color: C.yellow, fontSize: 12, cursor: 'pointer', marginBottom: 8,
            }}>
              ⏳ {pendingCount} action{pendingCount > 1 ? 's' : ''} awaiting approval
            </div>
          )}

          <div style={{ fontSize: 11, color: C.text3, marginBottom: 6 }}>Recent</div>
          {recentApprovals.length === 0 ? (
            <div style={{ fontSize: 12, color: C.text3 }}>No recent decisions</div>
          ) : (
            recentApprovals.slice(0, 5).map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 8px', borderRadius: 5,
                backgroundColor: C.bg3, marginBottom: 3,
              }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>
                  {e.decision === 'approved' ? (e.tier === 1 ? '✅' : '🔵') : '❌'}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.description}
                </span>
                {e.reviewerModel && (
                  <span style={{ fontSize: 10, color: C.text3, flexShrink: 0 }}>
                    {e.reviewerModel.split('/').pop()}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
