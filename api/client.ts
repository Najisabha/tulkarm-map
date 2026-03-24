import { API_URL } from './config';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || data?.error || 'خطأ في الاتصال');
  }
  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ success: boolean; message?: string; user?: object }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ success: boolean; message?: string; user?: object }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  health: () => request<{ ok: boolean }>('/api/health'),

  // Categories
  getCategories: () => request<{ id: string; name: string; emoji: string; color: string }[]>('/api/categories'),
  addCategory: (cat: { name: string; emoji?: string; color?: string }) =>
    request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    }),
  updateCategory: (id: string, updates: { name?: string; emoji?: string; color?: string }) =>
    request(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteCategory: (id: string) =>
    request(`/api/categories/${id}`, { method: 'DELETE' }),
  updateStoresCategory: (oldName: string, newName: string) =>
    request('/api/stores/update-category', {
      method: 'POST',
      body: JSON.stringify({ oldName, newName }),
    }),
  updatePlaceRequestsCategory: (oldName: string, newName: string) =>
    request('/api/place-requests/update-category', {
      method: 'POST',
      body: JSON.stringify({ oldName, newName }),
    }),

  // Stores
  getStores: () =>
    request<
      {
        id: string;
        name: string;
        description: string;
        category: string;
        latitude: number;
        longitude: number;
        phone?: string;
        photos?: string[];
        videos?: string[];
        createdAt: string;
      }[]
    >('/api/stores'),
  addStore: (store: {
    name: string;
    description: string;
    category: string;
    latitude: number;
    longitude: number;
    phone?: string;
    photos?: string[];
    videos?: string[];
  }) =>
    request('/api/stores', {
      method: 'POST',
      body: JSON.stringify(store),
    }),
  updateStore: (
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      category: string;
      latitude: number;
      longitude: number;
      phone: string;
      photos: string[];
      videos: string[];
    }>
  ) =>
    request(`/api/stores/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteStore: (id: string) =>
    request(`/api/stores/${id}`, { method: 'DELETE' }),

  // Place Requests
  getPlaceRequests: () =>
    request<
      {
        id: string;
        name: string;
        description: string;
        category: string;
        latitude: number;
        longitude: number;
        phone?: string;
        photos?: string[];
        videos?: string[];
        status: string;
        createdAt: string;
      }[]
    >('/api/place-requests'),
  addPlaceRequest: (req: {
    name: string;
    description: string;
    category: string;
    latitude: number;
    longitude: number;
    phone?: string;
    photos?: string[];
    videos?: string[];
  }) =>
    request('/api/place-requests', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  updatePlaceRequest: (
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      category: string;
      latitude: number;
      longitude: number;
      phone: string;
      photos: string[];
      videos: string[];
    }>
  ) =>
    request(`/api/place-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  acceptPlaceRequest: (id: string, overrides?: object) =>
    request(`/api/place-requests/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(overrides || {}),
    }),
  rejectPlaceRequest: (id: string) =>
    request(`/api/place-requests/${id}/reject`, {
      method: 'POST',
    }),
  deletePlaceRequest: (id: string) =>
    request(`/api/place-requests/${id}`, { method: 'DELETE' }),

  // Users (admin)
  getUsers: () =>
    request<{ id: string; name: string; email: string; isAdmin: boolean; createdAt: string }[]>('/api/users'),
  updateUser: (id: string, updates: { isAdmin?: boolean }) =>
    request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteUser: (id: string) =>
    request(`/api/users/${id}`, { method: 'DELETE' }),

  // Reports
  getReports: () =>
    request<{ id: string; storeId: string; storeName: string; reason: string; details: string; status: string; createdAt: string }[]>('/api/reports'),
  addReport: (data: { storeId: string; reason: string; details?: string }) =>
    request('/api/reports', { method: 'POST', body: JSON.stringify(data) }),
  updateReport: (id: string, updates: { status: string }) =>
    request(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  // Activity log
  getActivityLog: () =>
    request<{ id: string; action: string; entityType: string; entityId: string; details: object; createdAt: string }[]>('/api/activity-log'),

  // Settings
  getSettings: () =>
    request<{ maintenance_mode?: boolean; welcome_message?: string }>('/api/settings'),
  updateSettings: (updates: { maintenance_mode?: boolean; welcome_message?: string }) =>
    request('/api/settings', { method: 'PATCH', body: JSON.stringify(updates) }),

  // Admin stats
  getAdminStats: () =>
    request<{
      users: number;
      stores: number;
      categories: number;
      pendingPlaceRequests: number;
      pendingReports: number;
      storesThisMonth: number;
      requestsThisWeek: number;
    }>('/api/admin/stats'),

  // Export / Import
  exportData: (format?: 'json' | 'csv') =>
    request<string | object[]>(`/api/admin/export?format=${format || 'json'}`),
  importStores: (items: { name: string; description?: string; category: string; latitude?: number; longitude?: number; phone?: string; photos?: string[]; videos?: string[] }[]) =>
    request<{ success: boolean; created: number }>('/api/admin/import', { method: 'POST', body: JSON.stringify(items) }),
};
