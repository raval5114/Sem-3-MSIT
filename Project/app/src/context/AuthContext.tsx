/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import type { EffectiveAccessContext } from '../types/session';

interface TokenPayload {
  sub: string;
  email: string;
  restaurantId: string;
  type: string;
  roles: string[];
  privileges: string[];
  exp: number;
}

interface AuthContextType {
  token: string | null;
  user: TokenPayload | null;
  accessContext: EffectiveAccessContext | null;
  accessLoading: boolean;
  accessError: string;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
  refreshAccessContext: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPrivilege: (privilege: string) => boolean;
  hasFeature: (featureKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const ACCESS_REFRESH_EVENT = 'dineflow:access-context-refresh';
const AUTHORIZATION_CHANGED_EVENT = 'dineflow:authorization-changed';
const ACCESS_REFRESH_INTERVAL_MS = 60_000;

function parseJwt(token: string): TokenPayload | null {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;
    const jsonPayload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(jsonPayload) as TokenPayload;
  } catch {
    return null;
  }
}

function errorMessage(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'response' in cause) {
    const response = (cause as { response?: { data?: { message?: string; detail?: string } } }).response;
    if (response?.data?.message || response?.data?.detail) {
      return response.data.message ?? response.data.detail ?? 'Could not refresh access.';
    }
  }
  return cause instanceof Error ? cause.message : 'Could not refresh your access. Try again.';
}

function responseStatus(cause: unknown): number | undefined {
  if (typeof cause !== 'object' || cause === null || !('response' in cause)) return undefined;
  return (cause as { response?: { status?: number } }).response?.status;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<TokenPayload | null>(() => {
    const stored = localStorage.getItem('access_token');
    return stored ? parseJwt(stored) : null;
  });
  const [accessContext, setAccessContext] = useState<EffectiveAccessContext | null>(null);
  const [accessLoading, setAccessLoading] = useState(!!token);
  const [accessError, setAccessError] = useState('');

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setAccessContext(null);
    setAccessError('');
    setAccessLoading(false);
  }, []);

  const refreshAccessContext = useCallback(async () => {
    if (!token) {
      setAccessContext(null);
      setAccessError('');
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setAccessError('');
    try {
      const currentUser = parseJwt(token);
      if (!currentUser || currentUser.exp * 1000 <= Date.now()) {
        logout();
        return;
      }
      const context = await authService.getAccessContext();
      setAccessContext(context);
    } catch (cause) {
      setAccessContext(null);
      if (responseStatus(cause) === 401) {
        logout();
        return;
      }
      setAccessError(errorMessage(cause));
    } finally {
      setAccessLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAccessContext(null);
      setAccessLoading(false);
      return;
    }
    const parsed = parseJwt(token);
    if (!parsed || parsed.exp * 1000 <= Date.now()) {
      logout();
      return;
    }
    setUser(parsed);
    void refreshAccessContext();
    const expiresIn = Math.max(0, parsed.exp * 1000 - Date.now());
    const expiryTimer = window.setTimeout(logout, expiresIn);
    return () => window.clearTimeout(expiryTimer);
  }, [logout, refreshAccessContext, token]);

  useEffect(() => {
    if (!token) return;
    const refresh = () => { void refreshAccessContext(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, ACCESS_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener(ACCESS_REFRESH_EVENT, refresh);
    window.addEventListener(AUTHORIZATION_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(ACCESS_REFRESH_EVENT, refresh);
      window.removeEventListener(AUTHORIZATION_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshAccessContext, token]);

  const login = (newToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(parseJwt(newToken));
    setAccessContext(null);
    setAccessError('');
    setAccessLoading(true);
  };

  const hasRole = (role: string) => accessContext?.role === role;
  const hasPrivilege = (privilege: string) => accessContext?.permissions.includes(privilege) ?? false;
  const hasFeature = (featureKey: string) => accessContext?.features[featureKey]?.enabled ?? false;

  return (
    <AuthContext.Provider value={{
      token,
      user,
      accessContext,
      accessLoading,
      accessError,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      refreshAccessContext,
      hasRole,
      hasPrivilege,
      hasFeature,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// This hook is intentionally colocated to preserve the public AuthContext API.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
