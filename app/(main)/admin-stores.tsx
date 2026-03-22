import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useStores, Store } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { TULKARM_REGION } from '../../constants/tulkarmRegion';
import { shadow } from '../../utils/shadowStyles';

function catEmoji(cats: { name: string; emoji: string }[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '📍';
}

export default function AdminStoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { stores, addStore, updateStore, deleteStore } = useStores();

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', phone: '', lat: '', lng: '' });
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: categories[0]?.name ?? 'تسوق',
    phone: '',
    lat: String(TULKARM_REGION.latitude),
    lng: String(TULKARM_REGION.longitude),
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

  const defaultCategory = categories[0]?.name ?? 'تسوق';

  const resetForm = () => {
    setForm({ name: '', description: '', category: defaultCategory, phone: '', lat: String(TULKARM_REGION.latitude), lng: String(TULKARM_REGION.longitude) });
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('تنبيه', 'يرجى إدخال إحداثيات صحيحة');
      return;
    }
    setSaving(true);
    await addStore({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      phone: form.phone.trim() || undefined,
      latitude: lat,
      longitude: lng,
    });
    setSaving(false);
    setShowAddModal(false);
    resetForm();
    Alert.alert('✅ تم', 'تمت إضافة المتجر بنجاح!');
  };

  const openEdit = (store: Store) => {
    setEditingStore(store);
    setEditForm({
      name: store.name,
      description: store.description,
      category: store.category,
      phone: store.phone ?? '',
      lat: String(store.latitude),
      lng: String(store.longitude),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStore) return;
    if (!editForm.name.trim() || !editForm.description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    const lat = parseFloat(editForm.lat);
    const lng = parseFloat(editForm.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('تنبيه', 'يرجى إدخال إحداثيات صحيحة');
      return;
    }
    await updateStore(editingStore.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      category: editForm.category,
      phone: editForm.phone.trim() || undefined,
      latitude: lat,
      longitude: lng,
    });
    setEditingStore(null);
    Alert.alert('✅ تم', 'تم تحديث بيانات المتجر');
  };

  const handleDelete = (store: Store) => {
    Alert.alert('حذف المتجر', `هل أنت متأكد من حذف "${store.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { await deleteStore(store.id); setEditingStore(null); Alert.alert('تم', 'تم حذف المتجر'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة المتاجر</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{stores.length} متجر</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>قائمة المتاجر</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowAddModal(true); resetForm(); }}>
            <Text style={styles.addBtnText}>+ إضافة متجر</Text>
          </TouchableOpacity>
        </View>

        {stores.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🏪</Text>
            <Text style={styles.emptyStateText}>لا توجد متاجر بعد</Text>
            <TouchableOpacity style={styles.emptyStateBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyStateBtnText}>إضافة أول متجر</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {stores.map((store) => (
              <TouchableOpacity key={store.id} style={styles.storeCard} onPress={() => openEdit(store)} activeOpacity={0.7}>
                <View style={styles.storeCardInfo}>
                  <Text style={styles.storeCardName}>{store.name}</Text>
                  <Text style={styles.storeCardDesc}>{store.description}</Text>
                  <View style={styles.storeCardMeta}>
                    <Text style={styles.storeCardCategory}>{catEmoji(categories, store.category)} {store.category}</Text>
                    {store.phone ? <Text style={styles.storeCardPhone}>📞 {store.phone}</Text> : null}
                  </View>
                </View>
                <Text style={styles.storeCardEmoji}>{catEmoji(categories, store.category)}</Text>
                <Text style={styles.editHint}>✏️ تعديل</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة متجر جديد</Text>
            <TouchableOpacity onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#2E86AB" /> : <Text style={styles.modalSaveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>اسم المتجر *</Text>
              <TextInput style={styles.formInput} placeholder="مثال: مطعم الزيتون" value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} textAlign="right" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الوصف *</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} placeholder="وصف مختصر" value={form.description} onChangeText={(t) => setForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>رقم الهاتف</Text>
              <TextInput style={styles.formInput} placeholder="09-XXXXXXX" value={form.phone} onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))} keyboardType="phone-pad" textAlign="right" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الفئة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={[styles.categoryChip, form.category === cat.name && styles.categoryChipActive]} onPress={() => setForm((p) => ({ ...p, category: cat.name }))}>
                    <Text style={[styles.categoryChipText, form.category === cat.name && styles.categoryChipTextActive]}>{cat.emoji} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الإحداثيات</Text>
              <View style={styles.coordsRow}>
                <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط العرض" value={form.lat} onChangeText={(t) => setForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط الطول" value={form.lng} onChangeText={(t) => setForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editingStore} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingStore(null)}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل البيانات</Text>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={styles.modalSaveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
          {editingStore && (
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>اسم المتجر *</Text>
                <TextInput style={styles.formInput} value={editForm.name} onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))} textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الوصف *</Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={editForm.description} onChangeText={(t) => setEditForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>رقم الهاتف</Text>
                <TextInput style={styles.formInput} value={editForm.phone} onChangeText={(t) => setEditForm((p) => ({ ...p, phone: t }))} keyboardType="phone-pad" textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الفئة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat.id} style={[styles.categoryChip, editForm.category === cat.name && styles.categoryChipActive]} onPress={() => setEditForm((p) => ({ ...p, category: cat.name }))}>
                      <Text style={[styles.categoryChipText, editForm.category === cat.name && styles.categoryChipTextActive]}>{cat.emoji} {cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الإحداثيات</Text>
                <View style={styles.coordsRow}>
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط العرض" value={editForm.lat} onChangeText={(t) => setEditForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط الطول" value={editForm.lng} onChangeText={(t) => setEditForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
                </View>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => editingStore && handleDelete(editingStore)}>
                <Text style={styles.deleteBtnText}>🗑️ حذف المتجر</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
  header: { backgroundColor: '#1A3A5C', paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  headerBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  addBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16 },
  emptyStateBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyStateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  storeCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'center', ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.07, radius: 6, elevation: 2 }) },
  storeCardInfo: { flex: 1, alignItems: 'flex-end' },
  storeCardName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  storeCardDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  storeCardMeta: { flexDirection: 'row', marginTop: 6, gap: 10 },
  storeCardCategory: { fontSize: 12, color: '#2E86AB', fontWeight: '600' },
  storeCardPhone: { fontSize: 12, color: '#6B7280' },
  storeCardEmoji: { fontSize: 28, marginLeft: 12 },
  editHint: { fontSize: 12, color: '#2E86AB', fontWeight: '600', marginLeft: 6 },
  modalContainer: { flex: 1, backgroundColor: '#F0F4F8' },
  modalHeader: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '700' },
  modalSaveText: { color: '#2E86AB', fontSize: 16, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'right', marginBottom: 8 },
  formInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1F2937', borderWidth: 1.5, borderColor: '#E5E7EB' },
  formTextarea: { height: 90, paddingTop: 12 },
  categoryChip: { backgroundColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  categoryChipActive: { backgroundColor: '#2E86AB' },
  categoryChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  coordsRow: { flexDirection: 'row', gap: 10 },
  coordInput: { flex: 1 },
  deleteBtn: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  deleteBtnText: { fontSize: 15, color: '#DC2626', fontWeight: '700' },
});
