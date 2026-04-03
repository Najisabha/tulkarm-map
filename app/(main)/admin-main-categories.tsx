import { useRouter } from 'expo-router';
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
import { api, ProductMainCategory } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { LAYOUT } from '../../constants/layout';
import { shadow } from '../../utils/shadowStyles';

const COLOR_PRESETS = ['#2E86AB', '#0B2A3A', '#16A34A', '#DC2626', '#7C3AED', '#F59E0B', '#111827'];

function colorWithOpacity(color: string | null | undefined, opacity: number, fallback = '#2E86AB') {
  const base = String(color || fallback).trim();
  const hex = base.startsWith('#') ? base.slice(1) : base;
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(46,134,171,${opacity})`;
  const n = parseInt(normalized, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

export default function AdminMainCategoriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductMainCategory[]>([]);
  const [q, setQ] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductMainCategory | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '', arrow_color: '#2E86AB', sort_order: '' });

  async function load() {
    setLoading(true);
    try {
      const res = await api.getProductMainCategories();
      setItems(res.data || []);
    } catch (e: any) {
      setItems([]);
      Alert.alert('خطأ', e?.message || 'تعذر تحميل التصنيفات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin]);

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

  function openEdit(it: ProductMainCategory) {
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
    if (!name) return Alert.alert('تنبيه', 'اسم التصنيف الرئيسي مطلوب');
    if (!Number.isFinite(sortOrder)) return Alert.alert('تنبيه', 'الترتيب غير صالح');

    try {
      if (editing) {
        const res = await api.updateProductMainCategory(editing.id, {
          name,
          sort_order: sortOrder,
          emoji: emoji || null,
          arrow_color: arrowColor || null,
        } as any);
        const next = res.data;
        setItems((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...next } : p)));
        Alert.alert('✅ تم', 'تم تعديل التصنيف الرئيسي');
      } else {
        const res = await api.createProductMainCategory({
          name,
          sort_order: sortOrder,
          emoji: emoji || null,
          arrow_color: arrowColor || null,
        } as any);
        setItems((prev) => [...prev, res.data]);
        Alert.alert('✅ تم', 'تمت إضافة التصنيف الرئيسي');
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    }
  }

  async function del(it: ProductMainCategory) {
    Alert.alert('حذف', `حذف "${it.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProductMainCategory(it.id);
            setItems((prev) => prev.filter((p) => p.id !== it.id));
          } catch (e: any) {
            Alert.alert('تنبيه', e?.message || 'فشل الحذف');
          }
        },
      },
    ]);
  }

  function openSub(it: ProductMainCategory) {
    router.push(`/(main)/admin-sub-categories?mainId=${encodeURIComponent(it.id)}&mainName=${encodeURIComponent(it.name)}`);
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
        <Text style={styles.headerTitle}>إدارة التصنيفات الرئيسية</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{filtered.length} تصنيف</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ إضافة</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="بحث عن تصنيف..."
            placeholderTextColor="#9CA3AF"
            value={q}
            onChangeText={setQ}
            textAlign="right"
          />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📂</Text>
            <Text style={styles.emptyText}>لا توجد تصنيفات مطابقة</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map((it) => (
              <View
                key={it.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colorWithOpacity(it.arrow_color, 0.1, '#2E86AB'),
                    borderColor: colorWithOpacity(it.arrow_color, 0.35, '#2E86AB'),
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <View style={styles.cardTitleRow}>
                      <View style={[styles.cardArrow, { backgroundColor: it.arrow_color || '#2E86AB' }]}>
                        <Text style={styles.cardArrowText}>→</Text>
                      </View>
                      {!!it.emoji && (
                        <View style={styles.cardEmojiBadge}>
                          <Text style={styles.cardEmoji}>{it.emoji}</Text>
                        </View>
                      )}
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {it.name}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta}>تصنيفات فرعية: {it.subcategories_count ?? 0}</Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.subBtn]} onPress={() => openSub(it)}>
                    <Text style={[styles.actionText, styles.subBtnText]}>تصنيف فرعي</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(it)}>
                    <Text style={[styles.actionText, styles.editBtnText]}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.delBtn]} onPress={() => del(it)}>
                    <Text style={[styles.actionText, styles.delBtnText]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'تعديل تصنيف رئيسي' : 'إضافة تصنيف رئيسي'}</Text>
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
                <Text style={styles.modalBtnText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECF1F6' },
  header: {
    paddingTop: LAYOUT.headerTop,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1A3A5C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 14 },
  sectionHeader: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 11,
  },
  addBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.12, radius: 4, elevation: 3 }),
  },
  addBtnText: { color: '#fff', fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 90 },
  emptyEmoji: { fontSize: 42, marginBottom: 8 },
  emptyText: { color: '#6B7280', fontWeight: '700' },
  list: { paddingBottom: 20, gap: 10 },
  card: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 3 }),
  },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleWrap: { flex: 1 },
  cardTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'right' },
  cardEmojiBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFFD9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cardEmoji: { fontSize: 16 },
  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  cardMeta: { marginTop: 6, color: '#6B7280', fontSize: 12, textAlign: 'right' },
  actionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8, justifyContent: 'space-between' },
  actionBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionText: { fontWeight: '800', fontSize: 13 },
  subBtn: { backgroundColor: '#EEF5FF', borderColor: '#C7DBF8' },
  editBtn: { backgroundColor: '#ECFAF1', borderColor: '#C8EED7' },
  delBtn: { backgroundColor: '#FEF1F1', borderColor: '#F8CACA' },
  subBtnText: { color: '#1E3A8A' },
  editBtnText: { color: '#065F46' },
  delBtnText: { color: '#991B1B' },
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  unauthorizedText: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  backLink: { color: '#2E86AB', fontWeight: '800' },
});

