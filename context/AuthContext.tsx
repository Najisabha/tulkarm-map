import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadTokens, saveTokens, clearTokens, getAccessToken, getRefreshToken } from '../api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
}

const GUEST_USER: User = {
  id: 'guest',
  name: 'زائر',
  email: '',
  role: 'guest',
  isAdmin: false,
  createdAt: new Date().toISOString(),
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toUser(raw: any): User {
  const email = String(raw?.email || '').toLowerCase();
  const role =
    raw.role || (raw.isAdmin ? 'admin' : email === 'admin@tulkarm.com' ? 'admin' : 'user');
  const isAdmin =
    role === 'admin' || raw.isAdmin === true || email === 'admin@tulkarm.com';
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role,
    isAdmin,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      await loadTokens();
      const userJson = await AsyncStorage.getItem('currentUser');
      if (userJson) {
        const u = JSON.parse(userJson);
        if (u.id === 'guest') {
          setUser(toUser(u));
        } else if (!getAccessToken() && !getRefreshToken()) {
          // مستخدم محفوظ بدون JWT — طلبات /api/* ستُرجع 401؛ نفرض إعادة الدخول
          await AsyncStorage.removeItem('currentUser');
          setUser(null);
        } else {
          setUser(toUser(u));
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res: any = await api.login(email, password);
      // Supports both:
      // 1) New API: { success, data: { user, accessToken, refreshToken } }
      // 2) Legacy API: { success, user }
      if (res.success && (res.data?.user || res.user)) {
        const rawUser = res.data?.user || res.user;
        if (res.data?.accessToken && res.data?.refreshToken) {
          await saveTokens(res.data.accessToken, res.data.refreshToken);
        } else {
          await clearTokens();
        }
        const savedUser = toUser(rawUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        setUser(savedUser);
        return { success: true, message: 'تم تسجيل الدخول بنجاح' };
      }
      return { success: false, message: 'فشل تسجيل الدخول' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى' };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      if (!name.trim() || !email.trim() || !password.trim()) {
        return { success: false, message: 'يرجى تعبئة جميع الحقول' };
      }
      if (password.length < 6) {
        return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' };
      }

      const res: any = await api.register(name, email, password);
      // Supports both new and legacy response shapes.
      if (res.success && (res.data?.user || res.user)) {
        const rawUser = res.data?.user || res.user;
        if (res.data?.accessToken && res.data?.refreshToken) {
          await saveTokens(res.data.accessToken, res.data.refreshToken);
        } else {
          await clearTokens();
        }
        const savedUser = toUser(rawUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        setUser(savedUser);
        return { success: true, message: 'تم إنشاء الحساب بنجاح' };
      }
      return { success: false, message: 'فشل إنشاء الحساب' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى' };
    }
  };

  const loginAsGuest = async () => {
    await clearTokens();
    await AsyncStorage.setItem('currentUser', JSON.stringify(GUEST_USER));
    setUser(GUEST_USER);
  };

  const logout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      await clearTokens();
      await AsyncStorage.removeItem('currentUser');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
