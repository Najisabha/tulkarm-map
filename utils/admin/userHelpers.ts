export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  created_at: string;
}

export const DEFAULT_ADMIN_EMAIL = 'admin@tulkarm.com';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isDefaultAdminEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === DEFAULT_ADMIN_EMAIL;
}

export function normalizeApiUser(u: Partial<ApiUser>): ApiUser {
  const role = String(u.role || 'user');
  const email = String(u.email || '').trim().toLowerCase();
  const isAdmin = role === 'admin' || isDefaultAdminEmail(email) || u.isAdmin === true;
  return {
    id: String(u.id || ''),
    name: String(u.name || ''),
    email,
    role,
    isAdmin,
    created_at: String(u.created_at || ''),
  };
}

export function filterUsersByQuery(users: ApiUser[], query: string): ApiUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
}

export function userBadgeCount(n: number): string {
  if (n === 0) return 'لا مستخدمين';
  if (n === 1) return 'مستخدم واحد';
  if (n === 2) return 'مستخدمان';
  if (n >= 3 && n <= 10) return `${n} مستخدمين`;
  return `${n} مستخدماً`;
}

export function avatarLetter(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}
