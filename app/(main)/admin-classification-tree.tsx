import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, PlaceType } from '../../api/client';
import { AdminScreenIcon } from '../../components/admin/AdminScreenIcon';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { categoryService } from '../../services/categoryService';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';
import { shadow } from '../../utils/shadowStyles';

const COLOR_PRESETS = ['#2E86AB', '#16A34A', '#DC2626', '#7C3AED', '#F59E0B', '#EC4899', '#0B2A3A'];

const CLASSIFICATION_SECTORS: {
  id: string;
  pluralLabel: string;
  typeName: string;
  webGlyph: string;
}[] = [
  { id: 'store', pluralLabel: 'المتاجر', typeName: 'متجر تجاري', webGlyph: '🏪' },
  { id: 'restaurant', pluralLabel: 'المطاعم', typeName: 'مطعم', webGlyph: '🍽️' },
  { id: 'office', pluralLabel: 'المكاتب', typeName: 'مكتب', webGlyph: '🏢' },
  { id: 'hospital', pluralLabel: 'المستشفيات', typeName: 'مستشفى', webGlyph: '🏥' },
  { id: 'clinic', pluralLabel: 'العيادات', typeName: 'عيادة', webGlyph: '⚕️' },
  { id: 'salon', pluralLabel: 'الصالونات', typeName: 'صالون', webGlyph: '💇' },
  { id: 'edu', pluralLabel: 'المؤسسات التعليمية', typeName: 'مؤسسة تعليمية', webGlyph: '🏫' },
  { id: 'gov', pluralLabel: 'المؤسسات الحكومية', typeName: 'مؤسسة حكومية', webGlyph: '🏛️' },
];

interface PlaceCategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  sort_order: number;
  parent_id: string | null;
  place_type_id: string;
}

export default function AdminClassificationTreeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);

  const [sectorId, setSectorId] = useState<string | null>(null);
  const [placeTypeId, setPlaceTypeId] = useState<string | null>(null);
  const [placeTypes, setPlaceTypes] = useState<PlaceType[]>([]);
  const [tree, setTree] = useState<PlaceCategoryTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // CRUD modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlaceCategoryRow | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });

  const selectedSector = sectorId
    ? CLASSIFICATION_SECTORS.find((s) => s.id === sectorId) ?? null
    : null;

  // Load place_types once to resolve type name → id
  useEffect(() => {
    if (!isAdmin) return;
    api.getPlaceTypes().then((res) => setPlaceTypes(res.data ?? [])).catch(() => {});
  }, [isAdmin]);

  // Resolve placeTypeId from sector selection
  useEffect(() => {
    if (!sectorId || !selectedSector) { setPlaceTypeId(null); return; }
    const match = placeTypes.find((t) => t.name === selectedSector.typeName);
    setPlaceTypeId(match?.id ?? null);
  }, [sectorId, selectedSector, placeTypes]);

  const loadTree = useCallback(async () => {
    if (!placeTypeId) return;
    setLoadingTree(true);
    try {
      const t = await categoryService.getPlaceCategoryTree(placeTypeId);
      setTree(Array.isArray(t) ? t : []);
    } catch {
      setTree([]);
    } finally {
      setLoadingTree(false);
    }
  }, [placeTypeId]);

  useEffect(() => {
    if (!isAdmin || !placeTypeId) return;
    void loadTree();
  }, [isAdmin, placeTypeId, loadTree]);

  const onRefresh = () => {
    if (!placeTypeId) return;
    setRefreshing(true);
    loadTree().finally(() => setRefreshing(false));
  };

  // ─── CRUD helpers ────────────────────────────────────────────────────────────

  function openAddMain() {
    setEditingItem(null);
    setModalParentId(null);
    setForm({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });
    setShowModal(true);
  }

  function openAddSub(mainId: string) {
    setEditingItem(null);
    setModalParentId(mainId);
    setForm({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });
    setShowModal(true);
  }

  function openEdit(item: PlaceCategoryRow) {
    setEditingItem(item);
    setModalParentId(item.parent_id);
    setForm({
      name: item.name,
      emoji: item.emoji || '',
      color: item.color || '#2E86AB',
      sort_order: item.sort_order ? String(item.sort_order) : '',
    });
    setShowModal(true);
  }

  async function save() {
    const name = form.name.trim();
    const emoji = form.emoji.trim() || null;
    const color = form.color.trim() || null;
    const sortOrder = parseInt((form.sort_order || '0').trim(), 10);
    if (!name) return Alert.alert('تنبيه', 'اسم التصنيف مطلوب');
    if (!Number.isFinite(sortOrder)) return Alert.alert('تنبيه', 'الترتيب غير صالح');
    if (!placeTypeId) return;

    try {
      if (editingItem) {
        await api.updatePlaceCategory(editingItem.id, { name, emoji, color, sort_order: sortOrder });
        Alert.alert('تم', 'تم تعديل التصنيف');
      } else {
        await api.createPlaceCategory({
          name,
          emoji,
          color,
          sort_order: sortOrder,
          parent_id: modalParentId,
          place_type_id: placeTypeId,
        });
        Alert.alert('تم', 'تمت إضافة التصنيف');
      }
      setShowModal(false);
      void loadTree();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    }
  }

  function confirmDelete(item: PlaceCategoryRow) {
    Alert.alert('حذف', `حذف "${item.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePlaceCategory(item.id);
            void loadTree();
          } catch (e: any) {
            Alert.alert('تنبيه', e?.message || 'فشل الحذف');
          }
        },
      },
    ]);
  }

  // ─── Flat list of all items for edit/delete lookups ──────────────────────────

  const allItemsFlat = useMemo(() => {
    const out: PlaceCategoryRow[] = [];
    for (const t of tree) {
      out.push({
        id: t.main.id,
        name: t.main.name,
        emoji: t.main.emoji,
        color: t.main.color,
        sort_order: 0,
        parent_id: null,
        place_type_id: placeTypeId ?? '',
      });
      for (const s of t.sub_categories) {
        out.push({
          id: s.id,
          name: s.name,
          emoji: s.emoji,
          color: s.color,
          sort_order: 0,
          parent_id: t.main.id,
          place_type_id: placeTypeId ?? '',
        });
      }
    }
    return out;
  }, [tree, placeTypeId]);

  // ─── Guard ──────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>غير مصرح لك بالوصول</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { if (sectorId) { setSectorId(null); setTree([]); } else router.back(); }}
          accessibilityRole="button"
        >
          <AdminScreenIcon name="arrow-forward" size={22} color="#fff" webGlyph="→" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sectorId ? `تصنيفات ${selectedSector?.pluralLabel ?? ''}` : 'شجرة التصنيفات'}
        </Text>
        {sectorId && placeTypeId ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{tree.length} رئيسي</Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* ─── Sector picker ─────────────────────────────────────────────────── */}
      {!sectorId ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            اختر قطاعاً لإدارة تصنيفاته الرئيسية والفرعية.
          </Text>
          <View style={styles.sectorGrid}>
            {CLASSIFICATION_SECTORS.map((s) => (
              <TouchableOpacity key={s.id} style={styles.sectorCard} onPress={() => setSectorId(s.id)} activeOpacity={0.75}>
                <Text style={styles.sectorEmoji}>{s.webGlyph}</Text>
                <Text style={styles.sectorLabel}>{s.pluralLabel}</Text>
                <Text style={styles.sectorHint}>({s.typeName})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ─── Tree CRUD view ─────────────────────────────────────────────── */
        <View style={styles.contentFlex}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity style={styles.addBtn} onPress={openAddMain}>
              <Text style={styles.addBtnText}>+ تصنيف رئيسي</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A3A5C" />}
          >
            {loadingTree && tree.length === 0 ? (
              <View style={styles.centerWrap}>
                <ActivityIndicator size="large" color="#1A3A5C" />
                <Text style={styles.loadingText}>جاري التحميل…</Text>
              </View>
            ) : tree.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌳</Text>
                <Text style={styles.emptyText}>لا توجد تصنيفات بعد — أضف أول تصنيف رئيسي</Text>
              </View>
            ) : (
              tree.map((item) => {
                const mainRow = allItemsFlat.find((r) => r.id === item.main.id);
                return (
                  <View key={item.main.id} style={styles.mainBlock}>
                    {/* Main category header */}
                    <View style={styles.mainRow}>
                      <View style={[styles.colorDotBig, { backgroundColor: item.main.color || '#2E86AB' }]} />
                      {item.main.emoji ? <Text style={styles.mainEmoji}>{item.main.emoji}</Text> : null}
                      <Text style={styles.mainName}>{item.main.name}</Text>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity style={[styles.actionBtn, styles.subBtn]} onPress={() => openAddSub(item.main.id)}>
                        <Text style={[styles.actionText, styles.subBtnText]}>+ فرعي</Text>
                      </TouchableOpacity>
                      {mainRow && (
                        <>
                          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(mainRow)}>
                            <Text style={[styles.actionText, styles.editBtnText]}>تعديل</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, styles.delBtn]} onPress={() => confirmDelete(mainRow)}>
                            <Text style={[styles.actionText, styles.delBtnText]}>حذف</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>

                    {/* Sub categories */}
                    {item.sub_categories.length === 0 ? (
                      <Text style={styles.noSubs}>— لا يوجد تصنيف فرعي</Text>
                    ) : (
                      item.sub_categories.map((sub) => {
                        const subRow = allItemsFlat.find((r) => r.id === sub.id);
                        return (
                          <View key={sub.id} style={styles.subRow}>
                            <View style={styles.subInfo}>
                              {sub.emoji ? <Text style={styles.subEmoji}>{sub.emoji}</Text> : null}
                              <Text style={styles.subName}>{sub.name}</Text>
                            </View>
                            {subRow && (
                              <View style={styles.subActions}>
                                <TouchableOpacity onPress={() => openEdit(subRow)}>
                                  <Text style={styles.miniEditText}>تعديل</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => confirmDelete(subRow)}>
                                  <Text style={styles.miniDelText}>حذف</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* ─── Add / Edit Modal ──────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'تعديل التصنيف' : modalParentId ? 'إضافة تصنيف فرعي' : 'إضافة تصنيف رئيسي'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="اسم التصنيف"
              placeholderTextColor="#9CA3AF"
              value={form.name}
              onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
              textAlign="right"
            />
            <View style={styles.row2}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="اللون (#hex)"
                placeholderTextColor="#9CA3AF"
                value={form.color}
                onChangeText={(t) => setForm((p) => ({ ...p, color: t }))}
                autoCapitalize="none"
                textAlign="right"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="إيموجي (اختياري)"
                placeholderTextColor="#9CA3AF"
                value={form.emoji}
                onChangeText={(t) => setForm((p) => ({ ...p, emoji: t }))}
                textAlign="right"
              />
            </View>
            <View style={styles.presetRow}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
                  onPress={() => setForm((p) => ({ ...p, color: c }))}
                />
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="ترتيب (اختياري)"
              placeholderTextColor="#9CA3AF"
              value={form.sort_order}
              onChangeText={(t) => setForm((p) => ({ ...p, sort_order: t }))}
              keyboardType="numeric"
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={save}>
                <Text style={styles.modalSaveText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EEF2' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: {
    backgroundColor: '#1A3A5C',
    paddingTop: LAYOUT.headerTop,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'right' },
  headerSpacer: { width: 40 },
  headerBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F59E0B' },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  contentFlex: { flex: 1 },
  intro: { fontSize: 14, color: '#4B5563', textAlign: 'right', lineHeight: 22, marginBottom: 14 },

  // Sector grid
  sectorGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  sectorCard: {
    width: '48.5%', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#F3F4F6',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 8, elevation: 3 }),
  },
  sectorEmoji: { fontSize: 28, marginBottom: 8 },
  sectorLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  sectorHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // Section header with add button
  sectionHeader: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  addBtn: {
    height: 42, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: '#2E86AB', alignItems: 'center', justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.12, radius: 4, elevation: 3 }),
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Tree items
  centerWrap: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  mainBlock: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  mainRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  colorDotBig: { width: 12, height: 12, borderRadius: 6 },
  mainEmoji: { fontSize: 24 },
  mainName: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'right' },

  actionsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  actionBtn: { height: 34, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionText: { fontWeight: '800', fontSize: 12 },
  subBtn: { backgroundColor: '#EEF5FF', borderColor: '#C7DBF8' },
  editBtn: { backgroundColor: '#ECFAF1', borderColor: '#C8EED7' },
  delBtn: { backgroundColor: '#FEF1F1', borderColor: '#F8CACA' },
  subBtnText: { color: '#1E3A8A' },
  editBtnText: { color: '#065F46' },
  delBtnText: { color: '#991B1B' },

  noSubs: { fontSize: 13, color: '#9CA3AF', textAlign: 'right', fontStyle: 'italic', marginTop: 4 },
  subRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6',
  },
  subInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flex: 1 },
  subEmoji: { fontSize: 18 },
  subName: { fontSize: 15, color: '#374151', textAlign: 'right' },
  subActions: { flexDirection: 'row-reverse', gap: 14 },
  miniEditText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  miniDelText: { fontSize: 12, fontWeight: '700', color: '#991B1B' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'right' },
  input: {
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, backgroundColor: '#fff', marginBottom: 10, color: '#1F2937',
  },
  row2: { flexDirection: 'row-reverse', gap: 10 },
  halfInput: { flex: 1 },
  presetRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#E5E7EB' },
  colorDotActive: { borderColor: '#111827', borderWidth: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { backgroundColor: '#F3F4F6' },
  modalSave: { backgroundColor: '#2E86AB' },
  modalCancelText: { fontWeight: '800', color: '#374151' },
  modalSaveText: { fontWeight: '800', color: '#fff' },
});
