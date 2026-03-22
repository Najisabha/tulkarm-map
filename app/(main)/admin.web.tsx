import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useStores, Store, PlaceRequest } from '../../context/StoreContext';
import { useCategories, Category } from '../../context/CategoryContext';
import { TULKARM_REGION } from '../../utils/geofencing.web';
import { shadow } from '../../utils/shadowStyles';
import { PRESET_COLORS } from '../../constants/categoryColors';

function catEmoji(categories: { name: string; emoji: string }[], name: string) {
  return categories.find((c) => c.name === name)?.emoji || '📍';
}

export default function AdminScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user } = useAuth();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { stores, placeRequests, addStore, updateStore, deleteStore, updateStoresCategory, updatePlaceRequestsCategory, acceptPlaceRequest, rejectPlaceRequest } = useStores();
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '📍', color: '#2E86AB' });

  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({ name: '', description: '', category: '', phone: '', lat: '', lng: '' });

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'تسوق',
    phone: '',
    lat: String(TULKARM_REGION.latitude),
    lng: String(TULKARM_REGION.longitude),
  });

  const defaultCategory = categories[0]?.name ?? 'تسوق';

  useEffect(() => {
    if (!user?.isAdmin) return;
    const id = params.editStoreId;
    if (id && stores.length > 0) {
      const store = stores.find((s) => s.id === id);
      if (store) {
        setEditingStore(store);
        setEditStoreForm({
          name: store.name,
          description: store.description,
          category: store.category,
          phone: store.phone ?? '',
          lat: String(store.latitude),
          lng: String(store.longitude),
        });
        router.setParams({ editStoreId: undefined });
      }
    }
  }, [user?.isAdmin, params.editStoreId, stores]);

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

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', emoji: '📍', color: '#2E86AB' });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, emoji: cat.emoji, color: cat.color });
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('تنبيه', 'أدخل اسم الفئة');
      return;
    }
    if (editingCategory) {
      const oldName = editingCategory.name;
      const newName = categoryForm.name.trim();
      await updateCategory(editingCategory.id, { name: newName, emoji: categoryForm.emoji || '📍', color: categoryForm.color });
      if (oldName !== newName) {
        await updateStoresCategory(oldName, newName);
        await updatePlaceRequestsCategory(oldName, newName);
      }
      Alert.alert('✅ تم', 'تم تحديث الفئة');
    } else {
      if (categories.some((c) => c.name === categoryForm.name.trim())) {
        Alert.alert('تنبيه', 'الفئة موجودة مسبقاً');
        return;
      }
      await addCategory({ name: categoryForm.name.trim(), emoji: categoryForm.emoji || '📍', color: categoryForm.color });
      Alert.alert('✅ تم', 'تمت إضافة الفئة');
    }
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = async (cat: Category) => {
    const storeCount = stores.filter((s) => s.category === cat.name).length;
    const reqCount = placeRequests.filter((r) => r.category === cat.name).length;
    if (storeCount > 0 || reqCount > 0) {
      Alert.alert('لا يمكن الحذف', `هذه الفئة مستخدمة في ${storeCount} متجر و${reqCount} طلب. غيّر تصنيفها أولاً ثم احذف.`);
      return;
    }
    const result = await deleteCategory(cat.id);
    if (result.success) Alert.alert('✅ تم', 'تم حذف الفئة');
    else Alert.alert('تنبيه', result.message);
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', category: defaultCategory, phone: '',
      lat: String(TULKARM_REGION.latitude),
      lng: String(TULKARM_REGION.longitude),
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    const latitude = parseFloat(form.lat);
    const longitude = parseFloat(form.lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert('تنبيه', 'يرجى إدخال إحداثيات صحيحة');
      return;
    }
    setSaving(true);
    await addStore({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      phone: form.phone.trim(),
      latitude,
      longitude,
    });
    setSaving(false);
    setShowAddModal(false);
    resetForm();
    Alert.alert('✅ تم', 'تمت إضافة المتجر بنجاح!');
  };

  const openEditStore = (store: Store) => {
    setEditingStore(store);
    setEditStoreForm({
      name: store.name,
      description: store.description,
      category: store.category,
      phone: store.phone ?? '',
      lat: String(store.latitude),
      lng: String(store.longitude),
    });
  };

  const saveEditStore = async () => {
    if (!editingStore) return;
    if (!editStoreForm.name.trim() || !editStoreForm.description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    const lat = parseFloat(editStoreForm.lat);
    const lng = parseFloat(editStoreForm.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('تنبيه', 'يرجى إدخال إحداثيات صحيحة');
      return;
    }
    await updateStore(editingStore.id, {
      name: editStoreForm.name.trim(),
      description: editStoreForm.description.trim(),
      category: editStoreForm.category,
      phone: editStoreForm.phone.trim() || undefined,
      latitude: lat,
      longitude: lng,
    });
    setEditingStore(null);
    Alert.alert('✅ تم', 'تم تحديث بيانات المتجر');
  };

  const handleDeleteStore = (store: Store) => {
    Alert.alert(
      'حذف المتجر',
      `هل أنت متأكد من حذف "${store.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: async () => { await deleteStore(store.id); setEditingStore(null); Alert.alert('تم', 'تم حذف المتجر'); } },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة الإدارة</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>👑 مدير</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-stores')} activeOpacity={0.7}>
          <Text style={styles.statNumber}>{stores.length}</Text>
          <Text style={styles.statLabel}>إجمالي المتاجر</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-categories')} activeOpacity={0.7}>
          <Text style={styles.statNumber}>{categories.length}</Text>
          <Text style={styles.statLabel}>الفئات</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-place-requests')} activeOpacity={0.7}>
          <Text style={styles.statNumber}>{placeRequests.filter((r) => r.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>طلبات الأماكن</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>إدارة الفئات</Text>
            <TouchableOpacity style={styles.addCategoryBtn} onPress={openAddCategory}>
              <Text style={styles.addCategoryBtnText}>+ إضافة فئة</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoriesRow}>
            {categories.map((cat) => {
              const storeCount = stores.filter((s) => s.category === cat.name).length;
              return (
                <View key={cat.id} style={[styles.categoryCard, { borderColor: cat.color + '44' }]}>
                  <View style={[styles.categoryCardIcon, { backgroundColor: cat.color + '22' }]}>
                    <Text style={styles.categoryCardEmoji}>{cat.emoji}</Text>
                  </View>
                  <Text style={styles.categoryCardName}>{cat.name}</Text>
                  <Text style={styles.categoryCardCount}>{storeCount} مكان</Text>
                  <View style={styles.categoryCardActions}>
                    <TouchableOpacity style={[styles.categoryActionBtn, { backgroundColor: cat.color + '22' }]} onPress={() => openEditCategory(cat)}>
                      <Text style={[styles.categoryActionText, { color: cat.color }]}>تعديل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.categoryActionBtnDel}
                      onPress={() => Alert.alert('حذف الفئة', `حذف "${cat.name}"؟`, [
                        { text: 'إلغاء', style: 'cancel' },
                        { text: 'حذف', style: 'destructive', onPress: () => handleDeleteCategory(cat) },
                      ])}
                    >
                      <Text style={styles.categoryActionTextDel}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

      {placeRequests.filter((r) => r.status === 'pending').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>طلبات الأماكن</Text>
          {placeRequests
            .filter((r) => r.status === 'pending')
            .map((req) => (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>{req.name}</Text>
                  <Text style={styles.requestDesc}>{req.description}</Text>
                  <Text style={styles.requestMeta}>
                    {catEmoji(categories, req.category)} {req.category}
                    {req.phone ? ` • 📞 ${req.phone}` : ''}
                  </Text>
                  <Text style={styles.requestCoords}>📌 {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => {
                      acceptPlaceRequest(req.id);
                      Alert.alert('✅ تم', 'تمت إضافة المكان للمتاجر');
                    }}
                  >
                    <Text style={styles.acceptBtnText}>✓ قبول</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => {
                      rejectPlaceRequest(req.id);
                      Alert.alert('تم', 'تم رفض الطلب');
                    }}
                  >
                    <Text style={styles.rejectBtnText}>✕ رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>قائمة المتاجر</Text>
        {stores.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🏪</Text>
            <Text style={styles.emptyStateText}>لا توجد متاجر بعد</Text>
          </View>
        ) : (
          stores.map((store) => (
            <TouchableOpacity
              key={store.id}
              style={styles.storeCard}
              onPress={() => openEditStore(store)}
              activeOpacity={0.7}
            >
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
          ))
        )}
      </ScrollView>

      {/* Edit Store Modal */}
      <Modal visible={!!editingStore} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingStore(null)}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل البيانات</Text>
            <TouchableOpacity onPress={saveEditStore}>
              <Text style={styles.modalSaveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
          {editingStore && (
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>اسم المتجر *</Text>
                <TextInput style={styles.formInput} value={editStoreForm.name} onChangeText={(t) => setEditStoreForm((p) => ({ ...p, name: t }))} textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الوصف *</Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={editStoreForm.description} onChangeText={(t) => setEditStoreForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>رقم الهاتف</Text>
                <TextInput style={styles.formInput} value={editStoreForm.phone} onChangeText={(t) => setEditStoreForm((p) => ({ ...p, phone: t }))} keyboardType="phone-pad" textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الفئة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, editStoreForm.category === cat.name && styles.categoryChipActive]}
                      onPress={() => setEditStoreForm((p) => ({ ...p, category: cat.name }))}
                    >
                      <Text style={[styles.categoryChipText, editStoreForm.category === cat.name && styles.categoryChipTextActive]}>{cat.emoji} {cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الإحداثيات</Text>
                <View style={styles.coordsRow}>
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط العرض" value={editStoreForm.lat} onChangeText={(t) => setEditStoreForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder="خط الطول" value={editStoreForm.lng} onChangeText={(t) => setEditStoreForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
                </View>
              </View>
              <TouchableOpacity style={styles.deleteStoreBtn} onPress={() => editingStore && handleDeleteStore(editingStore)}>
                <Text style={styles.deleteStoreBtnText}>🗑️ حذف المتجر</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.acceptModalOverlay}>
          <View style={styles.acceptModal}>
            <Text style={styles.acceptModalTitle}>{editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</Text>
            <Text style={styles.formLabel}>الاسم</Text>
            <TextInput style={[styles.formInput, { marginBottom: 12 }]} placeholder="مثال: صيدليات" value={categoryForm.name} onChangeText={(t) => setCategoryForm((p) => ({ ...p, name: t }))} textAlign="right" />
            <Text style={styles.formLabel}>الأيقونة (إيموجي)</Text>
            <TextInput style={[styles.formInput, { marginBottom: 12 }]} placeholder="📍" value={categoryForm.emoji} onChangeText={(t) => setCategoryForm((p) => ({ ...p, emoji: t || '📍' }))} textAlign="center" />
            <Text style={styles.formLabel}>اللون</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, categoryForm.color === c && styles.colorDotSelected]} onPress={() => setCategoryForm((p) => ({ ...p, color: c }))} />
              ))}
            </View>
            <View style={styles.acceptModalActions}>
              <TouchableOpacity style={styles.acceptConfirmBtn} onPress={saveCategory}>
                <Text style={styles.acceptConfirmBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptCancelBtn} onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.acceptCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة متجر جديد</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#2E86AB" /> : <Text style={styles.modalSaveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
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

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الفئة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, form.category === cat.name && styles.categoryChipActive]}
                    onPress={() => setForm((p) => ({ ...p, category: cat.name }))}
                  >
                    <Text style={[styles.categoryChipText, form.category === cat.name && styles.categoryChipTextActive]}>
                      {cat.emoji} {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الإحداثيات (خط العرض، خط الطول)</Text>
              <View style={styles.coordsRow}>
                <TextInput
                  style={[styles.formInput, styles.coordInput]}
                  placeholder="خط العرض (Lat)"
                  value={form.lat}
                  onChangeText={(t) => setForm((p) => ({ ...p, lat: t }))}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
                <TextInput
                  style={[styles.formInput, styles.coordInput]}
                  placeholder="خط الطول (Lng)"
                  value={form.lng}
                  onChangeText={(t) => setForm((p) => ({ ...p, lng: t }))}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
              </View>
              <View style={styles.osmHint}>
                <Text style={styles.osmHintText}>
                  💡 للحصول على الإحداثيات، انقر بزر الفأرة الأيمن على أي نقطة في{' '}
                  <Text style={styles.osmLink}>openstreetmap.org</Text>
                  {' '}واختر "إظهار العنوان"
                </Text>
              </View>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerBadge: {
    backgroundColor: '#F59E0B', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 3 }),
  },
  statNumber: { fontSize: 30, fontWeight: '800', color: '#2E86AB' },
  statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right', marginBottom: 12 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addCategoryBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addCategoryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 2, ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }) },
  categoryCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryCardEmoji: { fontSize: 24 },
  categoryCardName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  categoryCardCount: { fontSize: 12, color: '#6B7280', marginTop: 2, textAlign: 'right' },
  categoryCardActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  categoryActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  categoryActionText: { fontSize: 13, fontWeight: '600' },
  categoryActionBtnDel: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FEE2E2' },
  categoryActionTextDel: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  acceptModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  acceptModal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, ...shadow({ offset: { width: 0, height: 4 }, opacity: 0.15, radius: 12, elevation: 10 }) },
  acceptModalTitle: { fontSize: 18, fontWeight: '700', color: '#1A3A5C', textAlign: 'center', marginBottom: 12 },
  acceptModalActions: { flexDirection: 'row-reverse', gap: 12, marginTop: 16 },
  acceptConfirmBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  acceptCancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptCancelBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  colorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotSelected: { borderColor: '#1F2937' },
  requestCard: {
    flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  requestInfo: { flex: 1, alignItems: 'flex-end' },
  requestName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  requestDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 4 },
  requestMeta: { fontSize: 12, color: '#2E86AB', marginTop: 6 },
  requestCoords: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginRight: 12 },
  acceptBtn: { backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  rejectBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateEmoji: { fontSize: 50, marginBottom: 12 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
  storeCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    padding: 14, marginBottom: 10, alignItems: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.07, radius: 6, elevation: 2 }),
  },
  storeCardLeft: { marginRight: 10 },
  storeCardInfo: { flex: 1, alignItems: 'flex-end' },
  storeCardName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  storeCardDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  storeCardMeta: { flexDirection: 'row', marginTop: 6, gap: 10 },
  storeCardCategory: { fontSize: 12, color: '#2E86AB', fontWeight: '600' },
  storeCardPhone: { fontSize: 12, color: '#6B7280' },
  storeCardEmoji: { fontSize: 28, marginLeft: 12 },
  editHint: { fontSize: 12, color: '#2E86AB', fontWeight: '600', marginLeft: 6 },
  deleteStoreBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 24, marginBottom: 20,
  },
  deleteStoreBtnText: { fontSize: 15, color: '#DC2626', fontWeight: '700' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  fab: {
    position: 'absolute', bottom: 30, left: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#2E86AB', alignItems: 'center', justifyContent: 'center',
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 6 }, opacity: 0.4, radius: 10, elevation: 8 }),
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: '#F0F4F8' },
  modalHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '700' },
  modalSaveText: { color: '#2E86AB', fontSize: 16, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'right', marginBottom: 8 },
  formInput: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#1F2937',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  formTextarea: { height: 90, paddingTop: 12 },
  categoryChip: {
    backgroundColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#2E86AB' },
  categoryChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  coordsRow: { flexDirection: 'row', gap: 10 },
  coordInput: { flex: 1 },
  osmHint: {
    backgroundColor: '#EBF5FB', borderRadius: 10,
    padding: 12, marginTop: 10,
  },
  osmHintText: { fontSize: 12, color: '#374151', textAlign: 'right', lineHeight: 18 },
  osmLink: { color: '#2E86AB', fontWeight: '600' },
});
