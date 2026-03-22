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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useCategories, Category } from '../../context/CategoryContext';
import { useStores } from '../../context/StoreContext';
import { shadow } from '../../utils/shadowStyles';
import { PRESET_COLORS } from '../../constants/categoryColors';

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { stores, placeRequests, updateStoresCategory, updatePlaceRequestsCategory } = useStores();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '📍', color: '#2E86AB' });

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
      await updateCategory(editingCategory.id, {
        name: newName,
        emoji: categoryForm.emoji || '📍',
        color: categoryForm.color,
      });
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
      await addCategory({
        name: categoryForm.name.trim(),
        emoji: categoryForm.emoji || '📍',
        color: categoryForm.color,
      });
      Alert.alert('✅ تم', 'تمت إضافة الفئة');
    }
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = async (cat: Category) => {
    const storeCount = stores.filter((s) => s.category === cat.name).length;
    const reqCount = placeRequests.filter((r) => r.category === cat.name).length;
    if (storeCount > 0 || reqCount > 0) {
      Alert.alert(
        'لا يمكن الحذف',
        `هذه الفئة مستخدمة في ${storeCount} متجر و${reqCount} طلب. غيّر تصنيفها أولاً ثم احذف.`
      );
      return;
    }
    const result = await deleteCategory(cat.id);
    if (result.success) Alert.alert('✅ تم', 'تم حذف الفئة');
    else Alert.alert('تنبيه', result.message);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الفئات</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{categories.length} فئة</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الفئات</Text>
          <TouchableOpacity style={styles.addCategoryBtn} onPress={openAddCategory}>
            <Text style={styles.addCategoryBtnText}>+ إضافة فئة</Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📁</Text>
            <Text style={styles.emptyStateText}>لا توجد فئات بعد</Text>
            <TouchableOpacity style={styles.emptyStateBtn} onPress={openAddCategory}>
              <Text style={styles.emptyStateBtnText}>إضافة أول فئة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {categories.map((cat) => {
              const storeCount = stores.filter((s) => s.category === cat.name).length;
              return (
                <View
                  key={cat.id}
                  style={[styles.categoryCard, { borderColor: cat.color + '44' }]}
                >
                  <View style={[styles.categoryCardIcon, { backgroundColor: cat.color + '22' }]}>
                    <Text style={styles.categoryCardEmoji}>{cat.emoji}</Text>
                  </View>
                  <Text style={styles.categoryCardName}>{cat.name}</Text>
                  <Text style={styles.categoryCardCount}>{storeCount} مكان</Text>
                  <View style={styles.categoryCardActions}>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, { backgroundColor: cat.color + '22' }]}
                      onPress={() => openEditCategory(cat)}
                    >
                      <Text style={[styles.categoryActionText, { color: cat.color }]}>
                        تعديل
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.categoryActionBtnDel}
                      onPress={() =>
                        Alert.alert('حذف الفئة', `حذف "${cat.name}"؟`, [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: () => handleDeleteCategory(cat),
                          },
                        ])
                      }
                    >
                      <Text style={styles.categoryActionTextDel}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
            </Text>
            <Text style={styles.formLabel}>الاسم</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder="مثال: صيدليات"
              value={categoryForm.name}
              onChangeText={(t) => setCategoryForm((p) => ({ ...p, name: t }))}
              textAlign="right"
            />
            <Text style={styles.formLabel}>الأيقونة (إيموجي)</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder="📍"
              value={categoryForm.emoji}
              onChangeText={(t) => setCategoryForm((p) => ({ ...p, emoji: t || '📍' }))}
              textAlign="center"
            />
            <Text style={styles.formLabel}>اللون</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    categoryForm.color === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setCategoryForm((p) => ({ ...p, color: c }))}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveCategory}>
                <Text style={styles.confirmBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  unauthorized: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: {
    backgroundColor: '#1A3A5C',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
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
  headerBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  addCategoryBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addCategoryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16 },
  emptyStateBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyStateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  categoryCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryCardEmoji: { fontSize: 24 },
  categoryCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  categoryCardCount: { fontSize: 12, color: '#6B7280', marginTop: 2, textAlign: 'right' },
  categoryCardActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  categoryActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  categoryActionText: { fontSize: 13, fontWeight: '600' },
  categoryActionBtnDel: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  categoryActionTextDel: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    ...shadow({ offset: { width: 0, height: 4 }, opacity: 0.15, radius: 12, elevation: 10 }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3A5C',
    textAlign: 'center',
    marginBottom: 16,
  },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'right', marginBottom: 6 },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  colorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotSelected: { borderColor: '#1F2937' },
  modalActions: { flexDirection: 'row-reverse', gap: 12 },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
});
