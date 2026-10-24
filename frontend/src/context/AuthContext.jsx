import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://ai-english-chatbot-2.onrender.com';

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

  // Verify stored token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          logout();
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const saveSession = (tokenVal, userData) => {
    localStorage.setItem('dark_ai_token', tokenVal);
    setToken(tokenVal);
    setUser(userData);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('dark_ai_token');
    setToken(null);
    setUser(null);
  }, []);

  // Email/Password Register
  const register = async (name, email, password) => {
    const res = await axios.post(`${API_BASE_URL}/auth/register`, { name, email, password });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  // Email/Password Login
  const login = async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  // Google OAuth Login
  const googleLogin = async (credential) => {
    const res = await axios.post(`${API_BASE_URL}/auth/google`, { credential });
    if (res.data.success) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  };

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{ user, token, isLoggedIn, loading, login, register, logout, googleLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
}
