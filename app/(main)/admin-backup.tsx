import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { getApiUrl } from '../../api/config';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { useStores } from '../../context/StoreContext';

export default function AdminBackupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshStores } = useStores();
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const res = await api.getPlaces({ limit: 500 });
      const data = res.data || [];
      const str = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(str);
        Alert.alert('✅ تم', 'تم نسخ البيانات للحافظة');
      } else {
        Alert.alert('✅ تم', `تم تصدير ${data.length} مكان`);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل التصدير');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    const url = `${getApiUrl()}/api/admin/export?format=csv`;
    if (Platform.OS === 'web') {
      (window as any).open(url, '_blank');
      Alert.alert('✅ تم', 'تم فتح ملف CSV في تبويب جديد');
    } else {
      Linking.openURL(url);
      Alert.alert('✅ تم', 'تم فتح رابط التصدير');
    }
  };

  const handleImport = async () => {
    const trimmed = importJson.trim();
    if (!trimmed) {
      Alert.alert('تنبيه', 'الصق بيانات JSON للمتاجر');
      return;
    }
    let items: any[];
    try {
      items = JSON.parse(trimmed);
      if (!Array.isArray(items)) items = [items];
    } catch {
      Alert.alert('خطأ', 'صيغة JSON غير صحيحة');
      return;
    }
    setImporting(true);
    try {
      let created = 0;
      for (const item of items) {
        await api.createPlaceFromAdmin({
          name: item.name,
          description: item.description,
          type_id: item.type_id,
          latitude: item.latitude || 32.31,
          longitude: item.longitude || 35.02,
        });
        created++;
      }
      await refreshStores();
      setImportJson('');
      Alert.alert('✅ تم', `تم استيراد ${created} مكان`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الاستيراد');
    } finally {
      setImporting(false);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>النسخ الاحتياطي والاستيراد</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>تصدير</Text>
        <TouchableOpacity
          style={[styles.btn, styles.btnExport, exporting && styles.btnDisabled]}
          onPress={handleExportJson}
          disabled={exporting}
        >
          <Text style={styles.btnText}>{exporting ? 'جاري التصدير...' : '📥 تصدير JSON'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnExport]} onPress={handleExportCsv}>
          <Text style={styles.btnText}>📥 تصدير CSV</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>استيراد</Text>
        <Text style={styles.hint}>الصق مصفوفة JSON من المتاجر. كل عنصر: name, description, category, latitude?, longitude?, phone?</Text>
        <TextInput
          style={styles.textArea}
          placeholder='[{"name":"متجر 1","description":"وصف","category":"تسوق","latitude":32.31,"longitude":35.03}]'
          placeholderTextColor="#9CA3AF"
          value={importJson}
          onChangeText={setImportJson}
          multiline
          textAlign="right"
        />
        <TouchableOpacity
          style={[styles.btn, styles.btnImport, importing && styles.btnDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          <Text style={styles.btnText}>{importing ? 'جاري الاستيراد...' : '📤 استيراد'}</Text>
        </TouchableOpacity>
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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12, textAlign: 'right' },
  hint: { fontSize: 13, color: '#6B7280', marginBottom: 8, textAlign: 'right' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnExport: { backgroundColor: '#2E86AB' },
  btnImport: { backgroundColor: '#10B981' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 120,
    marginBottom: 16,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
