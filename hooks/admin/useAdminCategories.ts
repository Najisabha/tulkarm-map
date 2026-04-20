/**
 * منطق شاشة إدارة الفئات:
 * - إدارة CRUD للفئات
 * - إدارة خصائص الفئة (attribute definitions)
 * - البحث والفلترة
 */

import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../../api/client';
import type { Category } from '../../context/CategoryContext';
import type { Store } from '../../context/StoreContext';
import { categoryService } from '../../services/categoryService';
import type { AttrDef } from '../../utils/admin/categoryAdminHelpers';
import {
  ATTR_UI_ROLE_KEYS,
  filterVisibleCategories,
  parseAttrUiOptions,
} from '../../utils/admin/categoryAdminHelpers';
import { ensureAndFetchAttributeDefinitions } from '../../utils/admin/ensurePlaceTypeAttrDefs';

export function useAdminCategories(params: {
  categories: Category[];
  stores: Store[];
  filterKind: string;
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
}) {
  const { categories, stores, filterKind, addCategory, updateCategory, deleteCategory } = params;

  const visibleCategories = useMemo(
    () => filterVisibleCategories(categories, filterKind),
    [categories, filterKind],
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '\u{1F4CD}', color: '#2E86AB' });
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCatForAttrs, setSelectedCatForAttrs] = useState<Category | null>(null);
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [editingAttrDef, setEditingAttrDef] = useState<AttrDef | null>(null);
  const [classificationLinked, setClassificationLinked] = useState(false);
  const [checkingClassificationLinked, setCheckingClassificationLinked] = useState(false);
  const [attrForm, setAttrForm] = useState({
    key: '',
    label: '',
    value_type: 'string',
    is_required: false,
    uiRole: 'dynamic',
    sortOrder: '100',
    maxPhotos: '',
  });

  const getPlacesCount = (catName: string) =>
    stores.filter((s) => s.category === catName && String(s.status || '').toLowerCase() === 'active').length;

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
      Alert.alert('تنبيه', 'أدخل اسم الفئة');
      return;
    }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji || '\u{1F4CD}',
          color: categoryForm.color,
        });
        Alert.alert('✅ تم', 'تم تحديث الفئة');
      } else {
        if (categories.some((c) => c.name === categoryForm.name.trim())) {
          Alert.alert('تنبيه', 'الفئة موجودة مسبقاً');
          return;
        }
        await addCategory({
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji || '\u{1F4CD}',
          color: categoryForm.color,
        });
        Alert.alert('✅ تم', 'تمت إضافة الفئة');
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    }
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = async (cat: Category) => {
    const result = await deleteCategory(cat.id);
    if (result.success) {
      Alert.alert('✅ تم', 'تم حذف النوع');
    } else {
      Alert.alert('تنبيه', result.message || 'فشل الحذف');
    }
  };

  const openAttrDefs = async (cat: Category) => {
    setSelectedCatForAttrs(cat);
    setLoadingAttrs(true);
    setCheckingClassificationLinked(true);
    try {
      const list = await ensureAndFetchAttributeDefinitions(cat.id, cat.name);
      setAttrDefs(list);
      const tree = await categoryService.getPlaceCategoryTree(cat.id);
      const linked = Array.isArray(tree) && tree.some((n) => Boolean(n?.main?.id) || (n?.sub_categories?.length ?? 0) > 0);
      setClassificationLinked(linked);
    } catch {
      setAttrDefs([]);
      setClassificationLinked(false);
    } finally {
      setLoadingAttrs(false);
      setCheckingClassificationLinked(false);
    }
  };

  const refreshClassificationLinked = async () => {
    if (!selectedCatForAttrs) return;
    setCheckingClassificationLinked(true);
    try {
      const tree = await categoryService.getPlaceCategoryTree(selectedCatForAttrs.id);
      const linked = Array.isArray(tree) && tree.some((n) => Boolean(n?.main?.id) || (n?.sub_categories?.length ?? 0) > 0);
      setClassificationLinked(linked);
    } catch {
      setClassificationLinked(false);
    } finally {
      setCheckingClassificationLinked(false);
    }
  };

  const openAddAttr = () => {
    setEditingAttrDef(null);
    setAttrForm({
      key: '',
      label: '',
      value_type: 'string',
      is_required: false,
      uiRole: 'dynamic',
      sortOrder: '100',
      maxPhotos: '',
    });
    setShowAttrModal(true);
  };

  const openEditAttr = (def: AttrDef) => {
    setEditingAttrDef(def);
    const options = parseAttrUiOptions(def.options);
    setAttrForm({
      key: def.key,
      label: def.label,
      value_type: def.value_type || 'string',
      is_required: !!def.is_required,
      uiRole: options.uiRole ?? 'dynamic',
      sortOrder: options.sortOrder !== undefined ? String(options.sortOrder) : '',
      maxPhotos: options.maxPhotos !== undefined ? String(options.maxPhotos) : '',
    });
    setShowAttrModal(true);
  };

  const deriveRoleDefaults = (uiRole: string) => {
    switch (uiRole) {
      case 'place_location':
        return { key: ATTR_UI_ROLE_KEYS.place_location, value_type: 'json', label: 'الموقع على الخريطة' };
      case 'place_name':
        return { key: ATTR_UI_ROLE_KEYS.place_name, value_type: 'string', label: 'اسم المكان' };
      case 'place_description':
        return { key: ATTR_UI_ROLE_KEYS.place_description, value_type: 'string', label: 'الوصف' };
      case 'place_phone':
        return { key: ATTR_UI_ROLE_KEYS.place_phone, value_type: 'phone', label: 'رقم الهاتف' };
      case 'place_photos':
        return { key: ATTR_UI_ROLE_KEYS.place_photos, value_type: 'json', label: 'صور المكان' };
      default:
        return null;
    }
  };

  const saveAttrDef = async () => {
    if (!selectedCatForAttrs) return;
    if (!attrForm.key.trim() || !attrForm.label.trim()) {
      Alert.alert('تنبيه', 'أدخل المفتاح والعنوان');
      return;
    }
    const roleDefaults = deriveRoleDefaults(attrForm.uiRole);
    const nextKey = roleDefaults?.key ?? attrForm.key.trim();
    const nextLabel = roleDefaults?.label ?? attrForm.label.trim();
    const nextType = roleDefaults?.value_type ?? attrForm.value_type;
    if (attrForm.uiRole !== 'dynamic') {
      const roleTaken = attrDefs.some((d) => {
        if (editingAttrDef && d.id === editingAttrDef.id) return false;
        return (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === attrForm.uiRole;
      });
      if (roleTaken) {
        Alert.alert('تنبيه', 'هذا النوع من الحقول موجود مسبقاً لهذه الفئة');
        return;
      }
    }
    const sortOrderNum = Number(attrForm.sortOrder);
    const maxPhotosNum = Number(attrForm.maxPhotos);
    const options = {
      uiRole: attrForm.uiRole,
      sortOrder: Number.isFinite(sortOrderNum) ? sortOrderNum : undefined,
      maxPhotos:
        attrForm.uiRole === 'place_photos' && Number.isFinite(maxPhotosNum) && maxPhotosNum > 0
          ? maxPhotosNum
          : undefined,
    };
    try {
      if (editingAttrDef) {
        const res = await api.updateAttributeDefinition(selectedCatForAttrs.id, editingAttrDef.id, {
          key: nextKey,
          label: nextLabel,
          value_type: nextType,
          is_required: attrForm.is_required,
          options,
        });
        if (res?.data) {
          setAttrDefs((prev) =>
            prev.map((d) => (d.id === editingAttrDef.id ? (res.data as AttrDef) : d)).sort((a, b) => a.key.localeCompare(b.key)),
          );
        }
        Alert.alert('✅ تم', 'تم تحديث الخاصية');
      } else {
        const res = await api.createAttributeDefinition(selectedCatForAttrs.id, {
          key: nextKey,
          label: nextLabel,
          value_type: nextType,
          is_required: attrForm.is_required,
          options,
        });
        if (res?.data) {
          setAttrDefs((prev) => [...prev, res.data as AttrDef].sort((a, b) => a.key.localeCompare(b.key)));
        }
        Alert.alert('✅ تم', 'تمت إضافة الخاصية');
      }
      setShowAttrModal(false);
      setEditingAttrDef(null);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ');
    }
  };

  const closeAttrModal = () => {
    setShowAttrModal(false);
    setEditingAttrDef(null);
  };

  const confirmDeleteAttr = (def: AttrDef) => {
    if (!selectedCatForAttrs) return;
    Alert.alert('حذف الخاصية', `حذف "${def.label}" (${def.key})؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAttributeDefinition(selectedCatForAttrs.id, def.id);
            setAttrDefs((prev) => prev.filter((d) => d.id !== def.id));
            Alert.alert('✅ تم', 'تم حذف الخاصية');
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل الحذف');
          }
        },
      },
    ]);
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredCategories = (q
    ? visibleCategories.filter((c) => c.name.toLowerCase().includes(q))
    : visibleCategories
  ).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return {
    visibleCategories,
    showCategoryModal,
    setShowCategoryModal,
    editingCategory,
    categoryForm,
    setCategoryForm,
    searchQuery,
    setSearchQuery,
    selectedCatForAttrs,
    setSelectedCatForAttrs,
    attrDefs,
    loadingAttrs,
    showAttrModal,
    setShowAttrModal,
    editingAttrDef,
    classificationLinked,
    checkingClassificationLinked,
    attrForm,
    setAttrForm,
    getPlacesCount,
    openAddCategory,
    openEditCategory,
    saveCategory,
    handleDeleteCategory,
    openAttrDefs,
    openAddAttr,
    openEditAttr,
    saveAttrDef,
    closeAttrModal,
    confirmDeleteAttr,
    refreshClassificationLinked,
    filteredCategories,
    query: q,
  };
}
