/**
 * تعريف موحّد للحقول الديناميكية حسب نوع المكان.
 * يُستخدم في AddPlaceModal وفي شاشة التعديل admin-stores.
 */

import {
  getPlaceTypeProductCategoryFieldLabels,
  normalizePlaceTypeKind,
  resolveCanonicalPlaceTypeKey,
} from './placeTypeLabels';

export interface PlaceAttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
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
