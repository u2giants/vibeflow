import { useState, useEffect } from 'react';
import type { Mode, ActionRequest, ApprovalResult, ConversationTokenUsage } from '../../lib/shared-types';
import ApprovalQueue from './ApprovalQueue';
import { C } from '../theme';
import { fmtTokens, getContextWindow } from '../../lib/providers/model-context-windows';

interface BottomBarProps {
  currentMode: Mode | null;
  openRouterConnected: boolean;
  onPendingApprovalClick?: () => void;
}

export default function BottomBar({ currentMode, openRouterConnected, onPendingApprovalClick }: BottomBarProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [recentApprovals, setRecentApprovals] = useState<Array<{
    decision: string; tier: number; description: string; reviewerModel: string | null;
  }>>([]);
  const [tokenUsage, setTokenUsage] = useState<ConversationTokenUsage | null>(null);

  useEffect(() => {
    window.vibeflow.approval.getLog().then(log =>
      setRecentApprovals(log.map((e: any) => ({
        decision: e.decision, tier: e.tier,
        description: e.actionDescription, reviewerModel: e.reviewerModel,
      })))
    );
    window.vibeflow.approval.getQueue().then((q: ActionRequest[]) => setPendingCount(q.length));

    const handle = (data: { type: string; action: ActionRequest; tier?: number; result?: ApprovalResult }) => {
      if (data.type === 'human-required') setPendingCount(p => p + 1);
      if (data.type === 'auto-approved' && data.result) {
        setRecentApprovals(prev => [{
          decision: data.result!.decision, tier: data.result!.tier,
          description: data.action.description, reviewerModel: data.result!.reviewerModel,
        }, ...prev].slice(0, 10));
      }
    };
    window.vibeflow.approval.onPendingApproval(handle);
    return () => { window.vibeflow.approval.removePendingApprovalListener(); };
  }, []);

  useEffect(() => {
    window.vibeflow.conversations.onTokenUsage((data) => setTokenUsage(data));
    return () => { window.vibeflow.conversations.onTokenUsage(() => {}); };
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 28,
      backgroundColor: C.bg0,
      borderTop: `1px solid ${C.border}`,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Left — mode info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {currentMode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: currentMode.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: C.text2 }}>
                <span style={{ color: C.text1, fontWeight: 500 }}>{currentMode.icon} {currentMode.name}</span>
              </span>
            </div>
            <span style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace' }}>
              {currentMode.modelId.split('/').pop()}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: C.text3 }}>No mode</span>
        )}
      </div>

      {/* Center — context window meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {tokenUsage && (() => {
          const limit = getContextWindow(tokenUsage.modelId);
          const pct = Math.min(tokenUsage.promptTokens / limit, 1);
          const barFill = Math.round(pct * 10);
          const bar = '▓'.repeat(barFill) + '░'.repeat(10 - barFill);
          const pctLabel = pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`;
          const color = pct > 0.85 ? C.red : pct > 0.6 ? C.yellow : C.text3;
          return (
            <span style={{ fontSize: 10, color, fontFamily: 'monospace', letterSpacing: '0.02em', userSelect: 'none' }}>
              ctx {fmtTokens(tokenUsage.promptTokens)}/{fmtTokens(limit)} {bar} {pctLabel}
            </span>
          );
        })()}
      </div>

      {/* Right — approval + connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ApprovalQueue
          pendingCount={pendingCount}
          recentApprovals={recentApprovals}
          onPendingClick={onPendingApprovalClick ?? (() => {})}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: openRouterConnected ? C.green : C.red,
          }} />
          <span style={{ fontSize: 11, color: C.text2 }}>OpenRouter</span>
        </div>
      </div>
    </div>
  );
}
