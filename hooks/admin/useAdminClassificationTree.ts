/**
 * منطق شاشة شجرة التصنيفات:
 * - تحميل أنواع الأماكن من DB وبناء عناصر الاختيار ديناميكياً
 *   مع الإبقاء فقط على الأنواع التي لديها شجرة تصنيفات غير فارغة
 * - تحميل شجرة النوع المختار + إدارة مودال الإضافة/التعديل + CRUD
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { api, type PlaceType } from '../../api/client';
import { categoryService } from '../../services/categoryService';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';
import { getPlaceTypePluralLabel } from '../../utils/placeTypeLabels';
import {
  flattenTree,
  legacySectorIdToTypeName,
  type ClassificationPickerItem,
  type PlaceCategoryRow,
} from '../../utils/admin/classificationTreeHelpers';

export interface AdminClassificationTreePreset {
  sectorId?: string | null;
  placeTypeName?: string | null;
}

const DEFAULT_PICKER_EMOJI = '🗂️';

function buildPickerItem(pt: PlaceType): ClassificationPickerItem {
  const name = (pt.name ?? '').trim();
  const emoji = (pt.emoji ?? '').trim() || DEFAULT_PICKER_EMOJI;
  return {
    id: pt.id,
    name,
    emoji,
    color: pt.color ?? null,
    pluralLabel: getPlaceTypePluralLabel(name),
  };
}

export function useAdminClassificationTree(isAdmin: boolean, preset?: AdminClassificationTreePreset | null) {
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [placeTypes, setPlaceTypes] = useState<PlaceType[]>([]);
  const [pickerItems, setPickerItems] = useState<ClassificationPickerItem[]>([]);
  const [loadingPickerItems, setLoadingPickerItems] = useState(false);
  const [tree, setTree] = useState<PlaceCategoryTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlaceCategoryRow | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });

  // sectorId الآن يساوي place_type_id مباشرة
  const placeTypeId = sectorId;
  const selectedSector = useMemo(
    () => (sectorId ? pickerItems.find((s) => s.id === sectorId) ?? null : null),
    [sectorId, pickerItems],
  );

  // ─── تحميل الأنواع وبناء عناصر الاختيار ديناميكياً ──────────────────────────

  const loadPickerItems = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingPickerItems(true);
    try {
      const res = await api.getPlaceTypes();
      const types: PlaceType[] = res.data ?? [];
      setPlaceTypes(types);

      const checks = await Promise.all(
        types.map(async (pt) => {
          try {
            const t = await categoryService.getPlaceCategoryTree(pt.id);
            return { pt, hasTree: Array.isArray(t) && t.length > 0 };
          } catch {
            return { pt, hasTree: false };
          }
        }),
      );

      const items = checks
        .filter((x) => x.hasTree)
        .map((x) => buildPickerItem(x.pt))
        .sort((a, b) => a.pluralLabel.localeCompare(b.pluralLabel, 'ar'));

      setPickerItems(items);
    } catch {
      setPickerItems([]);
    } finally {
      setLoadingPickerItems(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadPickerItems();
  }, [loadPickerItems]);

  // ─── preselect عبر params ───────────────────────────────────────────────────

  const presetKeyRef = useRef<string>('');

  useEffect(() => {
    if (!isAdmin) return;
    const key = `${preset?.sectorId ?? ''}|${preset?.placeTypeName ?? ''}`;
    if (!key.replace(/\|/g, '').trim()) return;
    if (presetKeyRef.current === key) return;
    if (placeTypes.length === 0) return; // ننتظر تحميل الأنواع لإجراء المطابقة بالاسم
    presetKeyRef.current = key;

    let resolvedId: string | null = null;
    const ptn = preset?.placeTypeName?.trim();
    if (ptn) {
      const match = placeTypes.find((t) => t.name === ptn);
      if (match) resolvedId = match.id;
    }
    if (!resolvedId && preset?.sectorId) {
      const sid = preset.sectorId;
      // 1) إذا كان معرّف نوع مكان فعلي في DB
      if (placeTypes.some((t) => t.id === sid)) {
        resolvedId = sid;
      } else {
        // 2) محاولة map قديم -> اسم نوع -> id
        const legacyName = legacySectorIdToTypeName(sid);
        if (legacyName) {
          const match = placeTypes.find((t) => t.name === legacyName);
          if (match) resolvedId = match.id;
        }
      }
    }
    if (resolvedId) setSectorId(resolvedId);
  }, [isAdmin, placeTypes, preset?.placeTypeName, preset?.sectorId]);

  // ─── تحميل شجرة النوع المختار ───────────────────────────────────────────────

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

  const onRefresh = useCallback(() => {
    if (!placeTypeId) return;
    setRefreshing(true);
    loadTree().finally(() => setRefreshing(false));
  }, [loadTree, placeTypeId]);

  const openAddMain = useCallback(() => {
    setEditingItem(null);
    setModalParentId(null);
    setForm({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });
    setShowModal(true);
  }, []);

  const openAddSub = useCallback((mainId: string) => {
    setEditingItem(null);
    setModalParentId(mainId);
    setForm({ name: '', emoji: '', color: '#2E86AB', sort_order: '' });
    setShowModal(true);
  }, []);

  const openEdit = useCallback((item: PlaceCategoryRow) => {
    setEditingItem(item);
    setModalParentId(item.parent_id);
    setForm({
      name: item.name,
      emoji: item.emoji || '',
      color: item.color || '#2E86AB',
      sort_order: item.sort_order ? String(item.sort_order) : '',
    });
    setShowModal(true);
  }, []);

  const save = useCallback(async () => {
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
  }, [editingItem, form, loadTree, modalParentId, placeTypeId]);

  const confirmDelete = useCallback(
    (item: PlaceCategoryRow) => {
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
    },
    [loadTree],
  );

  const allItemsFlat = useMemo(() => flattenTree(tree, placeTypeId), [tree, placeTypeId]);

  return {
    sectorId,
    setSectorId,
    selectedSector,
    placeTypeId,
    pickerItems,
    loadingPickerItems,
    refreshPickerItems: loadPickerItems,
    tree,
    loadingTree,
    refreshing,
    onRefresh,
    showModal,
    setShowModal,
    editingItem,
    modalParentId,
    form,
    setForm,
    openAddMain,
    openAddSub,
    openEdit,
    save,
    confirmDelete,
    allItemsFlat,
    setTree,
  };
}
