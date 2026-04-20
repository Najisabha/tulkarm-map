/**
 * منطق شاشة إدارة المستخدمين: تحميل، بحث، تعديل، ترقية، وحذف.
 * الهدف إبقاء الشاشة مركّزة على العرض فقط.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ApiResponse, loadTokens, type UserData } from '../../api/client';
import { confirmAction, showMessage } from '../../utils/admin/feedback';
import {
  EMAIL_RE,
  filterUsersByQuery,
  isDefaultAdminEmail,
  normalizeApiUser,
  type ApiUser,
} from '../../utils/admin/userHelpers';

export function useAdminUsers(params: { isAdmin: boolean; authLoading: boolean }) {
  const { isAdmin, authLoading } = params;

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const closeEdit = useCallback(() => {
    setEditUser(null);
    setEditName('');
    setEditEmail('');
    setSavingEdit(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      await loadTokens();
      const res = (await api.getUsers()) as ApiResponse<UserData[]> & { users?: UserData[] };
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(res.users) ? res.users : [];
      setUsers(raw.map((u) => normalizeApiUser(u as ApiUser)));
    } catch (e: unknown) {
      setUsers([]);
      setLoadError(e instanceof Error ? e.message : 'فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void loadUsers();
  }, [authLoading, isAdmin, loadUsers]);

  const openEdit = useCallback((u: ApiUser) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editUser) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    if (!name) {
      showMessage('تنبيه', 'يرجى إدخال الاسم');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showMessage('تنبيه', 'صيغة البريد غير صحيحة');
      return;
    }
    const isDefault = isDefaultAdminEmail(editUser.email);
    const payload: { name?: string; email?: string } = {};
    if (name !== editUser.name) payload.name = name;
    if (!isDefault && email !== editUser.email.toLowerCase()) payload.email = email;
    if (isDefault && email !== editUser.email.toLowerCase()) {
      showMessage('تنبيه', 'لا يمكن تغيير بريد المدير الافتراضي');
      return;
    }
    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateUser(editUser.id, payload);
      setUsers((prev) =>
        prev.map((x) => (x.id === editUser.id ? { ...x, name, email: isDefault ? x.email : email } : x)),
      );
      showMessage('تم', 'تم حفظ التعديلات');
      closeEdit();
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSavingEdit(false);
    }
  }, [closeEdit, editEmail, editName, editUser]);

  const toggleAdmin = useCallback(async (u: ApiUser) => {
    if (isDefaultAdminEmail(u.email)) return;
    try {
      const newRole = u.isAdmin ? 'user' : 'admin';
      await api.updateUser(u.id, { role: newRole });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole, isAdmin: newRole === 'admin' } : x)),
      );
      showMessage('تم', u.isAdmin ? 'تم إلغاء صلاحية المدير' : 'تم ترقية المستخدم لمدير');
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل التحديث');
    }
  }, []);

  const handleDelete = useCallback(async (u: ApiUser) => {
    if (isDefaultAdminEmail(u.email)) {
      showMessage('تنبيه', 'لا يمكن حذف حساب المدير الافتراضي');
      return;
    }
    const ok = await confirmAction('حذف المستخدم', `حذف "${u.name}" نهائياً؟`);
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      showMessage('تم', 'تم حذف المستخدم');
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل الحذف');
    }
  }, []);

  const filteredUsers = useMemo(() => filterUsersByQuery(users, searchQuery), [users, searchQuery]);

  return {
    users,
    filteredUsers,
    loading,
    loadError,
    searchQuery,
    setSearchQuery,
    loadUsers,
    editUser,
    editName,
    setEditName,
    editEmail,
    setEditEmail,
    savingEdit,
    openEdit,
    closeEdit,
    saveEdit,
    toggleAdmin,
    handleDelete,
  };
}

