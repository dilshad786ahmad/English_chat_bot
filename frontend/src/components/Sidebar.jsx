import React from 'react';
import { 
  Sparkles, 
  Plus, 
  MessageSquare, 
  Trash2, 
  X, 
  BookOpen, 
  Briefcase, 
  CheckCircle2, 
  Languages, 
  Settings2,
  Sun,
  Moon 
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onClose,
  sessionId,
  sessions,
  onSelectSession,
  onNewChat,
  onClearChat,
  onSelectPrompt,
  theme,
  onToggleTheme,
}) {
  const learningTopics = [
    {
      icon: <Languages size={16} />,
      label: 'Casual Chat',
      prompt: "Let's practice casual daily English conversation.",
    },
    {
      icon: <Briefcase size={16} />,
      label: 'Interview Practice',
      prompt: "I want to prepare for a job interview in English. Ask me common interview questions.",
    },
    {
      icon: <CheckCircle2 size={16} />,
      label: 'Grammar Checker',
      prompt: "Please correct my English sentence and explain the grammar rules.",
    },
    {
      icon: <BookOpen size={16} />,
      label: 'Vocabulary Builder',
      prompt: "Teach me 3 new useful English words with simple meanings and example sentences.",
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={onClose} 
          aria-hidden="true" 
        />
      )}

      <aside className={`gemini-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Top Header */}
        <div className="sidebar-header">
          <div 
            className="brand-logo clickable-logo" 
            onClick={onNewChat}
            title="DARK AI - Click to start a New Chat"
            role="button"
            tabIndex={0}
          >
            <div className="sparkle-icon-wrapper">
              <Sparkles size={20} className="sparkle-gradient-icon" />
            </div>
            <span className="brand-name">DARK AI</span>
          </div>

          <button 
            className="sidebar-close-btn" 
            onClick={onClose} 
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="sidebar-action-section">
          <button 
            className="new-chat-pill-btn" 
            onClick={onNewChat}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Quick Learning Modes */}
        <div className="sidebar-section">
          <div className="section-title">
            <Settings2 size={14} />
            <span>Learning Modes</span>
          </div>
          <div className="mode-chips">
            {learningTopics.map((topic, idx) => (
              <button
                key={idx}
                className="mode-chip-btn"
                onClick={() => onSelectPrompt(topic.prompt)}
              >
                {topic.icon}
                <span>{topic.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="sidebar-section sessions-section">
          <div className="section-title">
            <MessageSquare size={14} />
            <span>Recent Chats</span>
          </div>
          
          <div className="sessions-list">
            {sessions.length === 0 ? (
              <div className="empty-sessions">No recent chats</div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`session-item ${sess.id === sessionId ? 'active' : ''}`}
                  onClick={() => onSelectSession(sess.id)}
                >
                  <MessageSquare size={15} className="session-icon" />
                  <span className="session-title" title={sess.title}>
                    {sess.title}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="session-info">
            <span className="session-label">Session ID:</span>
            <span className="session-id-pill" title={sessionId}>
              {sessionId.slice(0, 14)}...
            </span>
          </div>

          <div className="sidebar-theme-row">
            <span className="sidebar-theme-label">Theme</span>
            <div className="theme-segmented-switch compact" role="group" aria-label="Theme mode switcher">
              <button
                type="button"
                className={`theme-segment ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onToggleTheme('dark')}
                title="Dark Mode"
              >
                <Moon size={13} />
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-segment ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onToggleTheme('light')}
                title="Light Mode"
              >
                <Sun size={13} />
                <span>Light</span>
              </button>
            </div>
          </div>

          <button 
            className="clear-chat-btn" 
            onClick={onClearChat} 
            title="Clear current chat"
          >
            <Trash2 size={15} />
            <span>Clear Current Chat</span>
          </button>
        </div>
      </aside>
    </>
  );
}
