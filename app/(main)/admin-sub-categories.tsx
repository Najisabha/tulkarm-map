import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, ProductSubCategory } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { LAYOUT } from '../../constants/layout';
import { shadow } from '../../utils/shadowStyles';

const COLOR_PRESETS = ['#2E86AB', '#0B2A3A', '#16A34A', '#DC2626', '#7C3AED', '#F59E0B', '#111827'];

export default function AdminSubCategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mainId?: string; mainName?: string }>();
  const mainId = String(params.mainId || '');
  const mainName = String(params.mainName || 'تصنيف');

  const { user } = useAuth();
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductSubCategory[]>([]);
  const [q, setQ] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductSubCategory | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '', arrow_color: '#2E86AB', sort_order: '' });

  async function load() {
    if (!mainId) return;
    setLoading(true);
    try {
      const res = await api.getProductSubCategories(mainId);
      setItems(res.data || []);
    } catch (e: any) {
      setItems([]);
      Alert.alert('خطأ', e?.message || 'تعذر تحميل التصنيفات الفرعية');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, mainId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? items.filter((x) => x.name.toLowerCase().includes(s)) : items;
    return [...base].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'ar'));
  }, [items, q]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', emoji: '', arrow_color: '#2E86AB', sort_order: '' });
    setShowModal(true);
  }

  function openEdit(it: ProductSubCategory) {
    setEditing(it);
    setForm({
      name: it.name,
      emoji: String(it.emoji || ''),
      arrow_color: String(it.arrow_color || '#2E86AB'),
      sort_order: it.sort_order ? String(it.sort_order) : '',
    });
    setShowModal(true);
  }

  async function save() {
    const name = form.name.trim();
    const emoji = form.emoji.trim();
    const arrowColor = form.arrow_color.trim();
    const sortOrder = parseInt((form.sort_order || '').trim() || '0', 10);
    if (!name) return Alert.alert('تنبيه', 'اسم التصنيف الفرعي مطلوب');
    if (!Number.isFinite(sortOrder)) return Alert.alert('تنبيه', 'الترتيب غير صالح');

    try {
      if (editing) {
        const res = await api.updateProductSubCategory(editing.id, {
          name,
          sort_order: sortOrder,
          emoji: emoji || null,
          arrow_color: arrowColor || null,
        } as any);
        const next = res.data;
        setItems((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...next } : p)));
        Alert.alert('✅ تم', 'تم تعديل التصنيف الفرعي');
      } else {
        const res = await api.createProductSubCategory(mainId, {
          name,
          sort_order: sortOrder,
          emoji: emoji || null,
          arrow_color: arrowColor || null,
        } as any);
        setItems((prev) => [...prev, res.data]);
        Alert.alert('✅ تم', 'تمت إضافة التصنيف الفرعي');
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    }
  }

  async function del(it: ProductSubCategory) {
    Alert.alert('حذف', `حذف "${it.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProductSubCategory(it.id);
            setItems((prev) => prev.filter((p) => p.id !== it.id));
          } catch (e: any) {
            Alert.alert('تنبيه', e?.message || 'فشل الحذف');
          }
        },
      },
    ]);
  }

  if (!isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>⛔ غير مصرح لك بالوصول</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!mainId) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>التصنيف الرئيسي غير محدد</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E86AB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تصنيفات فرعية — {mainName}</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{filtered.length} عنصر</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <TextInput
            style={styles.searchInput}
            placeholder="بحث عن تصنيف فرعي..."
            placeholderTextColor="#9CA3AF"
            value={q}
            onChangeText={setQ}
            textAlign="right"
          />
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ إضافة</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((it) => (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{it.name}</Text>
                {!!it.emoji && <Text style={styles.cardEmoji}>{it.emoji}</Text>}
                <View style={[styles.cardArrow, { backgroundColor: it.arrow_color || '#2E86AB' }]}>
                  <Text style={styles.cardArrowText}>→</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(it)}>
                  <Text style={styles.actionText}>تعديل</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.delBtn]} onPress={() => del(it)}>
                  <Text style={styles.actionText}>حذف</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'تعديل تصنيف فرعي' : 'إضافة تصنيف فرعي'}</Text>
            <TextInput
              style={styles.input}
              placeholder="اسم التصنيف"
              value={form.name}
              onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
              textAlign="right"
            />
            <View style={styles.row2}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="لون السهم (مثال #2E86AB)"
                value={form.arrow_color}
                onChangeText={(t) => setForm((p) => ({ ...p, arrow_color: t }))}
                autoCapitalize="none"
                textAlign="right"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="إيموجي (اختياري)"
                value={form.emoji}
                onChangeText={(t) => setForm((p) => ({ ...p, emoji: t }))}
                textAlign="right"
              />
            </View>
            <View style={styles.presetRow}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, form.arrow_color === c && styles.colorDotActive]}
                  onPress={() => setForm((p) => ({ ...p, arrow_color: c }))}
                />
              ))}
              <View style={[styles.previewArrow, { backgroundColor: form.arrow_color || '#2E86AB' }]}>
                <Text style={styles.previewArrowText}>→</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="ترتيب (اختياري) — رقم لترتيب القائمة"
              value={form.sort_order}
              onChangeText={(t) => setForm((p) => ({ ...p, sort_order: t }))}
              keyboardType="numeric"
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={save}>
                <Text style={[styles.modalBtnText, styles.modalSaveText]}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 40,
    paddingHorizontal: LAYOUT.padding,
    paddingBottom: 12,
    backgroundColor: '#0B2A3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: LAYOUT.padding },
  sectionHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  addBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800' },
  list: { paddingBottom: 20, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, ...shadow },
  cardTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'right' },
  cardEmoji: { fontSize: 16 },
  cardArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowText: { color: '#fff', fontWeight: '900' },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontWeight: '800' },
  editBtn: { backgroundColor: '#DCFCE7' },
  delBtn: { backgroundColor: '#FEE2E2' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'right' },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  row2: { flexDirection: 'row-reverse', gap: 10 },
  halfInput: { flex: 1 },
  presetRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#E5E7EB' },
  colorDotActive: { borderColor: '#111827', borderWidth: 2 },
  previewArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  previewArrowText: { color: '#fff', fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { backgroundColor: '#F3F4F6' },
  modalSave: { backgroundColor: '#2E86AB' },
  modalBtnText: { fontWeight: '800', color: '#111827' },
  modalSaveText: { color: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  unauthorizedText: { fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  backLink: { color: '#2E86AB', fontWeight: '800' },
});

