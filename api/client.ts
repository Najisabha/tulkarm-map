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
};
