import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
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
    ensureAdminExists();
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
        setUser(JSON.parse(userJson));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const usersJson = await AsyncStorage.getItem('users');
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      const foundUser = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!foundUser) {
        return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      await AsyncStorage.setItem('currentUser', JSON.stringify(foundUser));
      setUser(foundUser);
      return { success: true, message: 'تم تسجيل الدخول بنجاح' };
    } catch (error) {
      return { success: false, message: 'حدث خطأ، يرجى المحاولة مرة أخرى' };
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
      await AsyncStorage.setItem('currentUser', JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, message: 'تم إنشاء الحساب بنجاح' };
    } catch (error) {
      return { success: false, message: 'حدث خطأ، يرجى المحاولة مرة أخرى' };
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
