/** ConversationScreen — 3-panel layout: execution stream, chat, editor placeholder. */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ConversationThread, Mode, StreamTokenData } from '../../lib/shared-types';

interface ConversationScreenProps {
  conversation: ConversationThread;
  currentMode: Mode | null;
  onNewConversation: () => void;
}

export default function ConversationScreen({ conversation, currentMode, onNewConversation }: ConversationScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executionEvents, setExecutionEvents] = useState<string[]>(['Ready']);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages on mount or conversation change
  useEffect(() => {
    setMessages([]);
    setStreamingContent('');
    setStreaming(false);
    setExecutionEvents(['Ready']);
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
    };
    const handleError = (data: { conversationId: string; error: string }) => {
      if (data.conversationId === conversation.id) {
        setStreaming(false);
        setExecutionEvents(prev => [...prev, `Error: ${data.error}`]);
      }
    };

    window.vibeflow.conversations.onStreamToken(handleToken);
    window.vibeflow.conversations.onStreamDone(handleDone);
    window.vibeflow.conversations.onStreamError(handleError);

    return () => {
      window.vibeflow.conversations.removeStreamListeners();
    };
  }, [conversation.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;

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
    }
  }, [input, streaming, conversation.id, currentMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
          <h3 style={{ margin: 0, fontSize: 16, color: '#c9d1d9' }}>{conversation.title}</h3>
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
            placeholder="Type a message... (Enter to send)"
            disabled={streaming}
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
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
            disabled={streaming || !input.trim()}
            style={{
              padding: '8px 20px',
              backgroundColor: streaming ? '#30363d' : '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: streaming ? 'not-allowed' : 'pointer',
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
