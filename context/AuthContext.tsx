import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { USE_API } from '../api/config';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  createdAt: string;
}

const GUEST_USER: User = {
  id: 'guest',
  name: 'زائر',
  email: '',
  password: '',
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

const ADMIN_USER: User = {
  id: 'admin-001',
  name: 'مدير التطبيق',
  email: 'admin@tulkarm.com',
  password: 'admin123',
  isAdmin: true,
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
    if (!USE_API) ensureAdminExists();
  }, []);

  const ensureAdminExists = async () => {
    try {
      const usersJson = await AsyncStorage.getItem('users');
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      const adminExists = users.some((u) => u.id === 'admin-001');
      if (!adminExists) {
        users.push(ADMIN_USER);
        await AsyncStorage.setItem('users', JSON.stringify(users));
      }
    } catch (error) {
      console.error('Error ensuring admin exists:', error);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const userJson = await AsyncStorage.getItem('currentUser');
      if (userJson) {
        const u = JSON.parse(userJson);
        setUser({ ...u, password: undefined });
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (USE_API) {
        const res = await api.login(email, password);
        if (!res.success || !res.user) {
          return { success: false, message: res.message || 'فشل تسجيل الدخول' };
        }
        const u = res.user as { id: string; name: string; email: string; isAdmin: boolean; createdAt: string };
        const savedUser: User = {
          id: u.id,
          name: u.name,
          email: u.email,
          isAdmin: u.isAdmin,
          createdAt: u.createdAt,
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        setUser(savedUser);
        return { success: true, message: 'تم تسجيل الدخول بنجاح' };
      }
      const usersJson = await AsyncStorage.getItem('users');
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      const foundUser = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!foundUser) {
        return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      const { password: _, ...safeUser } = foundUser;
      await AsyncStorage.setItem('currentUser', JSON.stringify(safeUser));
      setUser(safeUser);
      return { success: true, message: 'تم تسجيل الدخول بنجاح' };
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

      if (USE_API) {
        const res = await api.register(name, email, password);
        if (!res.success || !res.user) {
          return { success: false, message: res.message || 'فشل إنشاء الحساب' };
        }
        const u = res.user as { id: string; name: string; email: string; isAdmin: boolean; createdAt: string };
        const savedUser: User = {
          id: u.id,
          name: u.name,
          email: u.email,
          isAdmin: u.isAdmin,
          createdAt: u.createdAt,
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        setUser(savedUser);
        return { success: true, message: 'تم إنشاء الحساب بنجاح' };
      }

      const usersJson = await AsyncStorage.getItem('users');
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      const emailExists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return { success: false, message: 'هذا البريد الإلكتروني مسجل مسبقاً' };
      }
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      await AsyncStorage.setItem('users', JSON.stringify(users));
      const { password: _, ...safeUser } = newUser;
      await AsyncStorage.setItem('currentUser', JSON.stringify(safeUser));
      setUser(safeUser);
      return { success: true, message: 'تم إنشاء الحساب بنجاح' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى' };
    }
  };

  const loginAsGuest = async () => {
    await AsyncStorage.setItem('currentUser', JSON.stringify(GUEST_USER));
    setUser(GUEST_USER);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('currentUser');
    setUser(null);
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
