import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { api } from '../../api/client';
import { PRESET_COLORS } from '../../constants/categoryColors';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { Category, useCategories } from '../../context/CategoryContext';
import { useStores } from '../../context/StoreContext';
import { shadow } from '../../utils/shadowStyles';
import { normalizePlaceTypeKind } from '../../utils/placeTypeLabels';

interface AttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: any;
}

const VALUE_TYPES = [
  { value: 'string', label: 'نص' },
  { value: 'number', label: 'رقم' },
  { value: 'boolean', label: 'نعم/لا' },
  { value: 'date', label: 'تاريخ' },
];

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filterKind?: string }>();
  const { user } = useAuth();
  const { categories, addCategory, updateCategory, deleteCategory, refreshCategories } = useCategories();
  const { stores } = useStores();
  // expo-router أحياناً قد يبدّل/يوحّد casing لأسماء query params،
  // فخلي القراءة مرنة حتى يشتغل فلتر "أنواع المتاجر" دائماً.
  const filterKindRaw = (() => {
    const p: any = params ?? {};
    return p.filterKind ?? p.filterkind ?? p.filter_kind ?? 'all';
  })();
  const filterKind = String(filterKindRaw ?? 'all').toLowerCase();

  const visibleCategories = useMemo(() => {
    if (filterKind !== 'store') return categories;
    return categories.filter((c) => {
      const kind = normalizePlaceTypeKind(c.name);
      return kind === 'store' || kind === 'commercialComplex';
    });
  }, [categories, filterKind]);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '\u{1F4CD}', color: '#2E86AB' });
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCatForAttrs, setSelectedCatForAttrs] = useState<Category | null>(null);
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [attrForm, setAttrForm] = useState({ key: '', label: '', value_type: 'string', is_required: false });

  if (!user?.isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>{'\u26D4'} \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{'\u0627\u0644\u0639\u0648\u062F\u0629'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getPlacesCount = (catName: string) =>
    stores.filter(
      (s) =>
        s.category === catName && String(s.status || '').toLowerCase() === 'active'
    ).length;

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', emoji: '\u{1F4CD}', color: '#2E86AB' });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, emoji: cat.emoji, color: cat.color });
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0623\u062F\u062E\u0644 \u0627\u0633\u0645 \u0627\u0644\u0641\u0626\u0629');
      return;
    }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji || '\u{1F4CD}',
          color: categoryForm.color,
        });
        Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0641\u0626\u0629');
      } else {
        if (categories.some((c) => c.name === categoryForm.name.trim())) {
          Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0627\u0644\u0641\u0626\u0629 \u0645\u0648\u062C\u0648\u062F\u0629 \u0645\u0633\u0628\u0642\u0627\u064B');
          return;
        }
        await addCategory({
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji || '\u{1F4CD}',
          color: categoryForm.color,
        });
        Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0641\u0626\u0629');
      }
    } catch (e: any) {
      Alert.alert('\u062E\u0637\u0623', e?.message || '\u0641\u0634\u0644 \u0627\u0644\u062D\u0641\u0638');
    }
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = async (cat: Category) => {
    const result = await deleteCategory(cat.id);
    if (result.success) {
      Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0646\u0648\u0639');
    } else {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', result.message || '\u0641\u0634\u0644 \u0627\u0644\u062D\u0630\u0641');
    }
  };

  const openAttrDefs = async (cat: Category) => {
    setSelectedCatForAttrs(cat);
    setLoadingAttrs(true);
    try {
      const res = await api.getAttributeDefinitions(cat.id);
      setAttrDefs(res.data || []);
    } catch {
      setAttrDefs([]);
    } finally {
      setLoadingAttrs(false);
    }
  };

  const openAddAttr = () => {
    setAttrForm({ key: '', label: '', value_type: 'string', is_required: false });
    setShowAttrModal(true);
  };

  const saveAttrDef = async () => {
    if (!selectedCatForAttrs) return;
    if (!attrForm.key.trim() || !attrForm.label.trim()) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0623\u062F\u062E\u0644 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0648\u0627\u0644\u0639\u0646\u0648\u0627\u0646');
      return;
    }
    try {
      const res = await api.createAttributeDefinition(selectedCatForAttrs.id, {
        key: attrForm.key.trim(),
        label: attrForm.label.trim(),
        value_type: attrForm.value_type,
        is_required: attrForm.is_required,
      });
      if (res?.data) {
        setAttrDefs((prev) => [...prev, res.data]);
      }
      setShowAttrModal(false);
      Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062E\u0627\u0635\u064A\u0629');
    } catch (e: any) {
      Alert.alert('\u062E\u0637\u0623', e?.message || '\u0641\u0634\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u0629');
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = (q
    ? visibleCategories.filter((c) => c.name.toLowerCase().includes(q))
    : visibleCategories
  ).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{'\u2192'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0641\u0626\u0627\u062A'}</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{visibleCategories.length} {'\u0641\u0626\u0629'}</Text>
        </View>
      </View>

      {!selectedCatForAttrs ? (
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{'\u0627\u0644\u0641\u0626\u0627\u062A'}</Text>
            <View style={styles.headerActions}>
              <TextInput
                style={styles.searchInput}
                placeholder={'\u0628\u062D\u062B \u0639\u0646 \u0641\u0626\u0629...'}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                textAlign="right"
              />
              <TouchableOpacity style={styles.addCategoryBtn} onPress={openAddCategory}>
                <Text style={styles.addCategoryBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>{q ? '\u{1F50D}' : '\u{1F4C1}'}</Text>
              <Text style={styles.emptyStateText}>
                {q ? `\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0626\u0627\u062A \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 "${searchQuery}"` : '\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0626\u0627\u062A \u0628\u0639\u062F'}
              </Text>
              {!q && (
                <TouchableOpacity style={styles.emptyStateBtn} onPress={openAddCategory}>
                  <Text style={styles.emptyStateBtnText}>{'\u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0641\u0626\u0629'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {filtered.map((cat) => {
                const placesCount = getPlacesCount(cat.name);
                return (
                  <View key={cat.id} style={[styles.categoryCard, { borderColor: cat.color + '44' }]}>
                    <View style={[styles.categoryCardIcon, { backgroundColor: cat.color + '22' }]}>
                      <Text style={styles.categoryCardEmoji}>{cat.emoji}</Text>
                    </View>
                    <Text style={styles.categoryCardName}>{cat.name}</Text>
                    <Text style={styles.categoryCardCount}>{placesCount} {'\u0645\u0643\u0627\u0646'}</Text>
                    <View style={styles.categoryCardActions}>
                      <TouchableOpacity
                        style={[styles.categoryActionBtn, { backgroundColor: '#E0F2FE' }]}
                        onPress={() => openAttrDefs(cat)}
                      >
                        <Text style={[styles.categoryActionText, { color: '#0369A1' }]}>
                          {'\u{1F527} \u0627\u0644\u062E\u0635\u0627\u0626\u0635'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.categoryActionBtn, { backgroundColor: cat.color + '22' }]}
                        onPress={() => openEditCategory(cat)}
                      >
                        <Text style={[styles.categoryActionText, { color: cat.color }]}>
                          {'\u062A\u0639\u062F\u064A\u0644'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.categoryActionBtnDel}
                        onPress={() =>
                          Alert.alert('\u062D\u0630\u0641 \u0627\u0644\u0641\u0626\u0629', `\u062D\u0630\u0641 "${cat.name}"\u061F`, [
                            { text: '\u0625\u0644\u063A\u0627\u0621', style: 'cancel' },
                            {
                              text: '\u062D\u0630\u0641',
                              style: 'destructive',
                              onPress: () => handleDeleteCategory(cat),
                            },
                          ])
                        }
                      >
                        <Text style={styles.categoryActionTextDel}>{'\u062D\u0630\u0641'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : (
        /* ── Attribute Definitions View ── */
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => setSelectedCatForAttrs(null)}>
              <Text style={styles.attrBackText}>{'\u2192 \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0641\u0626\u0627\u062A'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.attrHeader}>
            <View style={[styles.attrHeaderIcon, { backgroundColor: selectedCatForAttrs.color + '22' }]}>
              <Text style={{ fontSize: 28 }}>{selectedCatForAttrs.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attrHeaderTitle}>{'\u062E\u0635\u0627\u0626\u0635'} {selectedCatForAttrs.name}</Text>
              <Text style={styles.attrHeaderSub}>
                {'\u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u062A\u064A \u062A\u0638\u0647\u0631 \u0639\u0646\u062F \u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0646\u0648\u0639'}
              </Text>
            </View>
          </View>

          {loadingAttrs ? (
            <ActivityIndicator size="large" color="#2E86AB" style={{ marginTop: 30 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.addAttrBtn} onPress={openAddAttr}>
                <Text style={styles.addAttrBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u062E\u0627\u0635\u064A\u0629 \u062C\u062F\u064A\u062F\u0629'}</Text>
              </TouchableOpacity>

              {attrDefs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>{'\u{1F4CB}'}</Text>
                  <Text style={styles.emptyStateText}>
                    {'\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u0635\u0627\u0626\u0635 \u0645\u0639\u0631\u0641\u0629 \u0628\u0639\u062F'}
                  </Text>
                  <Text style={[styles.emptyStateText, { fontSize: 13, marginTop: 4 }]}>
                    {'\u0623\u0636\u0641 \u062E\u0635\u0627\u0626\u0635 \u0645\u062B\u0644 "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641" \u0623\u0648 "\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644" \u0644\u062A\u0638\u0647\u0631 \u0641\u064A \u0646\u0645\u0648\u0630\u062C \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
                  {attrDefs.map((def) => (
                    <View key={def.id} style={styles.attrDefCard}>
                      <View style={styles.attrDefHeader}>
                        <Text style={styles.attrDefLabel}>{def.label}</Text>
                        {def.is_required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredBadgeText}>{'\u0645\u0637\u0644\u0648\u0628'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.attrDefMeta}>
                        <View style={styles.attrDefChip}>
                          <Text style={styles.attrDefChipText}>
                            {'\u0627\u0644\u0645\u0641\u062A\u0627\u062D'}: {def.key}
                          </Text>
                        </View>
                        <View style={styles.attrDefChip}>
                          <Text style={styles.attrDefChipText}>
                            {'\u0627\u0644\u0646\u0648\u0639'}: {VALUE_TYPES.find((v) => v.value === def.value_type)?.label || def.value_type}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      )}

      {/* Category Add/Edit Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingCategory ? '\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0641\u0626\u0629' : '\u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 \u062C\u062F\u064A\u062F\u0629'}
            </Text>
            <Text style={styles.formLabel}>{'\u0627\u0644\u0627\u0633\u0645'}</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder={'\u0645\u062B\u0627\u0644: \u0635\u064A\u062F\u0644\u064A\u0627\u062A'}
              value={categoryForm.name}
              onChangeText={(t) => setCategoryForm((p) => ({ ...p, name: t }))}
              textAlign="right"
            />
            <Text style={styles.formLabel}>{'\u0627\u0644\u0623\u064A\u0642\u0648\u0646\u0629 (\u0625\u064A\u0645\u0648\u062C\u064A)'}</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder={'\u{1F4CD}'}
              value={categoryForm.emoji}
              onChangeText={(t) => setCategoryForm((p) => ({ ...p, emoji: t || '\u{1F4CD}' }))}
              textAlign="center"
            />
            <Text style={styles.formLabel}>{'\u0627\u0644\u0644\u0648\u0646'}</Text>
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
                <Text style={styles.confirmBtnText}>{'\u062D\u0641\u0638'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.cancelBtnText}>{'\u0625\u0644\u063A\u0627\u0621'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attribute Definition Add Modal */}
      <Modal visible={showAttrModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{'\u0625\u0636\u0627\u0641\u0629 \u062E\u0627\u0635\u064A\u0629 \u062C\u062F\u064A\u062F\u0629'}</Text>

            <Text style={styles.formLabel}>{'\u0627\u0644\u0645\u0641\u062A\u0627\u062D (key) *'}</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder="phone"
              value={attrForm.key}
              onChangeText={(t) => setAttrForm((p) => ({ ...p, key: t.replace(/\s/g, '_').toLowerCase() }))}
              textAlign="left"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>{'\u0627\u0644\u0639\u0646\u0648\u0627\u0646 (\u0627\u0633\u0645 \u0627\u0644\u062D\u0642\u0644) *'}</Text>
            <TextInput
              style={[styles.formInput, { marginBottom: 12 }]}
              placeholder={'\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641'}
              value={attrForm.label}
              onChangeText={(t) => setAttrForm((p) => ({ ...p, label: t }))}
              textAlign="right"
            />

            <Text style={styles.formLabel}>{'\u0646\u0648\u0639 \u0627\u0644\u0642\u064A\u0645\u0629'}</Text>
            <View style={styles.valueTypeRow}>
              {VALUE_TYPES.map((vt) => (
                <TouchableOpacity
                  key={vt.value}
                  style={[
                    styles.valueTypeChip,
                    attrForm.value_type === vt.value && styles.valueTypeChipActive,
                  ]}
                  onPress={() => setAttrForm((p) => ({ ...p, value_type: vt.value }))}
                >
                  <Text
                    style={[
                      styles.valueTypeChipText,
                      attrForm.value_type === vt.value && styles.valueTypeChipTextActive,
                    ]}
                  >
                    {vt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.requiredToggle, attrForm.is_required && styles.requiredToggleActive]}
              onPress={() => setAttrForm((p) => ({ ...p, is_required: !p.is_required }))}
            >
              <Text style={styles.requiredToggleText}>
                {attrForm.is_required ? '\u2705 \u0645\u0637\u0644\u0648\u0628 (\u0625\u062C\u0628\u0627\u0631\u064A)' : '\u274C \u0627\u062E\u062A\u064A\u0627\u0631\u064A'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveAttrDef}>
                <Text style={styles.confirmBtnText}>{'\u0625\u0636\u0627\u0641\u0629'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAttrModal(false)}
              >
                <Text style={styles.cancelBtnText}>{'\u0625\u0644\u063A\u0627\u0621'}</Text>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  headerBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    fontSize: 14, color: '#1F2937', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 120,
  },
  addCategoryBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addCategoryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  emptyStateBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyStateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  categoryCard: {
    width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 2, minWidth: 100,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  categoryCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryCardEmoji: { fontSize: 24 },
  categoryCardName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  categoryCardCount: { fontSize: 12, color: '#6B7280', marginTop: 2, textAlign: 'right' },
  categoryCardActions: { flexDirection: 'column', gap: 6, marginTop: 10, alignItems: 'stretch' },
  categoryActionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  categoryActionText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  categoryActionBtnDel: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FEE2E2' },
  categoryActionTextDel: { fontSize: 12, fontWeight: '600', color: '#EF4444', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400,
    ...shadow({ offset: { width: 0, height: 4 }, opacity: 0.15, radius: 12, elevation: 10 }),
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A3A5C', textAlign: 'center', marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'right', marginBottom: 6 },
  formInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1F2937', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  colorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotSelected: { borderColor: '#1F2937' },
  modalActions: { flexDirection: 'row-reverse', gap: 12 },
  confirmBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },

  attrBackText: { fontSize: 15, fontWeight: '600', color: '#2E86AB' },
  attrHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, gap: 12,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  attrHeaderIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  attrHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  attrHeaderSub: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 4 },
  addAttrBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  addAttrBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  attrDefCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  attrDefHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 },
  attrDefLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  requiredBadge: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  requiredBadgeText: { fontSize: 11, fontWeight: '600', color: '#B45309' },
  attrDefMeta: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  attrDefChip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  attrDefChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  valueTypeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  valueTypeChip: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  valueTypeChipActive: { backgroundColor: '#2E86AB', borderColor: '#2E86AB' },
  valueTypeChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  valueTypeChipTextActive: { color: '#fff', fontWeight: '700' },
  requiredToggle: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  requiredToggleActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  requiredToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
