import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Menu, 
  Plus, 
  RefreshCw, 
  AlertCircle,
  LogOut,
  User,
  Trash2,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import HeroGreeting from './components/HeroGreeting';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import AuthModal from './components/AuthModal';
import LearningProfileModal from './components/LearningProfileModal';
import TeleprompterStudio from './components/TeleprompterStudio';
import {
  sendChatMessage,
  fetchChatHistory,
  clearChatHistory,
  fetchLearningProfile,
  saveLearningProfile,
  analyzeChatImage,
} from './services/api';
import { useAuth } from './context/AuthContext';
import './App.css';

// Helper to generate unique session IDs
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const CHAT_RATE_LIMIT_MESSAGE =
  'Our chat is taking a short breather. Please try again in a few minutes — your progress is still here.';

const isChatRateLimitError = (error) =>
  error.status === 429 ||
  /(?:\b429\b|rate.?limit|tokens per day)/i.test(error.message || '');

export default function App() {
  const {
    user,
    isLoggedIn,
    loading,
    logout,
    sessionExpired,
    sessionExpiryCountdown,
    dismissSessionExpired,
  } = useAuth();

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
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [learningProfile, setLearningProfile] = useState(null);
  const [isLearningProfileOpen, setIsLearningProfileOpen] = useState(false);
  const [isLearningProfileSaving, setIsLearningProfileSaving] = useState(false);
  const [learningProfileError, setLearningProfileError] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);

  // User dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setLearningProfile(null);
      setIsLearningProfileOpen(false);
      return undefined;
    }

    let isMounted = true;
    fetchLearningProfile()
      .then((profile) => {
        if (!isMounted) return;
        setLearningProfile(profile);
        if (!profile?.onboardingCompleted) setIsLearningProfileOpen(true);
      })
      .catch((error) => {
        if (!isMounted) return;
        if (error.response?.status === 401) return;
        setLearningProfileError(
          error.response?.data?.message || 'Could not load your learning preferences.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateAppHeight = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);
    viewport?.addEventListener('resize', updateAppHeight);

    return () => {
      window.removeEventListener('resize', updateAppHeight);
      viewport?.removeEventListener('resize', updateAppHeight);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);

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
  const handleSendMessage = async (prompt, imageAttachment = null) => {
    if ((!prompt.trim() && !imageAttachment) || isLoading) return;

    const messageText = prompt.trim() || 'Please analyze this image.';
    setErrorMessage(null);
    setSelectedPrompt('');

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText,
      ...(imageAttachment
        ? { imageUrl: imageAttachment.dataUrl, imageName: imageAttachment.name }
        : {}),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Save or update session in recent list
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === sessionId);
      const title = messageText.length > 30 ? `${messageText.substring(0, 30)}...` : messageText;
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
        ...(imageAttachment
          ? { type: 'image-analysis', imageStatus: 'analyzing' }
          : {}),
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      if (imageAttachment) {
        if (!isLoggedIn) {
          setMessages((prev) => prev.map((message) => (
            message.id === aiMessageId
              ? {
                  ...message,
                  imageStatus: 'error',
                  imageError: 'Please sign in to analyze images, then send this image again.',
                }
              : message
          )));
          return;
        }

        setIsAnalyzingImage(true);
        const result = await analyzeChatImage(prompt.trim(), sessionId, imageAttachment.dataUrl);
        setMessages((prev) => prev.map((message) => (
          message.id === aiMessageId
            ? { ...message, type: 'text', content: result.answer, imageStatus: undefined }
            : message
        )));
        return;
      }

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
      if (imageAttachment) {
        if (err.response?.status === 401 || err.status === 401) {
          setMessages((prev) => prev.filter((message) => message.id !== aiMessageId));
          return;
        }
        setMessages((prev) => prev.map((message) => (
          message.id === aiMessageId
            ? {
                ...message,
                imageStatus: 'error',
                imageError: err.response?.data?.message ||
                  err.message ||
                  'Could not analyze this image. Please try again.',
              }
            : message
        )));
      } else {
        if (err.status === 401) return;
        setErrorMessage(
          isChatRateLimitError(err)
            ? CHAT_RATE_LIMIT_MESSAGE
            : err.message || 'Something went wrong while connecting to the backend.'
        );
      }
    } finally {
      setIsLoading(false);
      setIsAnalyzingImage(false);
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
  const handleClearChat = () => {
    setShowClearChatConfirm(true);
  };

  const confirmClearChat = async () => {
    setShowClearChatConfirm(false);

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

  const handleSaveLearningProfile = async (profile) => {
    setIsLearningProfileSaving(true);
    setLearningProfileError('');
    try {
      const savedProfile = await saveLearningProfile(profile);
      setLearningProfile(savedProfile);
      setIsLearningProfileOpen(false);
    } catch (error) {
      if (error.response?.status === 401) return;
      setLearningProfileError(
        error.response?.data?.message || 'Could not save your learning preferences.'
      );
    } finally {
      setIsLearningProfileSaving(false);
    }
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
      {sessionExpired && sessionExpiryCountdown > 0 && (
        <div className="session-expiry-overlay" role="alertdialog" aria-live="assertive">
          <div className="session-expiry-card">
            <h2>Session expired</h2>
            <p>You’ll be signed out in</p>
            <strong>{sessionExpiryCountdown}</strong>
            <p>seconds. Please sign in again to continue.</p>
          </div>
        </div>
      )}
      {showClearChatConfirm && (
        <div
          className="clear-chat-confirm-overlay"
          onClick={() => setShowClearChatConfirm(false)}
        >
          <section
            className="clear-chat-confirm-dialog animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-chat-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="clear-chat-confirm-icon">
              <Trash2 size={20} />
            </div>
            <h2 id="clear-chat-confirm-title">Clear this conversation?</h2>
            <p>This will remove all messages in the current chat. This action can’t be undone.</p>
            <div className="clear-chat-confirm-actions">
              <button
                type="button"
                className="clear-chat-cancel-btn"
                onClick={() => setShowClearChatConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="clear-chat-confirm-btn"
                onClick={confirmClearChat}
              >
                Clear chat
              </button>
            </div>
          </section>
        </div>
      )}
      {isTeleprompterOpen && (
        <TeleprompterStudio onClose={() => setIsTeleprompterOpen(false)} />
      )}
      {toastMessage && (
        <div
          className="app-toast animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal || (sessionExpired && sessionExpiryCountdown === 0)}
        onClose={() => {
          setShowAuthModal(false);
          if (sessionExpired && sessionExpiryCountdown === 0) dismissSessionExpired();
        }}
        onSuccess={handleAuthSuccess}
      />
      <LearningProfileModal
        isOpen={isLearningProfileOpen}
        profile={learningProfile}
        isSaving={isLearningProfileSaving}
        error={learningProfileError}
        onClose={() => {
          if (learningProfile?.onboardingCompleted) setIsLearningProfileOpen(false);
        }}
        onSave={handleSaveLearningProfile}
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
        onLearningPreferences={() => {
          setLearningProfileError('');
          setIsLearningProfileOpen(true);
        }}
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
                <strong>{errorMessage === CHAT_RATE_LIMIT_MESSAGE ? 'A quick pause: ' : 'Error: '}</strong>
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
          {learningProfileError && !isLearningProfileOpen && (
            <div className="error-banner animate-fade-in" role="alert">
              <AlertCircle size={18} className="error-icon" />
              <div className="error-content">
                <strong>Learning preferences: </strong>
                <span>{learningProfileError}</span>
              </div>
              <button
                className="error-dismiss-btn"
                onClick={() => setLearningProfileError('')}
                aria-label="Dismiss learning preferences error"
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
              {isLoading && !isAnalyzingImage && (
                <div className="message-row assistant-row animate-fade-in">
                  <div className="message-container">
                    <div className="message-avatar ai-avatar">
                      <Sparkles size={16} className="ai-avatar-sparkle spin-slow" />
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="ai-thinking-card">
                        <div className="thinking-sparkle-dot" />
                        <span className="thinking-text">
                          {isAnalyzingImage
                            ? 'DARK AI is analyzing your image...'
                            : 'DARK AI is thinking and formulating response...'}
                        </span>
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
            onOpenStudio={() => setIsTeleprompterOpen(true)}
          />
        </footer>
      </main>
    </div>
  );
}
