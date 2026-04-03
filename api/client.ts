import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './config';

// ============ Token Management ============

const TOKEN_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

export async function loadTokens() {
  accessToken = await AsyncStorage.getItem(TOKEN_KEY);
  refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await AsyncStorage.setItem(TOKEN_KEY, access);
  await AsyncStorage.setItem(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error('No refresh token');

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Refresh failed');
    }
    await saveTokens(data.data.accessToken, data.data.refreshToken);
    refreshQueue.forEach((q) => q.resolve(data.data.accessToken));
    return data.data.accessToken;
  } catch (err: any) {
    refreshQueue.forEach((q) => q.reject(err));
    await clearTokens();
    throw err;
  } finally {
    isRefreshing = false;
    refreshQueue = [];
  }
}

// ============ HTTP Client ============

function formatApiError(data: unknown, status: number): string {
  const d = data as Record<string, unknown>;
  const msg = typeof d?.message === 'string' ? d.message : '';
  const details = d?.details;
  if (Array.isArray(details) && details.length > 0) {
    const joined = details.map(String).join(' — ');
    return msg ? `${msg}: ${joined}` : joined;
  }
  if (msg) return msg;
  if (typeof d?.error === 'string' && d.error) return d.error;
  if (status === 413) return 'حجم الطلب كبير جداً. جرّب صوراً أصغر.';
  if (status >= 500) return 'الخادم غير متاح مؤقتاً. حاول لاحقاً.';
  if (status === 404) {
    return (
      'طلب غير موجود (404). غالباً أحد الأسباب: (1) EXPO_PUBLIC_API_URL يشير لعنوان خاطئ — يجب أن يكون نفس أصل خادم الـ API في مجلد server/ (مثلاً http://localhost:3000 مع PORT في server/.env)، وليس عنوان Expo/الواجهة فقط؛ (2) على الإنتاج، هذا المسار غير منشور بعد على الخادم. راجع Network في المتصفح للمسار الكامل.'
    );
  }
  return 'تعذّر قراءة رد الخادم. تحقق من الاتصال وعنوان API.';
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  // يُزامن الذاكرة مع AsyncStorage قبل أول طلب — يمنع سباقاً مع AuthProvider (الطفل يطلب قبل انتهاء loadTokens)
  if (!accessToken) {
    await loadTokens();
  }
  // لا يوجد access محفوظ لكن يوجد refresh — نجدّد قبل الطلب (شائع بعد انتهاء الجلسة القصيرة)
  if (!accessToken && refreshToken && path !== '/api/auth/refresh') {
    try {
      await refreshAccessToken();
    } catch {
      /* يُكمَل الطلب؛ قد يُرجع 401 ثم يُعالج أدناه */
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت ومن EXPO_PUBLIC_API_URL.');
  }

  if (res.status === 401 && retry && refreshToken) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) throw new Error(formatApiError(retryData, retryRes.status));
      return retryData as T;
    } catch {
      await clearTokens();
      throw new Error('جلسة منتهية، يرجى تسجيل الدخول مجدداً');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(data, res.status));
  }
  return data as T;
}

// ============ Response Types ============

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface PlaceData {
  id: string;
  name: string;
  description: string | null;
  type_name: string;
  type_id: string;
  latitude: number;
  longitude: number;
  status: string;
  avg_rating: string;
  rating_count: number;
  attributes: { key: string; value: string; value_type: string }[];
  images: { id: string; image_url: string; sort_order: number }[];
  created_at: string;
  created_by?: string;
}

export interface PlaceType {
  id: string;
  name: string;
  created_at: string;
  emoji?: string | null;
  color?: string | null;
}

export interface RatingData {
  id: string;
  rating: number;
  comment: string | null;
  user_name: string;
  user_id: string;
  created_at: string;
}

export interface StoreService {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: string | null;
  is_available: boolean;
  sort_order: number;
}

export interface StoreProduct {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  main_category?: string | null;
  sub_category?: string | null;
  company_name?: string | null;
  sort_order: number;
}

export interface ProductMainCategory {
  id: string;
  name: string;
  emoji?: string | null;
  arrow_color?: string | null;
  sort_order: number;
  subcategories_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductSubCategory {
  id: string;
  main_category_id: string;
  name: string;
  emoji?: string | null;
  arrow_color?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  user_id: string;
  total: string;
  status: string;
  notes: string | null;
  created_at: string;
  store_name?: string;
  customer_name?: string;
  customer_email?: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
}

export interface AdminStats {
  users: number;
  stores: number;
  places: number;
  placeTypes: number;
  pendingReports: number;
  /** أماكن بانتظار الموافقة (طلبات المتاجر). */
  pendingPlaceRequests?: number;
}

export interface Report {
  id: string;
  placeId: string;
  placeName: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: object;
  createdAt: string;
}

export interface AppSettings {
  maintenance_mode?: boolean;
  welcome_message?: string;
}

// ============ Unified API ============

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!filtered.length) return '';
  return '?' + new URLSearchParams(
    filtered.reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)
  ).toString();
}

export const api = {

  // ────── Auth ──────

  login: (email: string, password: string) =>
    request<ApiResponse<{ user: UserData; accessToken: string; refreshToken: string }>>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  register: (name: string, email: string, password: string) =>
    request<ApiResponse<{ user: UserData; accessToken: string; refreshToken: string }>>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ name, email, password }) }
    ),

  logout: () =>
    request<ApiResponse<{ message: string }>>(
      '/api/auth/logout',
      { method: 'POST', body: JSON.stringify({ refreshToken }) }
    ),

  getMe: () =>
    request<ApiResponse<{ user: UserData }>>('/api/auth/me'),

  health: () =>
    request<{ ok: boolean; message?: string }>('/api/health'),

  // ────── Place Types ──────

  getPlaceTypes: async () => {
    try {
      return await request<ApiResponse<PlaceType[]>>('/api/place-types');
    } catch {
      const legacy = await request<any[]>('/api/categories');
      const normalized: PlaceType[] = (Array.isArray(legacy) ? legacy : []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        created_at: c.created_at || new Date().toISOString(),
        emoji: c.emoji ?? null,
        color: c.color ?? null,
      }));
      return { success: true, data: normalized };
    }
  },

  createPlaceType: async (name: string, opts?: { emoji?: string; color?: string }) => {
    const body = {
      name,
      emoji: opts?.emoji ?? null,
      color: opts?.color ?? null,
    };
    try {
      return await request<ApiResponse<PlaceType>>('/api/place-types', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch {
      const created = await request<any>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          emoji: opts?.emoji ?? '📍',
          color: opts?.color ?? '#2E86AB',
        }),
      });
      const normalized: PlaceType = {
        id: String(created?.id),
        name: created?.name || name,
        created_at: created?.created_at || new Date().toISOString(),
        emoji: created?.emoji ?? opts?.emoji ?? null,
        color: created?.color ?? opts?.color ?? null,
      };
      return { success: true, data: normalized };
    }
  },

  deletePlaceType: async (id: string) => {
    try {
      return await request<ApiResponse<{ message: string }>>(`/api/place-types/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return await request<any>(`/api/categories/${id}`, {
        method: 'DELETE',
      });
    }
  },

  updatePlaceType: async (id: string, updates: { name?: string; emoji?: string; color?: string }) => {
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;
    if (Object.keys(patch).length === 0) {
      throw new Error('لا توجد حقول للتحديث');
    }
    try {
      return await request<ApiResponse<PlaceType>>(`/api/place-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      const updated = await request<any>(`/api/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const normalized: PlaceType = {
        id: String(updated?.id || id),
        name: updated?.name ?? patch.name ?? '',
        created_at: updated?.created_at || new Date().toISOString(),
        emoji: updated?.emoji ?? (patch.emoji !== undefined ? patch.emoji : null),
        color: updated?.color ?? (patch.color !== undefined ? patch.color : null),
      };
      return { success: true, data: normalized };
    }
  },

  getAttributeDefinitions: (typeId: string) =>
    request<ApiResponse<any[]>>(`/api/place-types/${typeId}/attribute-definitions`),

  createAttributeDefinition: (typeId: string, data: { key: string; label: string; value_type: string; is_required: boolean; options?: any }) =>
    request<ApiResponse<any>>(`/api/place-types/${typeId}/attribute-definitions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ────── Product Categories (Main/Sub) ──────

  getProductMainCategories: () =>
    request<ApiResponse<ProductMainCategory[]>>('/api/product-categories'),

  createProductMainCategory: (data: { name: string; sort_order?: number; emoji?: string | null; arrow_color?: string | null }) =>
    request<ApiResponse<ProductMainCategory>>('/api/product-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProductMainCategory: (id: string, data: { name?: string; sort_order?: number; emoji?: string | null; arrow_color?: string | null }) =>
    request<ApiResponse<ProductMainCategory>>(`/api/product-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProductMainCategory: (id: string) =>
    request<ApiResponse<{ message: string }>>(`/api/product-categories/${id}`, { method: 'DELETE' }),

  getProductSubCategories: (mainCategoryId: string) =>
    request<ApiResponse<ProductSubCategory[]>>(`/api/product-categories/${mainCategoryId}/subcategories`),

  createProductSubCategory: (mainCategoryId: string, data: { name: string; sort_order?: number; emoji?: string | null; arrow_color?: string | null }) =>
    request<ApiResponse<ProductSubCategory>>(`/api/product-categories/${mainCategoryId}/subcategories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProductSubCategory: (id: string, data: { name?: string; sort_order?: number; emoji?: string | null; arrow_color?: string | null }) =>
    request<ApiResponse<ProductSubCategory>>(`/api/product-subcategories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProductSubCategory: (id: string) =>
    request<ApiResponse<{ message: string }>>(`/api/product-subcategories/${id}`, { method: 'DELETE' }),

  // ────── Places ──────

  getPlaces: (params?: Record<string, string | number | undefined>) =>
    request<PaginatedResponse<PlaceData>>(`/api/places${qs(params)}`),

  getPlace: (id: string) =>
    request<ApiResponse<PlaceData>>(`/api/places/${id}`),

  createPlace: (data: {
    name: string;
    description?: string;
    type_id: string;
    latitude: number;
    longitude: number;
    attributes?: { key: string; value: string; value_type?: string }[];
    image_urls?: string[];
  }) =>
    request<ApiResponse<PlaceData>>('/api/places', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** إضافة مكان مفعّل مباشرة — لوحة الإدارة فقط (JWT مدير). */
  createPlaceFromAdmin: (data: {
    name: string;
    description?: string;
    type_id: string;
    latitude: number;
    longitude: number;
    attributes?: { key: string; value: string; value_type?: string }[];
    image_urls?: string[];
  }) =>
    request<ApiResponse<PlaceData>>('/api/places/from-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePlace: (id: string, data: Record<string, any>) =>
    request<ApiResponse<PlaceData>>(`/api/places/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePlace: (id: string) =>
    request<ApiResponse<{ message: string }>>(`/api/places/${id}`, { method: 'DELETE' }),

  addPlaceImage: (placeId: string, imageUrl: string) =>
    request<ApiResponse<any>>(`/api/places/${placeId}/images`, {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }),

  removePlaceImage: (placeId: string, imageId: string) =>
    request<ApiResponse<any>>(`/api/places/${placeId}/images/${imageId}`, { method: 'DELETE' }),

  // ────── Upload ──────

  uploadBase64: (image: string) =>
    request<ApiResponse<{ url: string; public_id: string }>>('/api/upload/base64', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),

  // ────── Ratings ──────

  createRating: (placeId: string, rating: number, comment?: string) =>
    request<ApiResponse<RatingData>>('/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ place_id: placeId, rating, comment }),
    }),

  updateRating: (id: string, data: { rating?: number; comment?: string }) =>
    request<ApiResponse<RatingData>>(`/api/ratings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRating: (id: string) =>
    request<ApiResponse<any>>(`/api/ratings/${id}`, { method: 'DELETE' }),

  getPlaceRatings: (placeId: string, page = 1, limit = 20) =>
    request<PaginatedResponse<RatingData>>(
      `/api/places/${placeId}/ratings?page=${page}&limit=${limit}`
    ),

  // ────── Store Services ──────

  getStoreServices: (storeId: string) =>
    request<ApiResponse<StoreService[]>>(`/api/stores/${storeId}/services`),

  addStoreService: (storeId: string, data: { name: string; description?: string; price?: number }) =>
    request<ApiResponse<StoreService>>(`/api/stores/${storeId}/services`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStoreService: (storeId: string, serviceId: string, data: Record<string, any>) =>
    request<ApiResponse<StoreService>>(`/api/stores/${storeId}/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteStoreService: (storeId: string, serviceId: string) =>
    request<ApiResponse<{ message: string }>>(`/api/stores/${storeId}/services/${serviceId}`, { method: 'DELETE' }),

  // ────── Store Products ──────

  getStoreProducts: (storeId: string) =>
    request<ApiResponse<StoreProduct[]>>(`/api/stores/${storeId}/products`),

  addStoreProduct: (storeId: string, data: { name: string; description?: string; price: number; image_url?: string; stock?: number; main_category?: string | null; sub_category?: string | null; company_name?: string | null }) =>
    request<ApiResponse<StoreProduct>>(`/api/stores/${storeId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStoreProduct: (storeId: string, productId: string, data: Record<string, any>) =>
    request<ApiResponse<StoreProduct>>(`/api/stores/${storeId}/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteStoreProduct: (storeId: string, productId: string) =>
    request<ApiResponse<{ message: string }>>(`/api/stores/${storeId}/products/${productId}`, { method: 'DELETE' }),

  // ────── Orders ──────

  createOrder: (data: { store_id: string; items: { product_id: string; quantity: number }[]; notes?: string }) =>
    request<ApiResponse<Order>>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyOrders: () =>
    request<ApiResponse<Order[]>>('/api/orders/my'),

  getStoreOrders: (storeId: string) =>
    request<ApiResponse<Order[]>>(`/api/orders/store/${storeId}`),

  updateOrderStatus: (orderId: string, status: string) =>
    request<ApiResponse<{ message: string }>>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // ────── Users (admin) ──────

  getUsers: () =>
    request<ApiResponse<UserData[]>>('/api/users'),

  updateUser: (id: string, updates: { role?: string; name?: string; email?: string }) =>
    request<ApiResponse<{ message: string }>>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteUser: (id: string) =>
    request<ApiResponse<{ message: string }>>(`/api/users/${id}`, { method: 'DELETE' }),

  // ────── Reports ──────

  getReports: () =>
    request<ApiResponse<Report[]>>('/api/reports'),

  addReport: (data: { placeId: string; reason: string; details?: string }) =>
    request<ApiResponse<Report>>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateReport: (id: string, updates: { status: string }) =>
    request<ApiResponse<{ message: string }>>(`/api/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // ────── Activity Log ──────

  getActivityLog: () =>
    request<ApiResponse<ActivityLogEntry[]>>('/api/activity-log'),

  // ────── Settings ──────

  getSettings: () =>
    request<ApiResponse<AppSettings>>('/api/settings'),

  updateSettings: (updates: AppSettings) =>
    request<ApiResponse<{ message: string }>>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // ────── Admin ──────

  getAdminStats: () =>
    request<ApiResponse<AdminStats>>('/api/admin/stats'),

  // ────── Store full / owner ──────

  getStoreFull: (storeId: string) =>
    request<ApiResponse<any>>(`/api/stores/${storeId}/full`),

  assignStoreOwner: (storeId: string, ownerId: string | null) =>
    request<ApiResponse<{ message: string }>>(`/api/stores/${storeId}/owner`, {
      method: 'PATCH',
      body: JSON.stringify({ owner_id: ownerId }),
    }),

  getMyStores: () =>
    request<ApiResponse<any[]>>('/api/my-stores'),
};
