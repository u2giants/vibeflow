/** Bottom status bar — shows current Mode, model, connection status, and approval queue. */

import { useState, useEffect } from 'react';
import type { Mode, ActionRequest, ApprovalResult } from '../../lib/shared-types';
import ApprovalQueue from './ApprovalQueue';

interface BottomBarProps {
  currentMode: Mode | null;
  openRouterConnected: boolean;
  onPendingApprovalClick?: () => void;
}

export default function BottomBar({ currentMode, openRouterConnected, onPendingApprovalClick }: BottomBarProps) {
  const modeLabel = currentMode ? `${currentMode.icon} ${currentMode.name}` : 'No Mode selected';
  const modelLabel = currentMode ? currentMode.modelId : '—';
  const connectionLabel = openRouterConnected ? 'OpenRouter ✅' : 'OpenRouter ❌';
  const connectionColor = openRouterConnected ? '#28a745' : '#dc3545';

  const [pendingCount, setPendingCount] = useState(0);
  const [recentApprovals, setRecentApprovals] = useState<Array<{
    decision: string;
    tier: number;
    description: string;
    reviewerModel: string | null;
  }>>([]);

  useEffect(() => {
    // Fetch recent approvals log
    window.vibeflow.approval.getLog().then((log) => {
      setRecentApprovals(log.map((entry: any) => ({
        decision: entry.decision,
        tier: entry.tier,
        description: entry.actionDescription,
        reviewerModel: entry.reviewerModel,
      })));
    });

    // Fetch pending queue
    window.vibeflow.approval.getQueue().then((queue: ActionRequest[]) => {
      setPendingCount(queue.length);
    });

    // Listen for new pending approvals
    const handlePending = (data: { type: string; action: ActionRequest; tier?: number; result?: ApprovalResult }) => {
      if (data.type === 'human-required') {
        setPendingCount(prev => prev + 1);
      }
      if (data.type === 'auto-approved' && data.result) {
        setRecentApprovals(prev => [{
          decision: data.result!.decision,
          tier: data.result!.tier,
          description: data.action.description,
          reviewerModel: data.result!.reviewerModel,
        }, ...prev].slice(0, 10));
      }
    };

    window.vibeflow.approval.onPendingApproval(handlePending);

    return () => {
      window.vibeflow.approval.removePendingApprovalListener();
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 16px',
        backgroundColor: '#1a1a2e',
        color: '#ccc',
        fontSize: 12,
        borderTop: '1px solid #333',
      }}
    >
      <div style={{ display: 'flex', gap: 24 }}>
        <span>
          Mode: <strong style={{ color: '#fff' }}>{modeLabel}</strong>
        </span>
        <span>
          Model: <strong style={{ color: '#fff' }}>{modelLabel}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ApprovalQueue
          pendingCount={pendingCount}
          recentApprovals={recentApprovals}
          onPendingClick={onPendingApprovalClick ?? (() => {})}
        />
        <span style={{ color: connectionColor }}>{connectionLabel}</span>
      </div>
    </div>
  );
}
