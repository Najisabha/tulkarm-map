import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT } from '../../components/MapWrapper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useStores, Store } from '../../context/StoreContext';
import { TULKARM_REGION } from '../../utils/geofencing';

const CATEGORIES = ['تسوق', 'مطاعم', 'صحة', 'خدمات', 'ترفيه', 'تعليم'];
const CATEGORY_EMOJI: Record<string, string> = {
  تسوق: '🛍️',
  مطاعم: '🍽️',
  صحة: '💊',
  خدمات: '🔧',
  ترفيه: '🎭',
  تعليم: '📚',
};

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { stores, addStore, deleteStore } = useStores();

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'تسوق',
    phone: '',
  });

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

  const resetForm = () => {
    setForm({ name: '', description: '', category: 'تسوق', phone: '' });
    setPickedLocation(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    if (!pickedLocation) {
      Alert.alert('تنبيه', 'يرجى تحديد موقع المتجر على الخريطة');
      return;
    }

    setSaving(true);
    await addStore({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      phone: form.phone.trim(),
      latitude: pickedLocation.latitude,
      longitude: pickedLocation.longitude,
    });
    setSaving(false);
    setShowAddModal(false);
    resetForm();
    Alert.alert('✅ تم', 'تمت إضافة المتجر بنجاح!');
  };

  const handleDelete = (store: Store) => {
    Alert.alert(
      'حذف المتجر',
      `هل أنت متأكد من حذف "${store.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await deleteStore(store.id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة الإدارة</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>👑 مدير</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stores.length}</Text>
          <Text style={styles.statLabel}>إجمالي المتاجر</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {new Set(stores.map((s) => s.category)).size}
          </Text>
          <Text style={styles.statLabel}>الفئات</Text>
        </View>
      </View>

      {/* Stores List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>قائمة المتاجر</Text>
        {stores.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🏪</Text>
            <Text style={styles.emptyStateText}>لا توجد متاجر بعد</Text>
          </View>
        ) : (
          stores.map((store) => (
            <View key={store.id} style={styles.storeCard}>
              <View style={styles.storeCardLeft}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(store)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.storeCardInfo}>
                <Text style={styles.storeCardName}>{store.name}</Text>
                <Text style={styles.storeCardDesc}>{store.description}</Text>
                <View style={styles.storeCardMeta}>
                  <Text style={styles.storeCardCategory}>
                    {CATEGORY_EMOJI[store.category]} {store.category}
                  </Text>
                  {store.phone ? (
                    <Text style={styles.storeCardPhone}>📞 {store.phone}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.storeCardEmoji}>
                {CATEGORY_EMOJI[store.category] || '📍'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Store Modal */}
      <Modal visible={showAddModal} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة متجر جديد</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#2E86AB" />
              ) : (
                <Text style={styles.modalSaveText}>حفظ</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>اسم المتجر *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: مطعم الزيتون"
                value={form.name}
                onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                textAlign="right"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الوصف *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="وصف مختصر للمتجر"
                value={form.description}
                onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {/* Phone */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>رقم الهاتف (اختياري)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="09-XXXXXXX"
                value={form.phone}
                onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))}
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الفئة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      form.category === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setForm((p) => ({ ...p, category: cat }))}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        form.category === cat && styles.categoryChipTextActive,
                      ]}
                    >
                      {CATEGORY_EMOJI[cat]} {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Map Picker */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                تحديد الموقع على الخريطة *{' '}
                {pickedLocation ? '✅' : '(اضغط على الخريطة)'}
              </Text>
              <View style={styles.mapPicker}>
                <MapView
                  style={styles.mapPickerMap}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={{
                    latitude: TULKARM_REGION.latitude,
                    longitude: TULKARM_REGION.longitude,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06,
                  }}
                  onPress={(e) =>
                    setPickedLocation(e.nativeEvent.coordinate)
                  }
                >
                  {pickedLocation && (
                    <Marker coordinate={pickedLocation}>
                      <View style={styles.pickedMarker}>
                        <Text style={{ fontSize: 24 }}>
                          {CATEGORY_EMOJI[form.category]}
                        </Text>
                      </View>
                    </Marker>
                  )}
                </MapView>
              </View>
              {pickedLocation && (
                <Text style={styles.coordsText}>
                  📌 {pickedLocation.latitude.toFixed(5)}, {pickedLocation.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statNumber: { fontSize: 30, fontWeight: '800', color: '#2E86AB' },
  statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3A5C',
    textAlign: 'right',
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateEmoji: { fontSize: 50, marginBottom: 12 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
  storeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  storeCardLeft: { marginRight: 10 },
  storeCardInfo: { flex: 1, alignItems: 'flex-end' },
  storeCardName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  storeCardDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  storeCardMeta: { flexDirection: 'row', marginTop: 6, gap: 10 },
  storeCardCategory: { fontSize: 12, color: '#2E86AB', fontWeight: '600' },
  storeCardPhone: { fontSize: 12, color: '#6B7280' },
  storeCardEmoji: { fontSize: 28, marginLeft: 12 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  fab: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E86AB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: '#F0F4F8' },
  modalHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '700' },
  modalSaveText: { color: '#2E86AB', fontSize: 16, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 20 },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  formTextarea: {
    height: 90,
    paddingTop: 12,
  },
  categoryChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2E86AB',
  },
  categoryChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  mapPicker: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  mapPickerMap: { flex: 1 },
  pickedMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  coordsText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 6,
  },
});
