/**
 * تهيئة مشتركة بين الشاشات:
 * - تشغيل init للمصادقة (جلب المستخدم/التوكن إن وجد)
 * - تحميل الأماكن من الخادم (مع خيار تحميل بيانات الإدارة)
 */
 
import { useEffect } from 'react';
import type { AuthUser } from '../stores/useAuthStore';
 
export function useAuthPlacesBootstrap(params: {
  init: () => Promise<void>;
  loadAll: (isAdmin?: boolean) => Promise<void>;
  /** إن كانت قيمة isAdmin غير محسومة بعد، يمكن تمرير user. */
  user?: AuthUser | null;
  /** تحميل كل الأماكن بصلاحيات مدير بشكل ثابت. */
  forceAdmin?: boolean;
}) {
  const { init, loadAll, user, forceAdmin } = params;
 
  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  useEffect(() => {
    const asAdmin = forceAdmin ?? (user?.role === 'admin' || user?.isAdmin === true);
    void loadAll(asAdmin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.isAdmin, forceAdmin]);
}

