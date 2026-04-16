import { useState, useEffect } from 'react';
import type { Project, ConversationThread, Mode } from '../../lib/shared-types';
import ConversationScreen from './ConversationScreen';
import SshScreen from './SshScreen';
import DevOpsScreen from './DevOpsScreen';
import McpScreen from './McpScreen';
import TopBar from '../components/TopBar';
import BottomBar from '../components/BottomBar';
import { C, R } from '../theme';

interface ProjectScreenProps {
  project: Project;
  email: string;
  currentMode: Mode | null;
  onBack: () => void;
  onOpenModes: () => void;
  /** When true, skip rendering TopBar/BottomBar — parent shell provides them. */
  hideChrome?: boolean;
}

type SubScreen = null | 'ssh' | 'devops' | 'mcp';

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 10px', width: '100%',
        backgroundColor: active ? C.accentBg : hover ? C.bg3 : 'transparent',
        border: `1px solid ${active ? C.accentBg2 : 'transparent'}`,
        borderRadius: R.md, cursor: 'pointer',
        color: active ? C.accent : hover ? C.text2 : C.text3,
        fontSize: 12, fontFamily: 'inherit',
        textAlign: 'left', transition: 'all 0.12s',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function ProjectScreen({ project, email, currentMode, onBack, onOpenModes, hideChrome = false }: ProjectScreenProps) {
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationThread | null>(null);
  const [openRouterConnected, setOpenRouterConnected] = useState(false);
  const [sub, setSub] = useState<SubScreen>(null);

  const refreshOpenRouterStatus = async () => {
    const { hasKey } = await window.vibeflow.openrouter.getApiKey();
    if (hasKey) {
      const test = await window.vibeflow.openrouter.testConnection();
      setOpenRouterConnected(test.success);
    } else {
      setOpenRouterConnected(false);
    }
  };

  useEffect(() => { refreshOpenRouterStatus(); }, []);

  useEffect(() => {
    window.vibeflow.conversations.list(project.id).then(convs => {
      setConversations(convs);
      if (convs.length > 0 && !activeConv) setActiveConv(convs[0]);
    });
  }, [project.id]);

  const newConversation = async () => {
    const conv = await window.vibeflow.conversations.create({
      projectId: project.id,
      title: `Chat ${conversations.length + 1}`,
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setSub(null);
  };

  const hue = (project.name.charCodeAt(0) * 37 + project.name.charCodeAt(Math.min(1, project.name.length - 1)) * 13) % 360;
  const projColor = project.isSelfMaintenance ? C.yellow : `hsl(${hue},60%,65%)`;
  const projBg = project.isSelfMaintenance ? C.yellowBg : `hsla(${hue},60%,60%,0.12)`;
  const initials = project.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {!hideChrome && <TopBar email={email} />}

      {project.isSelfMaintenance && (
        <div style={{
          padding: '6px 16px', flexShrink: 0,
          backgroundColor: C.yellowBg, borderBottom: `1px solid ${C.yellowBd}`,
          color: C.yellow, fontSize: 12, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⚡</span> Self-Maintenance Mode — changes to VibeFlow source require approval
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 220, flexShrink: 0,
          backgroundColor: C.bg0,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Project header */}
          <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}` }}>
            <button onClick={onBack} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 8px', width: '100%',
              backgroundColor: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: R.md, cursor: 'pointer',
              color: C.text3, fontSize: 11, fontFamily: 'inherit', marginBottom: 10,
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              All projects
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: R.md,
                backgroundColor: projBg, color: projColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: project.isSelfMaintenance ? 14 : 11, fontWeight: 700, flexShrink: 0,
              }}>
                {project.isSelfMaintenance ? '⚡' : initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </div>
              </div>
            </div>

            {/* Sub-nav */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <NavButton icon="🔑" label="SSH" active={sub === 'ssh'} onClick={() => setSub(sub === 'ssh' ? null : 'ssh')} />
              <NavButton icon="⚙️" label="DevOps" active={sub === 'devops'} onClick={() => setSub(sub === 'devops' ? null : 'devops')} />
              <NavButton icon="🔌" label="MCP" active={sub === 'mcp'} onClick={() => setSub(sub === 'mcp' ? null : 'mcp')} />
              <NavButton icon="🎛" label="Modes" active={false} onClick={onOpenModes} />
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 6px', marginBottom: 2 }}>
              Conversations
            </div>
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => { setActiveConv(conv); setSub(null); }}
                style={{
                  padding: '7px 10px', borderRadius: R.md, cursor: 'pointer',
                  fontSize: 12, marginBottom: 1,
                  color: activeConv?.id === conv.id && !sub ? C.text1 : C.text3,
                  backgroundColor: activeConv?.id === conv.id && !sub ? C.bg4 : 'transparent',
                  fontWeight: activeConv?.id === conv.id && !sub ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'background-color 0.1s',
                }}
              >
                💬 {conv.title}
              </div>
            ))}
            {conversations.length === 0 && (
              <div style={{ padding: '8px 6px', color: C.text3, fontSize: 11 }}>
                No conversations yet
              </div>
            )}
          </div>

          {/* New conversation */}
          <div style={{ padding: 8, borderTop: `1px solid ${C.border}` }}>
            <button onClick={newConversation} style={{
              width: '100%', padding: '8px 10px',
              backgroundColor: C.accent, color: '#fff',
              border: 'none', borderRadius: R.md, cursor: 'pointer',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            }}>+ New Conversation</button>
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {sub === 'devops' ? (
            <DevOpsScreen projectId={project.id} onBack={() => setSub(null)} />
          ) : sub === 'mcp' ? (
            <McpScreen projectId={project.id} onBack={() => setSub(null)} />
          ) : sub === 'ssh' ? (
            <SshScreen onBack={() => setSub(null)} projectId={project.id} />
          ) : activeConv ? (
            <ConversationScreen
              conversation={activeConv}
              currentMode={currentMode}
              onNewConversation={newConversation}
              isSelfMaintenance={project.isSelfMaintenance}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bg1, color: C.text3, gap: 12,
            }}>
              <div style={{ fontSize: 40 }}>💬</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text2 }}>No conversation selected</div>
              <button onClick={newConversation} style={{
                padding: '8px 20px', backgroundColor: C.accent, color: '#fff',
                border: 'none', borderRadius: R.lg, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              }}>Start a conversation</button>
            </div>
          )}
        </div>
      </div>

      {!hideChrome && <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />}
    </div>
  );
}
