import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Menu, 
  Plus, 
  RefreshCw, 
  AlertCircle,
  LogOut,
  User
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import HeroGreeting from './components/HeroGreeting';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import AuthModal from './components/AuthModal';
import { sendChatMessage, fetchChatHistory, clearChatHistory } from './services/api';
import { useAuth } from './context/AuthContext';
import './App.css';

// Helper to generate unique session IDs
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export default function App() {
  const { user, isLoggedIn, loading, logout } = useAuth();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dark_ai_theme') || 'dark';
  });

  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('english_ai_session_id') || generateSessionId();
  });

  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('english_ai_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);

  // User dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timeoutId = window.setTimeout(() => setToastMessage(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  // Sync theme with document and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dark_ai_theme', theme);
  }, [theme]);

  const handleToggleTheme = (targetTheme) => {
    if (typeof targetTheme === 'string') {
      setTheme(targetTheme);
    } else {
      setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }
  };

  // Sync active sessionId to localStorage
  useEffect(() => {
    localStorage.setItem('english_ai_session_id', sessionId);
  }, [sessionId]);

  // Sync sessions list to localStorage
  useEffect(() => {
    localStorage.setItem('english_ai_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load chat history from MongoDB when sessionId changes (only if logged in)
  useEffect(() => {
    if (!isLoggedIn) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setErrorMessage(null);

      try {
        const historyData = await fetchChatHistory(sessionId);
        if (isMounted) {
          if (Array.isArray(historyData) && historyData.length > 0) {
            setMessages(
              historyData.map((msg, index) => ({
                id: msg._id || `hist_${index}`,
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
              }))
            );
          } else {
            setMessages([]);
          }
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [sessionId, isLoggedIn]);

  // Auto-scroll to bottom whenever messages or loading state change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle sending a new message
  const handleSendMessage = async (prompt) => {
    if (!prompt.trim() || isLoading) return;

    setErrorMessage(null);
    setSelectedPrompt('');

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Save or update session in recent list
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === sessionId);
      const title = prompt.length > 30 ? `${prompt.substring(0, 30)}...` : prompt;
      if (!exists) {
        return [{ id: sessionId, title, date: new Date().toISOString() }, ...prev];
      }
      return prev;
    });

    const aiMessageId = `ai_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      await sendChatMessage(prompt, sessionId, (token) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === aiMessageId
              ? { ...message, content: message.content + token }
              : message
          )
        );
      });
    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage(err.message || 'Something went wrong while connecting to the backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start a fresh chat session
  const handleNewChat = () => {
    const newId = generateSessionId();
    setSessionId(newId);
    setMessages([]);
    setErrorMessage(null);
    setSelectedPrompt('');
    setSidebarOpen(false);
  };

  // Switch to an existing session
  const handleSelectSession = (id) => {
    if (!isLoggedIn && id !== sessionId) {
      setToastMessage('Please sign in to view your previous chat history.');
      return;
    }

    if (id !== sessionId) {
      setSessionId(id);
      setErrorMessage(null);
      setSelectedPrompt('');
      setSidebarOpen(false);
    }
  };

  // Clear current session
  const handleClearChat = async () => {
    if (!window.confirm('Are you sure you want to clear this conversation?')) return;

    if (!isLoggedIn) {
      setMessages([]);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setErrorMessage(null);
      return;
    }

    try {
      await clearChatHistory(sessionId);
      setMessages([]);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        setErrorMessage('Your saved chat could not be cleared because your login session has expired.');
        return;
      }
      setErrorMessage(
        'Failed to clear chat history: ' +
          (err.response?.data?.message || err.message)
      );
    }
  };

  // Select a preset prompt
  const handleSelectPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setSidebarOpen(false);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setMessages([]);
  };

  const handleLogout = () => {
    logout();
    setShowAuthModal(false);
    setMessages([]);
    setShowUserMenu(false);
  };

  // Don't render anything during initial auth check
  if (loading) {
    return (
      <div className="gemini-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-loading-splash">
          <div className="sparkle-icon-wrapper" style={{ width: 56, height: 56 }}>
            <Sparkles size={24} className="sparkle-gradient-icon spin-slow" />
          </div>
          <p className="auth-loading-text">Loading DARK AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-app">
      {toastMessage && (
        <div className="app-toast animate-fade-in" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessionId={sessionId}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onClearChat={handleClearChat}
        onSelectPrompt={handleSelectPrompt}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isLoggedIn={isLoggedIn}
        user={user}
        onShowLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="gemini-main">
        {/* Top Navbar */}
        <header className="gemini-navbar">
          <div className="navbar-left">
            <button
              className="icon-btn menu-toggle-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <div 
              className="navbar-brand clickable-logo" 
              onClick={handleNewChat} 
              title="DARK AI - Click to start a New Chat"
              role="button"
              tabIndex={0}
            >
              <div className="sparkle-icon-wrapper mini">
                <Sparkles size={16} className="sparkle-gradient-icon" />
              </div>
              <span className="navbar-gemini-title">DARK AI</span>
              <span className="navbar-badge">Tutor</span>
            </div>
          </div>

          <div className="navbar-right">
            <button
              className="navbar-new-chat-btn"
              onClick={handleNewChat}
              title="Start new conversation"
            >
              <Plus size={16} />
              <span className="btn-text">New Chat</span>
            </button>

            {/* User / Login Button */}
            {isLoggedIn ? (
              <div className="user-avatar-menu" ref={userMenuRef}>
                <button
                  className="user-avatar-btn"
                  onClick={() => setShowUserMenu((v) => !v)}
                  title={user?.name || 'Account'}
                  id="user-menu-btn"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="user-avatar-img" />
                  ) : (
                    <div className="user-avatar-initials">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                {showUserMenu && (
                  <div className="user-dropdown animate-fade-in">
                    <div className="user-dropdown-header">
                      <p className="user-dropdown-name">{user?.name}</p>
                      <p className="user-dropdown-email">{user?.email}</p>
                    </div>
                    <button className="user-dropdown-item logout-item" onClick={handleLogout}>
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="navbar-login-btn"
                onClick={() => setShowAuthModal(true)}
                id="navbar-login-btn"
              >
                <User size={15} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Scroll Container */}
        <div className="chat-scroll-container">
          {/* Error Banner */}
          {errorMessage && (
            <div className="error-banner animate-fade-in">
              <AlertCircle size={18} className="error-icon" />
              <div className="error-content">
                <strong>Error: </strong>
                <span>{errorMessage}</span>
              </div>
              <button
                className="error-dismiss-btn"
                onClick={() => setErrorMessage(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* Loading History Indicator */}
          {isHistoryLoading && (
            <div className="history-loader animate-fade-in">
              <RefreshCw size={16} className="spinner-icon" />
              <span>Loading conversation history...</span>
            </div>
          )}

          {/* Empty State / Hero Greeting */}
          {!isHistoryLoading && messages.length === 0 && (
            <HeroGreeting onSelectPrompt={handleSelectPrompt} />
          )}

          {/* Messages Stream */}
          {!isHistoryLoading && messages.length > 0 && (
            <div className="messages-list">
              {messages.map((msg, index) => (
                <ChatMessage
                  key={msg.id || index}
                  message={msg}
                  isLatest={index === messages.length - 1}
                  user={isLoggedIn ? user : null}
                />
              ))}

              {/* AI Typing / Thinking State */}
              {isLoading && (
                <div className="message-row assistant-row animate-fade-in">
                  <div className="message-container">
                    <div className="message-avatar ai-avatar">
                      <Sparkles size={16} className="ai-avatar-sparkle spin-slow" />
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="ai-thinking-card">
                        <div className="thinking-sparkle-dot" />
                        <span className="thinking-text">DARK AI is thinking and formulating response...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Floating Pill Input */}
        <footer className="gemini-footer">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            initialPrompt={selectedPrompt}
          />
        </footer>
      </main>
    </div>
  );
}
