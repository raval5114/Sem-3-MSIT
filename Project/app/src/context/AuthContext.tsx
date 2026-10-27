/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPrivilege: (privilege: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string): TokenPayload | null {
  try {
    const base64Payload = token.split('.')[1];
    const jsonPayload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(jsonPayload) as TokenPayload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<TokenPayload | null>(() => {
    const stored = localStorage.getItem('access_token');
    return stored ? parseJwt(stored) : null;
  });

  useEffect(() => {
    if (token) {
      const parsed = parseJwt(token);
      // Auto-logout if token is expired
      if (parsed && parsed.exp * 1000 < Date.now()) {
        // eslint-disable-next-line react-hooks/immutability
        logout();
      } else {
        setUser(parsed);
      }
    }
  }, [token]);

  const login = (newToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('refresh_token', refreshToken);
    setToken(newToken);
    setUser(parseJwt(newToken));
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
  };

  const hasRole = (role: string) => user?.roles?.includes(role) ?? false;
  const hasPrivilege = (priv: string) => user?.privileges?.includes(priv) ?? false;

  return (
    <AuthContext.Provider value={{
      token, user,
      isAuthenticated: !!token,
      login, logout, hasRole, hasPrivilege
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
