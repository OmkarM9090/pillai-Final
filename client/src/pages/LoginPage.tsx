import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as any)?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      const message =
        axiosErr.response?.data?.message ??
        'Unable to connect to the server. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-resort-surface)' }}>
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--color-resort-primary)' }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Decorative circles */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'var(--color-resort-accent)' }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'var(--color-resort-accent)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-resort-accent)' }}
            >
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Smart Resort 360
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-6">
          <h1
            className="text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Intelligent Resort Operations
          </h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-md">
            A unified platform for managing every aspect of your resort — from guest experience to
            revenue intelligence, staff operations, and beyond.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { value: '360°', label: 'Operational Visibility' },
              { value: 'Real-time', label: 'Data Intelligence' },
              { value: 'Role-based', label: 'Access Control' },
              { value: 'Unified', label: 'Team Platform' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: 'var(--color-resort-accent-light)' }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} Smart Resort 360. Enterprise Platform.
          </p>
        </div>
      </div>

      {/* ── Right panel: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-resort-primary)' }}
            >
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-lg font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-resort-primary)',
              }}
            >
              Smart Resort 360
            </span>
          </div>

          <div className="mb-8">
            <h2
              className="text-3xl font-bold mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-resort-primary)',
              }}
            >
              Welcome back
            </h2>
            <p style={{ color: 'var(--color-resort-muted)' }} className="text-sm">
              Sign in to access the resort management platform
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-6 animate-fade-in"
              style={{
                background: 'rgba(220, 38, 38, 0.05)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
              }}
            >
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--color-resort-error)' }} />
              <p className="text-sm" style={{ color: 'var(--color-resort-error)' }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-resort-text)' }}
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--color-resort-muted)' }}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@resort.com"
                  className="form-input pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-resort-text)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--color-resort-muted)' }}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input pl-10 pr-10"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                  style={{ color: 'var(--color-resort-muted)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className="btn-primary w-full mt-2 py-3"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in to Resort 360'
              )}
            </button>
          </form>

          <p className="text-xs text-center mt-8" style={{ color: 'var(--color-resort-muted)' }}>
            This platform is for authorized resort personnel only.
            <br />
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
