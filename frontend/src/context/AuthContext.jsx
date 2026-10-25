import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { notifySessionExpired } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('dark_ai_token') || null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiryCountdown, setSessionExpiryCountdown] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('dark_ai_token');
    setToken(null);
    setUser(null);
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    setSessionExpiryCountdown(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setSessionExpiryCountdown((current) => current ?? 10);
      setSessionExpired(true);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (sessionExpiryCountdown === null || sessionExpiryCountdown === 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSessionExpiryCountdown((current) => {
        if (current === null || current <= 1) {
          logout();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [logout, sessionExpiryCountdown]);

  // Verify stored token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          logout();
        }
      })
      .catch((error) => {
        if (error.response?.status === 401) {
          notifySessionExpired();
        } else {
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const saveSession = (tokenVal, userData) => {
    localStorage.setItem('dark_ai_token', tokenVal);
    setToken(tokenVal);
    setUser(userData);
    setSessionExpiryCountdown(null);
    setSessionExpired(false);
  };

  // Email/Password Register
  const register = async (name, email, password) => {
    const res = await apiClient.post('/auth/register', { name, email, password });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  // Email/Password Login
  const login = async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  // Google OAuth Login
  const googleLogin = async (credential) => {
    const res = await apiClient.post('/auth/google', { credential });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider
    value={{
      user,
      token,
      isLoggedIn,
      loading,
      sessionExpired,
      sessionExpiryCountdown,
      dismissSessionExpired,
      login,
      register,
      logout,
      googleLogin,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}
