/** ConversationScreen — 3-panel layout: execution stream, chat, editor placeholder. */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ConversationThread, Mode, StreamTokenData, RunState } from '../../lib/shared-types';

interface ConversationScreenProps {
  conversation: ConversationThread;
  currentMode: Mode | null;
  onNewConversation: () => void;
  onConversationUpdated?: (conv: ConversationThread) => void;
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

export default function ConversationScreen({ conversation, currentMode, onNewConversation, onConversationUpdated }: ConversationScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executionEvents, setExecutionEvents] = useState<string[]>(['Ready']);
  const [leaseInfo, setLeaseInfo] = useState<{ deviceId: string; deviceName: string; expiresAt: string } | null>(null);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const leaseCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
            <h3 style={{ margin: 0, fontSize: 16, color: '#c9d1d9' }}>{conversation.title}</h3>
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

      {/* Right Panel — Editor Placeholder */}
      <div style={{
        width: 350,
        backgroundColor: '#0d1117',
        borderLeft: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          textAlign: 'center',
          color: '#8b949e',
          fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div>Editor / File View</div>
          <div style={{ fontSize: 12, marginTop: 8, color: '#484f58' }}>
            Coming in Milestone 5
          </div>
        </div>
      </div>

      {/* Blink animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
