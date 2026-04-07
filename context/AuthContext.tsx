import React, { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, init, login, register, loginAsGuest, logout } = useAuthStore();

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <AuthContext.Provider
      value={{
        // Zustand user type is compatible (same fields) — keep AuthContext API stable for old screens.
        user: (user as unknown as User) ?? null,
        isLoading,
        login,
        register,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
