/**
 * تعريف موحّد للحقول الديناميكية حسب نوع المكان.
 * يُستخدم في AddPlaceModal وفي شاشة التعديل admin-stores.
 */

import {
  getAddPlaceModalPhotoLabel,
  getPlaceTypeDisplayName,
  getPlaceTypeProductCategoryFieldLabels,
  usesPlacePhoneAsStoreNumberField,
  normalizePlaceTypeKind,
  resolveCanonicalPlaceTypeKey,
} from './placeTypeLabels';
import type { AttrUiRole } from './admin/categoryAdminHelpers';

export interface PlaceAttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: {
    uiRole?: AttrUiRole;
    sortOrder?: number;
    maxPhotos?: number;
  };
}

export function getPlaceAttrDefsForType(typeName: string): PlaceAttrDef[] {
  const trimmedName = typeName?.trim() ?? '';
  const kind = normalizePlaceTypeKind(trimmedName);
  const uid = (s: string) => `fixed-${trimmedName.replace(/\s+/g, '_')}-${s}`;

  const productFieldLabels = getPlaceTypeProductCategoryFieldLabels(trimmedName);
  if (productFieldLabels) {
    return [
      { id: uid('store_type'), key: 'store_type', label: productFieldLabels.main, value_type: 'string', is_required: true },
      { id: uid('store_category'), key: 'store_category', label: productFieldLabels.sub, value_type: 'string', is_required: true },
      { id: uid('store_number'), key: 'store_number', label: productFieldLabels.number, value_type: 'phone', is_required: true },
    ];
  }

  const canon = resolveCanonicalPlaceTypeKey(trimmedName);
  if (canon === 'مؤسسة حكومية') {
    return [
      { id: uid('store_type'), key: 'store_type', label: 'التصنيف الرئيسي للمؤسسة الحكومية', value_type: 'string', is_required: true },
      { id: uid('store_category'), key: 'store_category', label: 'التصنيف الفرعي للمؤسسة الحكومية', value_type: 'string', is_required: true },
      { id: uid('store_number'), key: 'store_number', label: 'رقم هاتف المؤسسة الحكومية', value_type: 'phone', is_required: true },
      { id: uid('location_text'), key: 'location_text', label: 'وصف الموقع', value_type: 'string', is_required: false },
    ];
  }

  switch (kind) {
    case 'house':
      return [{ id: uid('house_number'), key: 'house_number', label: 'رقم المنزل', value_type: 'string', is_required: true }];
    case 'store':
      return [
        { id: uid('store_type'), key: 'store_type', label: 'التصنيف الرئيسي\u200c للمتجر', value_type: 'string', is_required: true },
        { id: uid('store_category'), key: 'store_category', label: 'التصنيف الفرعي\u200c للمتجر', value_type: 'string', is_required: true },
        { id: uid('store_number'), key: 'store_number', label: 'رقم هاتف المتجر', value_type: 'phone', is_required: true },
      ];
    case 'residentialComplex':
      return [
        { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع', value_type: 'string', is_required: true },
      ];
    case 'commercialComplex':
      return [
        { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع التجاري', value_type: 'string', is_required: true },
      ];
    default:
      return [{ id: uid('location_text'), key: 'location_text', label: 'وصف الموقع', value_type: 'string', is_required: false }];
  }
}

export function getBaseFormAttrDefsForType(typeName: string): PlaceAttrDef[] {
  const trimmedName = typeName?.trim() ?? '';
  const uid = (s: string) => `base-${trimmedName.replace(/\s+/g, '_')}-${s}`;
  const singular = getPlaceTypeDisplayName(trimmedName);
  const photoLabel = getAddPlaceModalPhotoLabel(trimmedName);
  const base: PlaceAttrDef[] = [
    {
      id: uid('place_location'),
      key: 'place_location',
      label: 'الموقع على الخريطة',
      value_type: 'json',
      is_required: true,
      options: { uiRole: 'place_location', sortOrder: 5 },
    },
    {
      id: uid('place_name'),
      key: 'place_name',
      label: singular === 'منزل' ? 'اسم صاحب المنزل' : `اسم ${singular}`,
      value_type: 'string',
      is_required: true,
      options: { uiRole: 'place_name', sortOrder: 10 },
    },
    {
      id: uid('place_description'),
      key: 'place_description',
      label: 'الوصف',
      value_type: 'string',
      is_required: false,
      options: { uiRole: 'place_description', sortOrder: 20 },
    },
  ];
  if (!usesPlacePhoneAsStoreNumberField(trimmedName)) {
    base.push({
      id: uid('place_phone'),
      key: 'place_phone',
      label: 'رقم الهاتف',
      value_type: 'phone',
      is_required: false,
      options: { uiRole: 'place_phone', sortOrder: 30 },
    });
  }
  if (photoLabel) {
    base.push({
      id: uid('place_photos'),
      key: 'place_photos',
      label: photoLabel,
      value_type: 'json',
      is_required: false,
      options: { uiRole: 'place_photos', sortOrder: 900, maxPhotos: 3 },
    });
  }
  return base;
}

export function getAllPlaceAttrDefsForType(typeName: string): PlaceAttrDef[] {
  const base = getBaseFormAttrDefsForType(typeName);
  const dynamic = getPlaceAttrDefsForType(typeName).map((def, idx) => ({
    ...def,
    options: {
      ...(def.options ?? {}),
      uiRole: 'dynamic' as const,
      sortOrder: 100 + idx * 10,
    },
  }));
  return [...base, ...dynamic];
}
