import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, AuthResponse, LoginCredentials, Permission } from '../types';
import { ROLE_PERMISSIONS } from '../types';
import { authService } from '../services/auth.service';

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================
const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// ============================================================
// Provider
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // Validate token on mount by calling /auth/me
  // ============================================================
  useEffect(() => {
    const validateSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const freshUser = await authService.getMe();
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      } catch {
        // Token invalid or expired
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  // ============================================================
  // Login
  // ============================================================
  const login = useCallback(async (credentials: LoginCredentials) => {
    const response: AuthResponse = await authService.login(credentials);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
  }, []);

  // ============================================================
  // Logout
  // ============================================================
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  // ============================================================
  // Permission check
  // ============================================================
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      const perms = ROLE_PERMISSIONS[user.role] ?? [];
      return perms.includes(permission);
    },
    [user]
  );

  // ============================================================
  // Refresh user from API
  // ============================================================
  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await authService.getMe();
      setUser(freshUser);
      localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    } catch {
      // Silently fail
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    hasPermission,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
