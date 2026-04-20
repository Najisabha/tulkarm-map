/**
 * منطق شاشة إعدادات الإدارة: تحميل الإعدادات وحفظها.
 * يُبقي ملف الشاشة بسيطاً ومركزاً على العرض.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../../api/client';

export const DEFAULT_WELCOME_MESSAGE = 'مرحباً بكم في خريطة طولكرم';

export function useAdminSettings() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      const s = res.data || {};
      setMaintenanceMode(s.maintenance_mode === true);
      setWelcomeMessage(
        typeof s.welcome_message === 'string' ? s.welcome_message : DEFAULT_WELCOME_MESSAGE,
      );
    } catch {
      setWelcomeMessage(DEFAULT_WELCOME_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        maintenance_mode: maintenanceMode,
        welcome_message: welcomeMessage.trim() || DEFAULT_WELCOME_MESSAGE,
      });
      Alert.alert('✅ تم', 'تم حفظ الإعدادات');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }, [maintenanceMode, welcomeMessage]);

  return {
    maintenanceMode,
    setMaintenanceMode,
    welcomeMessage,
    setWelcomeMessage,
    loading,
    saving,
    saveSettings,
  };
}

