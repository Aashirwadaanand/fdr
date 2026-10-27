import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export type UserRole = 
  | 'INSTITUTION_OFFICER'
  | 'SCRUTINY_OFFICER'
  | 'APPROVING_AUTHORITY'
  | 'ADMIN'
  | 'AUDITOR';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  designation?: string;
  institution_id?: string | null;
  institution_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fdr_sentinel_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fdr_sentinel_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth_logout', handleLogout);

    const checkAuth = async () => {
      if (token) {
        try {
          const me = await api.getMe();
          setUser(me);
          localStorage.setItem('fdr_sentinel_user', JSON.stringify(me));
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem('fdr_sentinel_token');
          localStorage.removeItem('fdr_sentinel_user');
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    return () => window.removeEventListener('auth_logout', handleLogout);
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('fdr_sentinel_token', res.token);
    localStorage.setItem('fdr_sentinel_user', JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fdr_sentinel_token');
    localStorage.removeItem('fdr_sentinel_user');
  };

  const switchRole = async (targetRole: UserRole) => {
    const roleCredentials: Record<UserRole, { u: string; p: string }> = {
      INSTITUTION_OFFICER: { u: 'institution_officer', p: 'Institution@123' },
      SCRUTINY_OFFICER: { u: 'scrutiny_officer', p: 'Scrutiny@123' },
      APPROVING_AUTHORITY: { u: 'approving_officer', p: 'Approver@123' },
      ADMIN: { u: 'admin_officer', p: 'Admin@123' },
      AUDITOR: { u: 'auditor_officer', p: 'Auditor@123' },
    };

    const creds = roleCredentials[targetRole];
    if (creds) {
      await login(creds.u, creds.p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
