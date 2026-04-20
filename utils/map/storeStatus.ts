/**
 * مساعدات لحالة المكان (من منظور الخريطة ولوحة الإدارة).
 * الهدف: تجميع شرط \"منشور/مفعّل\" في مكان واحد بدل تكراره.
 */

type StoreLikeStatus = { status?: string | null };

export function isActiveStore(store: StoreLikeStatus): boolean {
  return String(store.status || '').toLowerCase() === 'active';
}

export function isPendingStore(store: StoreLikeStatus): boolean {
  return String(store.status || '').toLowerCase() === 'pending';
}

