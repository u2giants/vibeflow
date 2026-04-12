/** ConversationScreen — 5-panel layout: execution stream, chat, editor/diff, terminal/git. */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ConversationThread, Mode, StreamTokenData, RunState, GitStatus, TerminalCommandResult, ActionRequest, ApprovalResult, HandoffResult } from '../../lib/shared-types';
import ApprovalCard from '../components/ApprovalCard';
import HandoffDialog from '../components/HandoffDialog';

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
  idle: '#8b949e',
  queued: '#007bff',
  running: '#28a745',
  waiting_for_second_model_review: '#ffc107',
  waiting_for_human_approval: '#fd7e14',
  waiting_for_user_input: '#17a2b8',
  paused: '#6c757d',
  failed: '#dc3545',
  completed: '#28a745',
  abandoned: '#6c757d',
  recoverable: '#ffc107',
};

export default function ConversationScreen({ conversation, currentMode, onNewConversation, onConversationUpdated, isSelfMaintenance }: ConversationScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executionEvents, setExecutionEvents] = useState<string[]>(['Ready']);
  const [leaseInfo, setLeaseInfo] = useState<{ deviceId: string; deviceName: string; expiresAt: string } | null>(null);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  // Editor panel state
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorDiff, setEditorDiff] = useState<string | null>(null);
  // Terminal/Git panel state
  const [bottomTab, setBottomTab] = useState<'terminal' | 'git'>('terminal');
  const [terminalOutput, setTerminalOutput] = useState<Array<{ commandId: string; text: string; stream: string }>>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  // Approval state
  const [pendingApproval, setPendingApproval] = useState<ActionRequest | null>(null);
  // Handoff state
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffGoal, setHandoffGoal] = useState('');
  const [handoffNextStep, setHandoffNextStep] = useState('');
  const [handoffWarnings, setHandoffWarnings] = useState('');
  const [handoffResult, setHandoffResult] = useState<HandoffResult | null>(null);
  const [handoffGenerating, setHandoffGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const leaseCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load messages on mount or conversation change
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
    // Load git status on mount — use a safe default path
    window.vibeflow.tooling.git.status('D:\\repos\\vibeflow').then((status) => {
      if (status.isRepo) setGitStatus(status);
    }).catch(() => {
      // Git status is non-critical — ignore errors
    });
  }, [conversation.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Set up streaming listeners
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
      // Reload messages to get the new assistant message
      window.vibeflow.conversations.getMessages(conversation.id).then((msgs) => {
        setMessages(msgs);
      });
      // Release lease when done
      window.vibeflow.sync.releaseLease(conversation.id).catch(() => {});
    };
    const handleError = (data: { conversationId: string; error: string }) => {
      if (data.conversationId === conversation.id) {
        setStreaming(false);
        setExecutionEvents(prev => [...prev, `Error: ${data.error}`]);
        // Release lease on error
        window.vibeflow.sync.releaseLease(conversation.id).catch(() => {});
      }
    };

    window.vibeflow.conversations.onStreamToken(handleToken);
    window.vibeflow.conversations.onStreamDone(handleDone);
    window.vibeflow.conversations.onStreamError(handleError);

    return () => {
      window.vibeflow.conversations.removeStreamListeners();
    };
  }, [conversation.id]);

  // Terminal output listeners
  useEffect(() => {
    const handleOutput = (data: { commandId: string; text: string; stream: string }) => {
      setTerminalOutput(prev => [...prev, data]);
    };
    const handleDone = (_data: { commandId: string; result: TerminalCommandResult }) => {
      setTerminalOutput(prev => [...prev, { commandId: _data.commandId, text: `\n[Command finished with exit code ${_data.result.exitCode}]`, stream: 'system' }]);
    };
    window.vibeflow.tooling.terminal.onOutput(handleOutput);
    window.vibeflow.tooling.terminal.onDone(handleDone);
    return () => {
      window.vibeflow.tooling.terminal.removeListeners();
    };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  // Check lease status periodically
  useEffect(() => {
    const checkLease = async () => {
      const lease = await window.vibeflow.sync.getLease(conversation.id);
      if (lease) {
        const isExpired = new Date(lease.expiresAt) < new Date();
        if (isExpired) {
          setLeaseInfo(null);
          // Update local conversation state to recoverable
          if (onConversationUpdated) {
            onConversationUpdated({
              ...conversation,
              runState: 'recoverable',
              ownerDeviceId: null,
              ownerDeviceName: null,
              leaseExpiresAt: null,
            });
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
      if (leaseCheckTimer.current) {
        clearInterval(leaseCheckTimer.current);
      }
    };
  }, [conversation.id, conversation, onConversationUpdated]);

  // Approval event listeners
  useEffect(() => {
    const handlePendingApproval = (data: { type: string; action: ActionRequest; tier?: number; result?: ApprovalResult }) => {
      if (data.type === 'human-required') {
        setPendingApproval(data.action);
        setExecutionEvents(prev => [...prev, `⏳ Waiting for human approval: ${data.action.description}`]);
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
    await window.vibeflow.approval.humanDecision({
      actionId: pendingApproval.id,
      decision: 'approved',
      note: null,
    });
    setExecutionEvents(prev => [...prev, `✅ Approved: ${pendingApproval.description}`]);
    setPendingApproval(null);
  };

  const handleReject = async () => {
    if (!pendingApproval) return;
    await window.vibeflow.approval.humanDecision({
      actionId: pendingApproval.id,
      decision: 'rejected',
      note: 'Rejected by user',
    });
    setExecutionEvents(prev => [...prev, `❌ Rejected: ${pendingApproval.description}`]);
    setPendingApproval(null);
  };

  const handleAskMore = () => {
    // For now, just dismiss — future milestone will add chat integration
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

    // Check if another device owns the run
    if (leaseInfo && leaseInfo.expiresAt && new Date(leaseInfo.expiresAt) > new Date()) {
      setLeaseError(`Active on ${leaseInfo.deviceName} — Read-only while this run is in progress`);
      return;
    }

    // If lease is stale (recoverable), take over
    if (leaseInfo && leaseInfo.expiresAt && new Date(leaseInfo.expiresAt) <= new Date()) {
      setIsTakingOver(true);
      const result = await window.vibeflow.sync.takeoverLease(conversation.id);
      setIsTakingOver(false);
      if (!result.success) {
        setLeaseError(result.error ?? 'Failed to take over');
        return;
      }
    } else if (!leaseInfo) {
      // No lease, acquire one
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
  const runStateColor = RUN_STATE_COLORS[runState] ?? '#8b949e';
  const runStateLabel = RUN_STATE_LABELS[runState] ?? 'Unknown';

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left Panel — Execution Stream */}
      <div style={{
        width: 250,
        backgroundColor: '#0d1117',
        borderRight: '1px solid #30363d',
        padding: 12,
        overflow: 'auto',
        fontSize: 13,
      }}>
        <h4 style={{ margin: '0 0 12px', color: '#8b949e', fontSize: 12, textTransform: 'uppercase' }}>
          Execution Stream
        </h4>
        {isSelfMaintenance && (
          <div style={{
            padding: '6px 8px',
            marginBottom: 8,
            backgroundColor: '#3d2e00',
            borderRadius: 4,
            color: '#ffc107',
            fontSize: 11,
            fontWeight: 500,
          }}>
            ⚠️ Changes to VibeFlow source files require your approval
          </div>
        )}
        {executionEvents.map((event, i) => (
          <div key={i} style={{
            padding: '4px 8px',
            marginBottom: 4,
            backgroundColor: event.startsWith('Error') ? '#3d1f28' : event === 'Ready' ? '#1a2332' : '#161b22',
            borderRadius: 4,
            color: event.startsWith('Error') ? '#f85149' : event === 'Ready' ? '#58a6ff' : '#c9d1d9',
            fontSize: 12,
          }}>
            {event === 'Orchestrator is thinking...' && (
              <span style={{ animation: 'blink 1s infinite' }}>⏳ </span>
            )}
            {event}
          </div>
        ))}
      </div>

      {/* Center Panel — Conversation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#161b22' }}>
        {/* Header */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#c9d1d9' }}>
              {isSelfMaintenance ? '🔧 Self-Maintenance' : conversation.title}
            </h3>
            {isSelfMaintenance && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 12,
                  backgroundColor: '#ffc10722',
                  color: '#ffc107',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                🔧 Self-Maintenance
              </span>
            )}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: runStateColor + '22',
                color: runStateColor,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {runStateLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowHandoffForm(true)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#6e40c9',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              📋 Handoff
            </button>
            <button
              onClick={onNewConversation}
              style={{
                padding: '4px 12px',
                backgroundColor: '#238636',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + New Conversation
            </button>
          </div>
        </div>

        {/* Ownership Banner */}
        {isReadOnly && leaseInfo && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#3d2e00',
            borderBottom: '1px solid #ffc107',
            color: '#ffc107',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🔒</span>
            <span>Active on <strong>{leaseInfo.deviceName}</strong> — Read-only while this run is in progress</span>
          </div>
        )}

        {/* Recoverable Banner */}
        {runState === 'recoverable' && !isReadOnly && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#2d2200',
            borderBottom: '1px solid #ffc107',
            color: '#ffc107',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>⚠️ Previous run lost connection — you can resume on this device</span>
            <button
              onClick={async () => {
                setIsTakingOver(true);
                const result = await window.vibeflow.sync.takeoverLease(conversation.id);
                setIsTakingOver(false);
                if (result.success && onConversationUpdated) {
                  onConversationUpdated({
                    ...conversation,
                    runState: 'running',
                  });
                }
              }}
              disabled={isTakingOver}
              style={{
                padding: '4px 12px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: isTakingOver ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {isTakingOver ? 'Taking over...' : 'Resume on this device'}
            </button>
          </div>
        )}

        {/* Lease Error */}
        {leaseError && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#3d1f28',
            borderBottom: '1px solid #f85149',
            color: '#f85149',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{leaseError}</span>
            <button
              onClick={() => setLeaseError(null)}
              style={{
                padding: '2px 8px',
                backgroundColor: 'transparent',
                color: '#f85149',
                border: '1px solid #f85149',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor: msg.role === 'user' ? '#238636' : '#30363d',
                color: '#c9d1d9',
                fontSize: 14,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'flex-start',
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor: '#30363d',
                color: '#c9d1d9',
                fontSize: 14,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}>
                {streamingContent}
                <span style={{ animation: 'blink 1s infinite' }}>▊</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: 12,
          borderTop: '1px solid #30363d',
          display: 'flex',
          gap: 8,
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isReadOnly ? 'Read-only — active on another device' : 'Type a message... (Enter to send)'}
            disabled={streaming || isReadOnly}
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: isReadOnly ? '#1a1a2e' : '#0d1117',
              color: isReadOnly ? '#555' : '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 8,
              resize: 'none',
              fontSize: 14,
              minHeight: 40,
              maxHeight: 120,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim() || isReadOnly}
            style={{
              padding: '8px 20px',
              backgroundColor: (streaming || !input.trim() || isReadOnly) ? '#30363d' : '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: (streaming || !input.trim() || isReadOnly) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              alignSelf: 'flex-end',
            }}
          >
            {streaming ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Right Panel — Editor / Diff View */}
      <div style={{
        width: 350,
        backgroundColor: '#0d1117',
        borderLeft: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {editorFilePath ? (
          <>
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid #30363d',
              fontSize: 12,
              color: '#58a6ff',
              fontFamily: 'monospace',
              backgroundColor: '#161b22',
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
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {editorDiff.split('\n').map((line, i) => {
                    const mutedColor = '#8b949e';
                    if (line.startsWith('+')) return <div key={i} style={{ color: '#3fb950', backgroundColor: '#1a3a2a' }}>{line}</div>;
                    if (line.startsWith('-')) return <div key={i} style={{ color: '#f85149', backgroundColor: '#3d1f28' }}>{line}</div>;
                    if (line.startsWith('@@')) return <div key={i} style={{ color: '#d2a8ff', fontWeight: 600 }}>{line}</div>;
                    if (line.startsWith('---') || line.startsWith('+++')) return <div key={i} style={{ color: mutedColor, fontStyle: 'italic' }}>{line}</div>;
                    return <div key={i} style={{ color: mutedColor }}>{line}</div>;
                  })}
                </pre>
              ) : (
                <pre style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: 'Consolas, Monaco, monospace',
                  lineHeight: 1.4,
                  color: '#c9d1d9',
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
            <div style={{ textAlign: 'center', color: '#8b949e', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
              <div>Editor / File View</div>
              <div style={{ fontSize: 12, marginTop: 8, color: '#484f58' }}>
                No file open
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel — Terminal / Git */}
      <div style={{
        height: 180,
        backgroundColor: '#0d1117',
        borderTop: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #30363d' }}>
          {(['terminal', 'git'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setBottomTab(tab)}
              style={{
                padding: '4px 16px',
                backgroundColor: bottomTab === tab ? '#161b22' : 'transparent',
                color: bottomTab === tab ? '#c9d1d9' : '#8b949e',
                border: 'none',
                borderBottom: bottomTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {tab === 'terminal' ? '⌨️ Terminal' : '🔀 Git'}
            </button>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8, fontFamily: 'Consolas, Monaco, monospace', fontSize: 12 }}>
          {bottomTab === 'terminal' ? (
            <>
              {terminalOutput.length === 0 ? (
                <div style={{ color: '#484f58' }}>No terminal output yet</div>
              ) : (
                terminalOutput.map((line, i) => (
                  <div key={i} style={{
                    color: line.stream === 'stderr' ? '#f85149' : line.stream === 'system' ? '#d2a8ff' : '#c9d1d9',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
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
                <div style={{ color: '#58a6ff', marginBottom: 8 }}>
                  Branch: <strong>{gitStatus.branch}</strong>
                </div>
                {gitStatus.staged.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#3fb950' }}>Staged ({gitStatus.staged.length}):</span>
                    {gitStatus.staged.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: '#c9d1d9' }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.unstaged.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#d29922' }}>Modified ({gitStatus.unstaged.length}):</span>
                    {gitStatus.unstaged.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: '#c9d1d9' }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.untracked.length > 0 && (
                  <div>
                    <span style={{ color: '#8b949e' }}>Untracked ({gitStatus.untracked.length}):</span>
                    {gitStatus.untracked.map((f, i) => <div key={i} style={{ paddingLeft: 12, color: '#c9d1d9' }}>{f}</div>)}
                  </div>
                )}
                {gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0 && gitStatus.untracked.length === 0 && (
                  <div style={{ color: '#3fb950' }}>✓ Working tree clean</div>
                )}
              </div>
            ) : (
              <div style={{ color: '#484f58' }}>Not a git repository</div>
            )
          )}
        </div>
      </div>

      {/* Blink animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
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
            width: '60%',
            maxWidth: 500,
            padding: 24,
          }}>
            <h3 style={{ margin: '0 0 16px', color: '#c9d1d9' }}>📋 Generate Handoff</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: '#8b949e', fontSize: 13, marginBottom: 4 }}>
                What are you trying to do right now?
              </label>
              <textarea
                value={handoffGoal}
                onChange={(e) => setHandoffGoal(e.target.value)}
                placeholder="e.g. Implementing the handoff system for Milestone 8"
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 8,
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: '#8b949e', fontSize: 13, marginBottom: 4 }}>
                What should the next AI session do?
              </label>
              <textarea
                value={handoffNextStep}
                onChange={(e) => setHandoffNextStep(e.target.value)}
                placeholder="e.g. Test the handoff button and fix any bugs"
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 8,
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#8b949e', fontSize: 13, marginBottom: 4 }}>
                Any warnings? (optional)
              </label>
              <textarea
                value={handoffWarnings}
                onChange={(e) => setHandoffWarnings(e.target.value)}
                placeholder="e.g. Don't touch the approval engine without reviewing first"
                style={{
                  width: '100%',
                  minHeight: 40,
                  padding: 8,
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHandoffForm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#30363d',
                  color: '#c9d1d9',
                  border: 'none',
                  borderRadius: 6,
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
                  padding: '8px 16px',
                  backgroundColor: '#6e40c9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: handoffGenerating || !handoffGoal.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
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
