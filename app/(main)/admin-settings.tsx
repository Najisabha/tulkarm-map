import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { USE_API } from '../../api/config';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (USE_API) loadSettings();
    else setLoading(false);
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setMaintenanceMode(s.maintenance_mode === true);
      setWelcomeMessage(typeof s.welcome_message === 'string' ? s.welcome_message : 'مرحباً بكم في خريطة طولكرم');
    } catch {
      setWelcomeMessage('مرحباً بكم في خريطة طولكرم');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        maintenance_mode: maintenanceMode,
        welcome_message: welcomeMessage.trim() || 'مرحباً بكم في خريطة طولكرم',
      });
      Alert.alert('✅ تم', 'تم حفظ الإعدادات');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>⛔ غير مصرح لك بالوصول</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!USE_API) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الإعدادات</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>يتطلب اتصال الخادم</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعدادات</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        ) : (
          <>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>وضع الصيانة</Text>
              <Switch
                value={maintenanceMode}
                onValueChange={setMaintenanceMode}
                trackColor={{ false: '#E5E7EB', true: '#2E86AB' }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.settingHint}>عند التفعيل، قد يُعرض للمستخدمين رسالة أن التطبيق قيد الصيانة (يتطلب دعم من الواجهة)</Text>

            <Text style={styles.settingLabel}>رسالة الترحيب</Text>
            <TextInput
              style={styles.textInput}
              placeholder="مرحباً بكم في خريطة طولكرم"
              placeholderTextColor="#9CA3AF"
              value={welcomeMessage}
              onChangeText={setWelcomeMessage}
              multiline
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveSettings}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: {
    backgroundColor: '#1A3A5C',
    paddingTop: LAYOUT.headerTop,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  content: { flex: 1, padding: 16 },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 8, textAlign: 'right' },
  settingHint: { fontSize: 12, color: '#9CA3AF', marginBottom: 16, textAlign: 'right' },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 80,
    marginBottom: 24,
  },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
