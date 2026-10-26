import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, Eye, EyeOff, X, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import './AuthModal.css';

export default function AuthModal(props) {
  if (!props.isOpen) return null;
  return <AuthModalDialog {...props} />;
}

function AuthModalDialog({ onClose, onSuccess }) {
  const { login, register, googleLogin } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setFormData({ name: '', email: '', password: '' });
    setShowPassword(false);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(formData.email, formData.password);
      } else {
        if (!formData.name.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        result = await register(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        setSuccess(mode === 'login' ? 'Welcome back! 🎉' : 'Account created! Welcome aboard! 🚀');
        setTimeout(() => {
          if (onSuccess) onSuccess(result.user);
        }, 800);
      } else {
        setError(result.message || 'Something went wrong');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Connection failed. Make sure backend is running.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (result.success) {
        setSuccess('Google sign-in successful! 🎉');
        setTimeout(() => {
          if (onSuccess) onSuccess(result.user);
        }, 800);
      } else {
        setError(result.message || 'Google sign-in failed');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Google sign-in failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Try email login instead.');
  };

  return (
    <div className="auth-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal animate-slide-up">
        {/* Close Button */}
        <button className="auth-close-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-ring">
            <Sparkles size={22} className="auth-logo-sparkle" />
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Welcome Back' : 'Join DARK AI'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to continue your English journey'
              : 'Create your free account to start learning'}
          </p>
        </div>

        {/* Google Login */}
        <div className="auth-google-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            shape="pill"
            size="large"
            text={mode === 'login' ? 'signin_with' : 'signup_with'}
            width="100%"
          />
        </div>

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">or continue with email</span>
          <span className="auth-divider-line" />
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="auth-name"
                  name="name"
                  type="text"
                  className="auth-input"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="auth-email"
                name="email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'}
                value={formData.password}
                onChange={handleChange}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="auth-error animate-fade-in">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="auth-success animate-fade-in">
              <CheckCircle size={15} />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            className={`auth-submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="auth-btn-spinner" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              <span>Don't have an account?</span>
              <button className="auth-switch-btn" onClick={() => switchMode('register')}>
                Sign up free
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button className="auth-switch-btn" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Privacy note */}
        <p className="auth-privacy">
          🔒 Your data is secure. We never share your information.
        </p>
      </div>
    </div>
  );
}
