import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AdminLoadingBlock } from '../../components/admin/AdminLoadingBlock';
import { adminSettingsStyles as styles } from '../../components/admin/AdminSettings.styles';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useAdminSettings, DEFAULT_WELCOME_MESSAGE } from '../../hooks/admin/useAdminSettings';
import { useAuthStore } from '../../stores/useAuthStore';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const settings = useAdminSettings();

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader title="الإعدادات" onBack={() => router.back()} />

      <ScrollView style={styles.content}>
        {settings.loading ? (
          <AdminLoadingBlock message="جاري التحميل..." />
        ) : (
          <>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>وضع الصيانة</Text>
              <Switch
                value={settings.maintenanceMode}
                onValueChange={settings.setMaintenanceMode}
                trackColor={{ false: '#E5E7EB', true: '#2E86AB' }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.settingHint}>
              عند التفعيل، قد يُعرض للمستخدمين رسالة أن التطبيق قيد الصيانة (يتطلب دعم من الواجهة)
            </Text>

            <Text style={styles.settingLabel}>رسالة الترحيب</Text>
            <TextInput
              style={styles.textInput}
              placeholder={DEFAULT_WELCOME_MESSAGE}
              placeholderTextColor="#9CA3AF"
              value={settings.welcomeMessage}
              onChangeText={settings.setWelcomeMessage}
              multiline
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.saveBtn, settings.saving && styles.saveBtnDisabled]}
              onPress={settings.saveSettings}
              disabled={settings.saving}
            >
              <Text style={styles.saveBtnText}>
                {settings.saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
