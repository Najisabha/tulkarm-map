/**
 * منطق شاشة إدارة المستخدمين: تحميل، بحث، تعديل، ترقية، وحذف.
 * الهدف إبقاء الشاشة مركّزة على العرض فقط.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { api, type ApiResponse, loadTokens, type UserData } from '../../api/client';
import { confirmAction, showMessage } from '../../utils/admin/feedback';
import {
  EMAIL_RE,
  filterUsersByQuery,
  isDefaultAdminEmail,
  normalizeApiUser,
  type ApiUser,
} from '../../utils/admin/userHelpers';

type VerificationStatus = 'verified' | 'pending' | 'rejected';

export function useAdminUsers(params: { isAdmin: boolean; authLoading: boolean }) {
  const { isAdmin, authLoading } = params;

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editProfileImageUrl, setEditProfileImageUrl] = useState<string | null>(null);
  const [editIdCardImageUrl, setEditIdCardImageUrl] = useState<string | null>(null);
  const [editVerificationStatus, setEditVerificationStatus] = useState<VerificationStatus>('pending');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [uploadingIdCardImage, setUploadingIdCardImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const closeEdit = useCallback(() => {
    setEditUser(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
    setEditDateOfBirth('');
    setEditProfileImageUrl(null);
    setEditIdCardImageUrl(null);
    setEditVerificationStatus('pending');
    setEditNewPassword('');
    setEditConfirmPassword('');
    setUploadingProfileImage(false);
    setUploadingIdCardImage(false);
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
    const rawDob = String(u.dateOfBirth || '').trim();
    const normalizedDob = (() => {
      const m = rawDob.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : rawDob;
    })();
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phoneNumber || '');
    setEditDateOfBirth(normalizedDob);
    setEditProfileImageUrl(u.profileImageUrl || null);
    setEditIdCardImageUrl(u.idCardImageUrl || null);
    setEditVerificationStatus(((u.verificationStatus || 'pending') as VerificationStatus));
    setEditNewPassword('');
    setEditConfirmPassword('');
  }, []);

  const pickAndUploadImage = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showMessage('تنبيه', 'يجب منح إذن الوصول للصور');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;

    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const upload = await api.uploadBase64(`data:${mime};base64,${asset.base64}`);
    return upload?.data?.url || null;
  }, []);

  const uploadEditProfileImage = useCallback(async () => {
    try {
      setUploadingProfileImage(true);
      const url = await pickAndUploadImage();
      if (url) setEditProfileImageUrl(url);
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل رفع صورة الملف الشخصي');
    } finally {
      setUploadingProfileImage(false);
    }
  }, [pickAndUploadImage]);

  const uploadEditIdCardImage = useCallback(async () => {
    try {
      setUploadingIdCardImage(true);
      const url = await pickAndUploadImage();
      if (url) setEditIdCardImageUrl(url);
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل رفع صورة الهوية');
    } finally {
      setUploadingIdCardImage(false);
    }
  }, [pickAndUploadImage]);

  const changeVerificationStatus = useCallback(
    async (status: VerificationStatus) => {
      setEditVerificationStatus(status);
      if (!editUser) return;

      const current = (editUser.verificationStatus || 'pending') as VerificationStatus;
      if (status === current) return;

      try {
        setSavingEdit(true);
        await api.updateUser(editUser.id, { verification_status: status });
        setEditUser((prev) => (prev ? { ...prev, verificationStatus: status } : prev));
        setUsers((prev) => prev.map((x) => (x.id === editUser.id ? { ...x, verificationStatus: status } : x)));
      } catch (e: unknown) {
        setEditVerificationStatus(current);
        showMessage('خطأ', e instanceof Error ? e.message : 'فشل تحديث حالة الحساب');
      } finally {
        setSavingEdit(false);
      }
    },
    [editUser],
  );

  const saveEdit = useCallback(async () => {
    if (!editUser) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    const phone = editPhone.trim();
    const dateOfBirth = editDateOfBirth.trim();
    if (!name) {
      showMessage('تنبيه', 'يرجى إدخال الاسم');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showMessage('تنبيه', 'صيغة البريد غير صحيحة');
      return;
    }
    if (phone && !/^[0-9+\-\s()]*$/.test(phone)) {
      showMessage('تنبيه', 'صيغة رقم الهاتف غير صحيحة');
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      showMessage('تنبيه', 'صيغة تاريخ الميلاد يجب أن تكون YYYY-MM-DD');
      return;
    }
    const isDefault = isDefaultAdminEmail(editUser.email);
    const payload: {
      name?: string;
      email?: string;
      phone_number?: string | null;
      date_of_birth?: string | null;
      profile_image_url?: string | null;
      id_card_image_url?: string | null;
      verification_status?: VerificationStatus;
    } = {};
    if (name !== editUser.name) payload.name = name;
    if (!isDefault && email !== editUser.email.toLowerCase()) payload.email = email;
    if (isDefault && email !== editUser.email.toLowerCase()) {
      showMessage('تنبيه', 'لا يمكن تغيير بريد المدير الافتراضي');
      return;
    }
    if (phone !== (editUser.phoneNumber || '')) payload.phone_number = phone || null;
    if (dateOfBirth !== (editUser.dateOfBirth || '')) payload.date_of_birth = dateOfBirth || null;
    if ((editProfileImageUrl || null) !== (editUser.profileImageUrl || null)) {
      payload.profile_image_url = editProfileImageUrl || null;
    }
    if ((editIdCardImageUrl || null) !== (editUser.idCardImageUrl || null)) {
      payload.id_card_image_url = editIdCardImageUrl || null;
    }
    if (editVerificationStatus !== (editUser.verificationStatus || 'pending')) {
      payload.verification_status = editVerificationStatus;
    }

    if (editNewPassword || editConfirmPassword) {
      if (editNewPassword.length < 6) {
        showMessage('تنبيه', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        return;
      }
      if (editNewPassword !== editConfirmPassword) {
        showMessage('تنبيه', 'تأكيد كلمة المرور غير مطابق');
        return;
      }
    }

    if (Object.keys(payload).length === 0) {
      if (!editNewPassword) {
        closeEdit();
        return;
      }
    }
    setSavingEdit(true);
    try {
      if (Object.keys(payload).length > 0) {
        await api.updateUser(editUser.id, payload);
      }
      if (editNewPassword) {
        await api.updateUserPassword(editUser.id, editNewPassword);
      }
      setUsers((prev) =>
        prev.map((x) =>
          x.id === editUser.id
            ? {
                ...x,
                name,
                email: isDefault ? x.email : email,
                phoneNumber: phone || null,
                dateOfBirth: dateOfBirth || null,
                profileImageUrl: editProfileImageUrl || null,
                idCardImageUrl: editIdCardImageUrl || null,
                verificationStatus: editVerificationStatus,
              }
            : x,
        ),
      );
      showMessage('تم', 'تم حفظ التعديلات');
      closeEdit();
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSavingEdit(false);
    }
  }, [
    closeEdit,
    editConfirmPassword,
    editDateOfBirth,
    editEmail,
    editIdCardImageUrl,
    editName,
    editNewPassword,
    editPhone,
    editProfileImageUrl,
    editUser,
    editVerificationStatus,
  ]);

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
    editPhone,
    setEditPhone,
    editDateOfBirth,
    setEditDateOfBirth,
    editProfileImageUrl,
    setEditProfileImageUrl,
    editIdCardImageUrl,
    setEditIdCardImageUrl,
    editVerificationStatus,
    setEditVerificationStatus,
    changeVerificationStatus,
    editNewPassword,
    setEditNewPassword,
    editConfirmPassword,
    setEditConfirmPassword,
    uploadEditProfileImage,
    uploadEditIdCardImage,
    uploadingProfileImage,
    uploadingIdCardImage,
    savingEdit,
    openEdit,
    closeEdit,
    saveEdit,
    toggleAdmin,
    handleDelete,
  };
}

