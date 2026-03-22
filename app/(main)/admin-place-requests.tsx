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
import { useStores, PlaceRequest } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { TULKARM_REGION } from '../../constants/tulkarmRegion';
import { shadow } from '../../utils/shadowStyles';

function catEmoji(cats: { name: string; emoji: string }[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '📍';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

export default function AdminPlaceRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { categories } = useCategories();
  const {
    placeRequests,
    addPlaceRequest,
    updatePlaceRequest,
    acceptPlaceRequest,
    rejectPlaceRequest,
    deletePlaceRequest,
  } = useStores();

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PlaceRequest | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', phone: '', lat: '', lng: '' });
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: categories[0]?.name ?? 'تسوق',
    phone: '',
    lat: String(TULKARM_REGION.latitude),
    lng: String(TULKARM_REGION.longitude),
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

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

  const filtered = statusFilter === 'all'
    ? placeRequests
    : placeRequests.filter((r) => r.status === statusFilter);

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
    await addPlaceRequest({
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
    Alert.alert('✅ تم', 'تمت إضافة طلب المكان');
  };

  const openEdit = (req: PlaceRequest) => {
    setEditingRequest(req);
    setEditForm({
      name: req.name,
      description: req.description,
      category: req.category,
      phone: req.phone ?? '',
      lat: String(req.latitude),
      lng: String(req.longitude),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;
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
    await updatePlaceRequest(editingRequest.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      category: editForm.category,
      phone: editForm.phone.trim() || undefined,
      latitude: lat,
      longitude: lng,
    });
    setEditingRequest(null);
    Alert.alert('✅ تم', 'تم تحديث الطلب');
  };

  const handleAccept = (req: PlaceRequest) => {
    acceptPlaceRequest(req.id);
    Alert.alert('✅ تم', 'تمت إضافة المكان للمتاجر');
  };

  const handleReject = (req: PlaceRequest) => {
    Alert.alert('رفض الطلب', `رفض "${req.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'رفض', style: 'destructive', onPress: () => { rejectPlaceRequest(req.id); Alert.alert('تم', 'تم رفض الطلب'); } },
    ]);
  };

  const handleDelete = (req: PlaceRequest) => {
    Alert.alert('حذف الطلب', `حذف "${req.name}" نهائياً؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { await deletePlaceRequest(req.id); setEditingRequest(null); Alert.alert('تم', 'تم حذف الطلب'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلبات الأماكن</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{placeRequests.filter((r) => r.status === 'pending').length} قيد الانتظار</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الطلبات</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowAddModal(true); resetForm(); }}>
            <Text style={styles.addBtnText}>+ إضافة طلب</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(['pending', 'accepted', 'rejected', 'all'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateText}>
              {statusFilter === 'all' ? 'لا توجد طلبات' : `لا توجد طلبات ${STATUS_LABELS[statusFilter] ?? 'في هذه الفئة'}`}
            </Text>
            {statusFilter !== 'all' && (
              <TouchableOpacity style={styles.emptyStateBtn} onPress={() => setStatusFilter('all')}>
                <Text style={styles.emptyStateBtnText}>عرض الكل</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filtered.map((req) => (
              <View key={req.id} style={[styles.requestCard, req.status === 'pending' && styles.requestCardPending]}>
                <TouchableOpacity style={styles.requestInfo} onPress={() => req.status === 'pending' && openEdit(req)} activeOpacity={req.status === 'pending' ? 0.7 : 1}>
                  <Text style={styles.requestName}>{req.name}</Text>
                  <Text style={styles.requestDesc}>{req.description}</Text>
                  <View style={styles.requestMeta}>
                    <Text style={styles.requestCategory}>{catEmoji(categories, req.category)} {req.category}</Text>
                    <View style={[styles.statusBadge, req.status === 'pending' && styles.statusPending, req.status === 'accepted' && styles.statusAccepted, req.status === 'rejected' && styles.statusRejected]}>
                      <Text style={styles.statusText}>{STATUS_LABELS[req.status]}</Text>
                    </View>
                  </View>
                  {req.phone ? <Text style={styles.requestPhone}>📞 {req.phone}</Text> : null}
                  <Text style={styles.requestCoords}>📌 {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}</Text>
                </TouchableOpacity>
                <View style={styles.requestActions}>
                  {req.status === 'pending' && (
                    <>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(req)}>
                        <Text style={styles.editBtnText}>✏️ تعديل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                        <Text style={styles.acceptBtnText}>✓ قبول</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req)}>
                        <Text style={styles.rejectBtnText}>✕ رفض</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(req)}>
                    <Text style={styles.deleteBtnText}>🗑️ حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
            <Text style={styles.modalTitle}>إضافة طلب مكان</Text>
            <TouchableOpacity onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#2E86AB" /> : <Text style={styles.modalSaveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>اسم المكان *</Text>
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
      <Modal visible={!!editingRequest} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingRequest(null)}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل الطلب</Text>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={styles.modalSaveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
          {editingRequest && editingRequest.status === 'pending' && (
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>اسم المكان *</Text>
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
              <TouchableOpacity style={styles.deleteRequestBtn} onPress={() => editingRequest && handleDelete(editingRequest)}>
                <Text style={styles.deleteRequestBtnText}>🗑️ حذف الطلب</Text>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  addBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { backgroundColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { backgroundColor: '#2E86AB' },
  filterChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  emptyStateBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyStateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  requestCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  requestCardPending: { borderWidth: 2, borderColor: '#FEF3C7' },
  requestInfo: { flex: 1, alignItems: 'flex-end' },
  requestName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  requestDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  requestMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  requestCategory: { fontSize: 12, color: '#2E86AB', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusAccepted: { backgroundColor: '#DCFCE7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  requestPhone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  requestCoords: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editBtn: { backgroundColor: '#2E86AB', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  editBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  acceptBtn: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  acceptBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  rejectBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  rejectBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  deleteBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '700' },
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
  deleteRequestBtn: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  deleteRequestBtnText: { fontSize: 15, color: '#DC2626', fontWeight: '700' },
});
