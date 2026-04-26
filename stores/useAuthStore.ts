/**
 * useAuthStore — Zustand store لإدارة المستخدم الحالي.
 * يستهلكه المكوّنات الجديدة مباشرةً. الـ AuthContext الموجود يبقى
 * للشاشات القديمة دون تغيير.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { api, loadTokens, saveTokens, clearTokens, getAccessToken, getRefreshToken } from '../api/client';

export type UserRole = 'admin' | 'user' | 'owner' | 'store_owner' | 'guest';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  createdAt: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  profileImageUrl?: string | null;
  idCardImageUrl?: string | null;
  verificationStatus?: 'verified' | 'pending' | 'rejected' | null;
}

const GUEST_USER: AuthUser = {
  id: 'guest',
  name: 'زائر',
  email: '',
  role: 'guest',
  isAdmin: false,
  createdAt: new Date().toISOString(),
};

function normalizeDateOnly(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const direct = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

  const dmy = raw.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function toUser(raw: any): AuthUser {
  const email = String(raw?.email || '').toLowerCase();
  const role: UserRole =
    raw.role || (raw.isAdmin ? 'admin' : email === 'admin@tulkarm.com' ? 'admin' : 'user');
  const isAdmin = role === 'admin' || raw.isAdmin === true || email === 'admin@tulkarm.com';
  const normalizedDob = normalizeDateOnly(raw?.date_of_birth ?? raw?.dateOfBirth);
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role,
    isAdmin,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    phoneNumber: raw.phone_number ?? raw.phoneNumber ?? null,
    dateOfBirth: normalizedDob,
    profileImageUrl: raw.profile_image_url ?? raw.profileImageUrl ?? null,
    idCardImageUrl: raw.id_card_image_url ?? raw.idCardImageUrl ?? null,
    verificationStatus:
      (raw.verification_status ?? raw.verificationStatus ?? 'pending') === 'unverified'
        ? 'pending'
        : (raw.verification_status ?? raw.verificationStatus ?? 'pending'),
  };
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (data: {
    name: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    profile_image_url?: string | null;
    id_card_image_url?: string | null;
  }) => Promise<{ success: boolean; message: string }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;

  /** مساعدات شائعة */
  isStoreOwner: () => boolean;
  isAdmin: () => boolean;
  isGuest: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  init: async () => {
    try {
      await loadTokens();
      const userJson = await AsyncStorage.getItem('currentUser');
      if (userJson) {
        const u = JSON.parse(userJson);
        if (u.id === 'guest') {
          set({ user: toUser(u), isLoading: false });
        } else if (!getAccessToken() && !getRefreshToken()) {
          await AsyncStorage.removeItem('currentUser');
          set({ user: null, isLoading: false });
        } else {
          const localUser = toUser(u);
          set({ user: localUser, isLoading: false });
          try {
            const me: any = await api.getMe();
            const raw = me?.data?.user;
            if (me?.success && raw) {
              const freshUser = toUser(raw);
              await AsyncStorage.setItem('currentUser', JSON.stringify(freshUser));
              set({ user: freshUser });
            }
          } catch {
            // نبقي المستخدم المحلي عندما يفشل /me (مثلاً انقطاع مؤقت)
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const res: any = await api.login(email, password);
      if (res.success && (res.data?.user || res.user)) {
        const rawUser = res.data?.user || res.user;
        if (res.data?.accessToken && res.data?.refreshToken) {
          await saveTokens(res.data.accessToken, res.data.refreshToken);
        } else {
          await clearTokens();
        }
        let savedUser = toUser(rawUser);
        try {
          const me: any = await api.getMe();
          const rawMe = me?.data?.user;
          if (me?.success && rawMe) {
            savedUser = toUser(rawMe);
          }
        } catch {
          // fallback to login payload only
        }
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        set({ user: savedUser });
        return { success: true, message: 'تم تسجيل الدخول بنجاح' };
      }
      return { success: false, message: 'فشل تسجيل الدخول' };
    } catch (err: any) {
      const msg = err?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى';
      set({ error: msg });
      return { success: false, message: msg };
    }
  },

  register: async (name, email, password) => {
    set({ error: null });
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
      if (res.success && (res.data?.user || res.user)) {
        const rawUser = res.data?.user || res.user;
        if (res.data?.accessToken && res.data?.refreshToken) {
          await saveTokens(res.data.accessToken, res.data.refreshToken);
        } else {
          await clearTokens();
        }
        let savedUser = toUser(rawUser);
        try {
          const me: any = await api.getMe();
          const rawMe = me?.data?.user;
          if (me?.success && rawMe) {
            savedUser = toUser(rawMe);
          }
        } catch {
          // fallback to register payload only
        }
        await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
        set({ user: savedUser });
        return { success: true, message: 'تم إنشاء الحساب بنجاح' };
      }
      return { success: false, message: 'فشل إنشاء الحساب' };
    } catch (err: any) {
      const msg = err?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى';
      set({ error: msg });
      return { success: false, message: msg };
    }
  },

  updateProfile: async (data) => {
    set({ error: null });
    try {
      const res: any = await api.updateProfile(data);
      const rawUser = res?.data?.user;
      if (!res?.success || !rawUser) {
        return { success: false, message: 'فشل تحديث البيانات الشخصية' };
      }
      const savedUser = toUser(rawUser);
      await AsyncStorage.setItem('currentUser', JSON.stringify(savedUser));
      set({ user: savedUser });
      return { success: true, message: 'تم تحديث البيانات الشخصية بنجاح' };
    } catch (err: any) {
      const msg = err?.message || 'فشل تحديث البيانات الشخصية';
      set({ error: msg });
      return { success: false, message: msg };
    }
  },

  loginAsGuest: async () => {
    await clearTokens();
    await AsyncStorage.setItem('currentUser', JSON.stringify(GUEST_USER));
    set({ user: GUEST_USER });
  },

  logout: async () => {
    try { await api.logout().catch(() => {}); } finally {
      await clearTokens();
      await AsyncStorage.removeItem('currentUser');
      set({ user: null });
    }
  },

  clearError: () => set({ error: null }),

  isStoreOwner: () => {
    const { user } = get();
    return user?.role === 'owner' || user?.role === 'store_owner';
  },
  isAdmin: () => get().user?.isAdmin === true,
  isGuest: () => get().user?.id === 'guest' || get().user?.role === 'guest',
}));
