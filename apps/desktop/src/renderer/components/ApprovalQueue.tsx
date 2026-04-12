/** ApprovalQueue — indicator in the bottom bar showing pending approvals and recent decisions. */

import { useState, useEffect } from 'react';
import type { ActionRequest, ApprovalResult } from '../../lib/shared-types';

interface ApprovalQueueProps {
  pendingCount: number;
  recentApprovals: Array<{
    decision: string;
    tier: number;
    description: string;
    reviewerModel: string | null;
  }>;
  onPendingClick: () => void;
}

export default function ApprovalQueue({ pendingCount, recentApprovals, onPendingClick }: ApprovalQueueProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Badge indicator */}
      <span
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          fontSize: 12,
          color: pendingCount > 0 ? '#ffc107' : '#8b949e',
          padding: '2px 8px',
          borderRadius: 4,
          backgroundColor: pendingCount > 0 ? '#ffc10722' : 'transparent',
        }}
      >
        {pendingCount > 0 ? `⏳ ${pendingCount} pending` : '✅ Auto'}
      </span>

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            width: 320,
            maxHeight: 300,
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: 12,
            overflow: 'auto',
            marginBottom: 4,
            zIndex: 100,
          }}
        >
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#8b949e' }}>
            Approval Queue
          </h4>

          {pendingCount > 0 && (
            <div
              onClick={onPendingClick}
              style={{
                padding: '8px 12px',
                backgroundColor: '#3d2e00',
                borderRadius: 6,
                color: '#ffc107',
                fontSize: 13,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              ⏳ {pendingCount} action{pendingCount > 1 ? 's' : ''} awaiting your approval
            </div>
          )}

          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Recent Decisions</div>
          {recentApprovals.length === 0 ? (
            <div style={{ color: '#484f58', fontSize: 12 }}>No recent approvals</div>
          ) : (
            recentApprovals.slice(0, 5).map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 8px',
                  marginBottom: 2,
                  borderRadius: 4,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#0d1117',
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {entry.decision === 'approved'
                    ? entry.tier === 1
                      ? '✅'
                      : '🔵'
                    : '❌'}
                </span>
                <span style={{ color: '#c9d1d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.description}
                </span>
                {entry.reviewerModel && (
                  <span style={{ color: '#484f58', fontSize: 10 }}>
                    {entry.reviewerModel.split('/').pop()}
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
