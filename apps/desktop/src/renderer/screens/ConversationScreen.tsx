/** ConversationScreen — 5-panel layout: execution stream, chat, editor/diff, terminal/git. */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ConversationThread, Mode, StreamTokenData, RunState, GitStatus, TerminalCommandResult, ActionRequest, ApprovalResult, HandoffResult } from '../../lib/shared-types';
import ApprovalCard from '../components/ApprovalCard';
import HandoffDialog from '../components/HandoffDialog';
import { C, R } from '../theme';

interface ConversationScreenProps {
  conversation: ConversationThread;
  currentMode: Mode | null;
  onNewConversation: () => void;
  onConversationUpdated?: (conv: ConversationThread) => void;
  isSelfMaintenance?: boolean;
}

const RUN_STATE_LABELS: Record<RunState, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting_for_second_model_review: 'Waiting for review',
  waiting_for_human_approval: 'Waiting for approval',
  waiting_for_user_input: 'Waiting for input',
  paused: 'Paused',
  failed: 'Failed',
  completed: 'Completed',
  abandoned: 'Abandoned',
  recoverable: 'Recoverable',
};

const RUN_STATE_COLORS: Record<RunState, string> = {
  idle: C.text3,
  queued: C.blue,
  running: C.green,
  waiting_for_second_model_review: C.yellow,
  waiting_for_human_approval: C.yellow,
  waiting_for_user_input: C.teal,
  paused: C.text3,
  failed: C.red,
  completed: C.green,
  abandoned: C.text3,
  recoverable: C.yellow,
};

// Event type color helper
function eventColor(event: string): string {
  if (event.startsWith('[error]') || event.startsWith('Error')) return C.red;
  if (event.startsWith('[delegation]')) return C.accent;
  if (event.startsWith('[specialist]')) return C.green;
  if (event.startsWith('[info]')) return C.blue;
  if (event === 'Ready') return C.teal;
  if (event.includes('thinking') || event.includes('Orchestrator')) return C.yellow;
  return C.text2;
}

function eventBg(event: string): string {
  if (event.startsWith('[error]') || event.startsWith('Error')) return C.redBg;
  if (event.startsWith('[delegation]')) return C.accentBg;
  if (event.startsWith('[specialist]')) return C.greenBg;
  if (event.startsWith('[info]')) return C.blueBg;
  if (event === 'Ready') return C.tealBg;
  return C.bg2;
}

export default function ConversationScreen({ conversation, currentMode, onNewConversation, onConversationUpdated, isSelfMaintenance }: ConversationScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executionEvents, setExecutionEvents] = useState<string[]>(['Ready']);
  const [leaseInfo, setLeaseInfo] = useState<{ deviceId: string; deviceName: string; expiresAt: string } | null>(null);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorDiff, setEditorDiff] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'git'>('terminal');
  const [terminalOutput, setTerminalOutput] = useState<Array<{ commandId: string; text: string; stream: string }>>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ActionRequest | null>(null);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffGoal, setHandoffGoal] = useState('');
  const [handoffNextStep, setHandoffNextStep] = useState('');
  const [handoffWarnings, setHandoffWarnings] = useState('');
  const [handoffResult, setHandoffResult] = useState<HandoffResult | null>(null);
  const [handoffGenerating, setHandoffGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const leaseCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setStreamingContent('');
    setStreaming(false);
    setExecutionEvents(['Ready']);
    setLeaseInfo(null);
    setLeaseError(null);
    setIsTakingOver(false);
    window.vibeflow.conversations.getMessages(conversation.id).then((msgs) => {
      setMessages(msgs);
    });
    window.vibeflow.tooling.git.status('D:\\repos\\vibeflow').then((status) => {
      if (status.isRepo) setGitStatus(status);
    }).catch(() => {});
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    const handleToken = (data: StreamTokenData) => {
      if (data.conversationId === conversation.id) {
        setStreamingContent(prev => prev + data.token);
      }
    };
    const handleDone = () => {
      setStreaming(false);
      setStreamingContent('');
      setExecutionEvents(prev => [...prev, 'Done']);
      window.vibeflow.conversations.getMessages(conversation.id).then((msgs) => {
        setMessages(msgs);
      });
      window.vibeflow.sync.releaseLease(conversation.id).catch(() => {});
    };
    const handleError = (data: { conversationId: string; error: string }) => {
      if (data.conversationId === conversation.id) {
        setStreaming(false);
        setExecutionEvents(prev => [...prev, `Error: ${data.error}`]);
        window.vibeflow.sync.releaseLease(conversation.id).catch(() => {});
      }
    };
    const handleExecutionEvent = (data: { conversationId: string; text: string; type: string }) => {
      if (data.conversationId !== conversation.id) return;
      setExecutionEvents(prev => [...prev, `[${data.type}] ${data.text}`]);
    };
    window.vibeflow.conversations.onStreamToken(handleToken);
    window.vibeflow.conversations.onStreamDone(handleDone);
    window.vibeflow.conversations.onStreamError(handleError);
    window.vibeflow.conversations.onExecutionEvent(handleExecutionEvent);
    return () => {
      window.vibeflow.conversations.removeStreamListeners();
    };
  }, [conversation.id]);

  useEffect(() => {
    const handleOutput = (data: { commandId: string; text: string; stream: string }) => {
      setTerminalOutput(prev => [...prev, data]);
    };
    const handleDone = (_data: { commandId: string; result: TerminalCommandResult }) => {
      setTerminalOutput(prev => [...prev, { commandId: _data.commandId, text: `\n[exit ${_data.result.exitCode}]`, stream: 'system' }]);
    };
    window.vibeflow.tooling.terminal.onOutput(handleOutput);
    window.vibeflow.tooling.terminal.onDone(handleDone);
    return () => {
      window.vibeflow.tooling.terminal.removeListeners();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  useEffect(() => {
    const checkLease = async () => {
      const lease = await window.vibeflow.sync.getLease(conversation.id);
      if (lease) {
        const isExpired = new Date(lease.expiresAt) < new Date();
        if (isExpired) {
          setLeaseInfo(null);
          if (onConversationUpdated) {
            onConversationUpdated({ ...conversation, runState: 'recoverable', ownerDeviceId: null, ownerDeviceName: null, leaseExpiresAt: null });
          }
        } else {
          setLeaseInfo(lease);
        }
      } else {
        setLeaseInfo(null);
      }
    };
    checkLease();
    leaseCheckTimer.current = setInterval(checkLease, 5000);
    return () => {
      if (leaseCheckTimer.current) clearInterval(leaseCheckTimer.current);
    };
  }, [conversation.id, conversation, onConversationUpdated]);

  useEffect(() => {
    const handlePendingApproval = (data: { type: string; action: ActionRequest; tier?: number; result?: ApprovalResult }) => {
      if (data.type === 'human-required') {
        setPendingApproval(data.action);
        setExecutionEvents(prev => [...prev, `⏳ Waiting for approval: ${data.action.description}`]);
      }
      if (data.type === 'auto-approved' && data.result) {
        const result = data.result;
        setExecutionEvents(prev => [...prev, `✅ Auto-approved (Tier ${result.tier}): ${data.action.description}`]);
      }
    };
    window.vibeflow.approval.onPendingApproval(handlePendingApproval);
    return () => {
      window.vibeflow.approval.removePendingApprovalListener();
    };
  }, []);

  const handleApprove = async () => {
    if (!pendingApproval) return;
    await window.vibeflow.approval.humanDecision({ actionId: pendingApproval.id, decision: 'approved', note: null });
    setExecutionEvents(prev => [...prev, `✅ Approved: ${pendingApproval.description}`]);
    setPendingApproval(null);
  };

  const handleReject = async () => {
    if (!pendingApproval) return;
    await window.vibeflow.approval.humanDecision({ actionId: pendingApproval.id, decision: 'rejected', note: 'Rejected by user' });
    setExecutionEvents(prev => [...prev, `❌ Rejected: ${pendingApproval.description}`]);
    setPendingApproval(null);
  };

  const handleAskMore = () => {
    setPendingApproval(null);
  };

  const handleHandoffSubmit = async () => {
    if (!handoffGoal.trim()) return;
    setHandoffGenerating(true);
    try {
      const result = await window.vibeflow.handoff.generate({
        conversationId: conversation.id,
        projectId: conversation.projectId,
        projectName: conversation.title,
        currentGoal: handoffGoal,
        nextStep: handoffNextStep || 'Continue from where we left off',
        warnings: handoffWarnings ? [handoffWarnings] : [],
        pendingBugs: [],
        isSelfMaintenance,
      });
      setHandoffResult(result);
      setShowHandoffForm(false);
    } catch (err) {
      console.error('Handoff generation failed:', err);
    } finally {
      setHandoffGenerating(false);
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;
    if (leaseInfo && leaseInfo.expiresAt && new Date(leaseInfo.expiresAt) > new Date()) {
      setLeaseError(`Active on ${leaseInfo.deviceName} — Read-only while this run is in progress`);
      return;
    }
    if (leaseInfo && leaseInfo.expiresAt && new Date(leaseInfo.expiresAt) <= new Date()) {
      setIsTakingOver(true);
      const result = await window.vibeflow.sync.takeoverLease(conversation.id);
      setIsTakingOver(false);
      if (!result.success) {
        setLeaseError(result.error ?? 'Failed to take over');
        return;
      }
    } else if (!leaseInfo) {
      const result = await window.vibeflow.sync.acquireLease(conversation.id);
      if (!result.success) {
        setLeaseError(result.error ?? 'Failed to acquire lease');
        return;
      }
    }
    setLeaseError(null);
    const userContent = input.trim();
    setInput('');
    setStreaming(true);
    setStreamingContent('');
    setExecutionEvents(prev => [...prev, 'Orchestrator is thinking...']);
    try {
      await window.vibeflow.conversations.sendMessage({
        conversationId: conversation.id,
        content: userContent,
        modeId: currentMode?.id ?? 'orchestrator',
      });
    } catch (err) {
      setStreaming(false);
      setExecutionEvents(prev => [...prev, `Error: ${String(err)}`]);
      window.vibeflow.sync.releaseLease(conversation.id).catch(() => {});
    }
  }, [input, streaming, conversation.id, currentMode, leaseInfo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isReadOnly = !!leaseInfo && new Date(leaseInfo.expiresAt) > new Date();
  const runState = conversation.runState ?? 'idle';
  const runStateColor = RUN_STATE_COLORS[runState] ?? C.text3;
  const runStateLabel = RUN_STATE_LABELS[runState] ?? 'Unknown';

  const modeColor = currentMode?.color ?? C.accent;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: C.bg0, flexDirection: 'column' }}>
      {/* Main 3-column row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left Panel — Execution Stream (200px) */}
        <div style={{
          width: 200,
          minWidth: 200,
          backgroundColor: C.bg1,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            color: C.text3,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            Execution Stream
          </div>
          {isSelfMaintenance && (
            <div style={{
              padding: '6px 10px',
              margin: '8px 8px 0',
              backgroundColor: C.yellowBg,
              borderRadius: R.md,
              color: C.yellow,
              fontSize: 11,
              border: `1px solid ${C.yellowBd}`,
              lineHeight: 1.4,
              flexShrink: 0,
            }}>
              ⚠️ Source changes require approval
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {executionEvents.map((event, i) => (
              <div key={i} style={{
                padding: '4px 8px',
                marginBottom: 4,
                backgroundColor: eventBg(event),
                borderRadius: R.sm,
                color: eventColor(event),
                fontSize: 11,
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}>
                {event === 'Orchestrator is thinking...' && (
                  <span style={{ animation: 'blink 1s infinite', marginRight: 4 }}>⏳</span>
                )}
                {event}
              </div>
            ))}
          </div>
        </div>

        {/* Center Panel — Chat (flex-1) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', backgroundColor: C.bg0 }}>
          {/* Chat Header */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: C.bg1,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {currentMode && (
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: R.full,
                  backgroundColor: modeColor,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${modeColor}88`,
                }} />
              )}
              <h3 style={{ margin: 0, fontSize: 14, color: C.text1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isSelfMaintenance ? 'Self-Maintenance' : conversation.title}
              </h3>
              {isSelfMaintenance && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: R.full,
                  backgroundColor: C.yellowBg,
                  color: C.yellow,
                  fontSize: 10,
                  fontWeight: 700,
                  border: `1px solid ${C.yellowBd}`,
                  flexShrink: 0,
                }}>
                  SELF-MAINT
                </span>
              )}
              <span style={{
                padding: '2px 8px',
                borderRadius: R.full,
                backgroundColor: runStateColor + '1a',
                color: runStateColor,
                fontSize: 10,
                fontWeight: 700,
                border: `1px solid ${runStateColor}33`,
                flexShrink: 0,
              }}>
                {runStateLabel}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setShowHandoffForm(true)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: C.accentBg,
                  color: C.accent,
                  border: `1px solid ${C.accent}44`,
                  borderRadius: R.md,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Handoff
              </button>
              <button
                onClick={onNewConversation}
                style={{
                  padding: '4px 12px',
                  backgroundColor: C.greenBg,
                  color: C.green,
                  border: `1px solid ${C.greenBd}`,
                  borderRadius: R.md,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Read-only / Lease banners */}
          {isReadOnly && leaseInfo && (
            <div style={{
              padding: '7px 14px',
              backgroundColor: C.yellowBg,
              borderBottom: `1px solid ${C.yellowBd}`,
              color: C.yellow,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <span>🔒</span>
              <span>Active on <strong>{leaseInfo.deviceName}</strong> — read-only</span>
            </div>
          )}
          {runState === 'recoverable' && !isReadOnly && (
            <div style={{
              padding: '7px 14px',
              backgroundColor: C.yellowBg,
              borderBottom: `1px solid ${C.yellowBd}`,
              color: C.yellow,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span>⚠️ Previous run lost connection — resume here</span>
              <button
                onClick={async () => {
                  setIsTakingOver(true);
                  const result = await window.vibeflow.sync.takeoverLease(conversation.id);
                  setIsTakingOver(false);
                  if (result.success && onConversationUpdated) {
                    onConversationUpdated({ ...conversation, runState: 'running' });
                  }
                }}
                disabled={isTakingOver}
                style={{
                  padding: '3px 10px',
                  backgroundColor: C.yellow,
                  color: '#000',
                  border: 'none',
                  borderRadius: R.md,
                  cursor: isTakingOver ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {isTakingOver ? 'Taking over...' : 'Resume here'}
              </button>
            </div>
          )}
          {leaseError && (
            <div style={{
              padding: '7px 14px',
              backgroundColor: C.redBg,
              borderBottom: `1px solid ${C.redBd}`,
              color: C.red,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span>{leaseError}</span>
              <button
                onClick={() => setLeaseError(null)}
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'transparent',
                  color: C.red,
                  border: `1px solid ${C.redBd}`,
                  borderRadius: R.md,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 8,
              }}>
                {msg.role !== 'user' && (
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: R.full,
                    backgroundColor: modeColor,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    marginBottom: 2,
                  }}>
                    {currentMode?.icon ?? '🤖'}
                  </div>
                )}
                <div style={{
                  maxWidth: '72%',
                  padding: '9px 13px',
                  borderRadius: msg.role === 'user' ? `${R.xl}px ${R.xl}px ${R.sm}px ${R.xl}px` : `${R.xl}px ${R.xl}px ${R.xl}px ${R.sm}px`,
                  backgroundColor: msg.role === 'user' ? C.accent : C.bg3,
                  color: msg.role === 'user' ? '#fff' : C.text1,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming bubble */}
            {streamingContent && (
              <div style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                gap: 8,
              }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: R.full,
                  backgroundColor: modeColor,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  marginBottom: 2,
                }}>
                  {currentMode?.icon ?? '🤖'}
                </div>
                <div style={{
                  maxWidth: '72%',
                  padding: '9px 13px',
                  borderRadius: `${R.xl}px ${R.xl}px ${R.xl}px ${R.sm}px`,
                  backgroundColor: C.bg3,
                  color: C.text1,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  border: `1px solid ${C.border}`,
                }}>
                  {streamingContent}
                  <span style={{ animation: 'blink 1s infinite', color: C.accent, fontWeight: 700 }}>▊</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${C.border}`,
            backgroundColor: C.bg1,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isReadOnly ? 'Read-only — active on another device' : 'Message... (Enter to send, Shift+Enter for newline)'}
                disabled={streaming || isReadOnly}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  backgroundColor: isReadOnly ? C.bg2 : C.bg5,
                  color: isReadOnly ? C.text3 : C.text1,
                  border: `1px solid ${C.border2}`,
                  borderRadius: R.lg,
                  resize: 'none',
                  fontSize: 13,
                  minHeight: 42,
                  maxHeight: 120,
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim() || isReadOnly}
                style={{
                  padding: '9px 18px',
                  backgroundColor: (streaming || !input.trim() || isReadOnly) ? C.bg4 : C.accent,
                  color: (streaming || !input.trim() || isReadOnly) ? C.text3 : '#fff',
                  border: 'none',
                  borderRadius: R.lg,
                  cursor: (streaming || !input.trim() || isReadOnly) ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  alignSelf: 'flex-end',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
              >
                {streaming ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel — Editor / Diff (300px) */}
        <div style={{
          width: 300,
          minWidth: 300,
          backgroundColor: C.bg1,
          borderLeft: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {editorFilePath ? (
            <>
              <div style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                color: C.blue,
                fontFamily: 'monospace',
                backgroundColor: C.bg2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {editorFilePath}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                {editorDiff ? (
                  <pre style={{
                    margin: 0,
                    fontSize: 11,
                    fontFamily: 'Consolas, Monaco, monospace',
                    lineHeight: 1.4,
                    color: C.text2,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {editorDiff.split('\n').map((line, i) => {
                      if (line.startsWith('+')) return <div key={i} style={{ color: C.green, backgroundColor: C.greenBg }}>{line}</div>;
                      if (line.startsWith('-')) return <div key={i} style={{ color: C.red, backgroundColor: C.redBg }}>{line}</div>;
                      if (line.startsWith('@@')) return <div key={i} style={{ color: C.accent, fontWeight: 600 }}>{line}</div>;
                      if (line.startsWith('---') || line.startsWith('+++')) return <div key={i} style={{ color: C.text3, fontStyle: 'italic' }}>{line}</div>;
                      return <div key={i} style={{ color: C.text3 }}>{line}</div>;
                    })}
                  </pre>
                ) : (
                  <pre style={{
                    margin: 0,
                    fontSize: 11,
                    fontFamily: 'Consolas, Monaco, monospace',
                    lineHeight: 1.4,
                    color: C.text2,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {editorContent}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}>
              <div style={{ textAlign: 'center', color: C.text3 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📝</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Editor / File View</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>No file open</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel — Terminal / Git (160px) */}
      <div style={{
        height: 160,
        backgroundColor: C.bg1,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {(['terminal', 'git'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setBottomTab(tab)}
              style={{
                padding: '5px 16px',
                backgroundColor: bottomTab === tab ? C.bg2 : 'transparent',
                color: bottomTab === tab ? C.text1 : C.text3,
                border: 'none',
                borderBottom: bottomTab === tab ? `2px solid ${C.accent}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: bottomTab === tab ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {tab === 'terminal' ? 'Terminal' : 'Git'}
            </button>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8, fontFamily: 'Consolas, Monaco, monospace', fontSize: 11 }}>
          {bottomTab === 'terminal' ? (
            <>
              {terminalOutput.length === 0 ? (
                <div style={{ color: C.text3 }}>No terminal output yet</div>
              ) : (
                terminalOutput.map((line, i) => (
                  <div key={i} style={{
                    color: line.stream === 'stderr' ? C.red : line.stream === 'system' ? C.accent : C.text2,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: 1.4,
                  }}>
                    {line.text}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </>
          ) : (
            gitStatus ? (
              <div>
                <div style={{ color: C.blue, marginBottom: 6 }}>
                  Branch: <strong>{gitStatus.branch}</strong>
                </div>
                {gitStatus.staged.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: C.green }}>Staged ({gitStatus.staged.length}):</span>
                    {gitStatus.staged.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: C.text2 }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.unstaged.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: C.yellow }}>Modified ({gitStatus.unstaged.length}):</span>
                    {gitStatus.unstaged.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: C.text2 }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.untracked.length > 0 && (
                  <div>
                    <span style={{ color: C.text3 }}>Untracked ({gitStatus.untracked.length}):</span>
                    {gitStatus.untracked.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: C.text2 }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0 && gitStatus.untracked.length === 0 && (
                  <div style={{ color: C.green }}>✓ Working tree clean</div>
                )}
              </div>
            ) : (
              <div style={{ color: C.text3 }}>Not a git repository</div>
            )
          )}
        </div>
      </div>

      {/* Blink animation */}
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Approval Card Overlay */}
      {pendingApproval && (
        <ApprovalCard
          action={pendingApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onAskMore={handleAskMore}
        />
      )}

      {/* Handoff Form */}
      {showHandoffForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: C.bg2,
            border: `1px solid ${C.border2}`,
            borderRadius: R['2xl'],
            width: '56%',
            maxWidth: 520,
            padding: 24,
          }}>
            <h3 style={{ margin: '0 0 18px', color: C.text1, fontSize: 16 }}>Generate Handoff</h3>
            {[
              { label: 'What are you trying to do right now?', value: handoffGoal, onChange: setHandoffGoal, placeholder: 'e.g. Implementing the handoff system for Milestone 8', minH: 60 },
              { label: 'What should the next AI session do?', value: handoffNextStep, onChange: setHandoffNextStep, placeholder: 'e.g. Test the handoff button and fix any bugs', minH: 60 },
              { label: 'Any warnings? (optional)', value: handoffWarnings, onChange: setHandoffWarnings, placeholder: "e.g. Don't touch the approval engine without reviewing first", minH: 40 },
            ].map(({ label, value, onChange, placeholder, minH }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: C.text3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {label}
                </label>
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    minHeight: minH,
                    padding: '8px 10px',
                    backgroundColor: C.bg5,
                    color: C.text1,
                    border: `1px solid ${C.border2}`,
                    borderRadius: R.md,
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHandoffForm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: C.bg4,
                  color: C.text2,
                  border: `1px solid ${C.border2}`,
                  borderRadius: R.md,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleHandoffSubmit}
                disabled={handoffGenerating || !handoffGoal.trim()}
                style={{
                  padding: '8px 18px',
                  backgroundColor: (handoffGenerating || !handoffGoal.trim()) ? C.bg4 : C.accent,
                  color: (handoffGenerating || !handoffGoal.trim()) ? C.text3 : '#fff',
                  border: 'none',
                  borderRadius: R.md,
                  cursor: (handoffGenerating || !handoffGoal.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
              >
                {handoffGenerating ? 'Generating...' : 'Generate Handoff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handoff Result Dialog */}
      {handoffResult && (
        <HandoffDialog
          result={handoffResult}
          onClose={() => setHandoffResult(null)}
        />
      )}
    </div>
  );
}
