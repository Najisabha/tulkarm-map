/**
 * تعريف موحّد للحقول الديناميكية حسب نوع المكان.
 * يُستخدم في AddPlaceModal وفي شاشة التعديل admin-stores.
 */

import {
  getAddPlaceModalPhotoLabel,
  getGovExtraLocationFieldLabel,
  getPlaceFormFieldLabel,
  getPlaceTypeAttrLabelsForKeys,
  getPlaceTypeDisplayName,
  getPlaceTypeProductCategoryFieldLabels,
  isGovStyleCategoryFields,
  normalizePlaceTypeKind,
  usesPlacePhoneAsStoreNumberField,
} from './placeTypeLabels';
import { coalesceFlags, resolvePlaceTypeRowByName } from './placeTypesRegistry';
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
  const uid = (s: string) => `fixed-${trimmedName.replace(/\s+/g, '_')}-${s}`;
  const kind = normalizePlaceTypeKind(trimmedName);
  const row = resolvePlaceTypeRowByName(trimmedName);
  const flags = coalesceFlags(row?.flags);
  const attrLabels = getPlaceTypeAttrLabelsForKeys(trimmedName);

  const productFieldLabels = getPlaceTypeProductCategoryFieldLabels(trimmedName);
  if (productFieldLabels && flags.productCategoryForm) {
    return [
      { id: uid('store_type'), key: 'store_type', label: productFieldLabels.main, value_type: 'string', is_required: true },
      { id: uid('store_category'), key: 'store_category', label: productFieldLabels.sub, value_type: 'string', is_required: true },
      { id: uid('store_number'), key: 'store_number', label: productFieldLabels.number, value_type: 'phone', is_required: true },
    ];
  }

  if (productFieldLabels && isGovStyleCategoryFields(trimmedName)) {
    const out: PlaceAttrDef[] = [
      { id: uid('store_type'), key: 'store_type', label: productFieldLabels.main, value_type: 'string', is_required: true },
      { id: uid('store_category'), key: 'store_category', label: productFieldLabels.sub, value_type: 'string', is_required: true },
      { id: uid('store_number'), key: 'store_number', label: productFieldLabels.number, value_type: 'phone', is_required: true },
    ];
    const loc = getGovExtraLocationFieldLabel(trimmedName);
    if (loc) {
      out.push({ id: uid('location_text'), key: 'location_text', label: loc, value_type: 'string', is_required: false });
    }
    return out;
  }

  switch (kind) {
    case 'house': {
      const lab = attrLabels.house_number;
      if (!lab) return [];
      return [{ id: uid('house_number'), key: 'house_number', label: lab, value_type: 'string', is_required: true }];
    }
    case 'store': {
      const lt = attrLabels.store_type;
      const lc = attrLabels.store_category;
      const ln = attrLabels.store_number;
      if (!lt || !lc || !ln) return [];
      return [
        { id: uid('store_type'), key: 'store_type', label: lt, value_type: 'string', is_required: true },
        { id: uid('store_category'), key: 'store_category', label: lc, value_type: 'string', is_required: true },
        { id: uid('store_number'), key: 'store_number', label: ln, value_type: 'phone', is_required: true },
      ];
    }
    case 'residentialComplex':
    case 'commercialComplex': {
      const lab = attrLabels.complex_number;
      if (!lab) return [];
      return [{ id: uid('complex_number'), key: 'complex_number', label: lab, value_type: 'string', is_required: true }];
    }
    default: {
      const lab = attrLabels.location_text;
      if (!lab) return [];
      return [{ id: uid('location_text'), key: 'location_text', label: lab, value_type: 'string', is_required: false }];
    }
  }
}

export function getBaseFormAttrDefsForType(typeName: string): PlaceAttrDef[] {
  const trimmedName = typeName?.trim() ?? '';
  const uid = (s: string) => `base-${trimmedName.replace(/\s+/g, '_')}-${s}`;
  const nameLabel = getPlaceFormFieldLabel(trimmedName, 'nameFieldLabel');
  const singular = getPlaceTypeDisplayName(trimmedName);
  const photoLabel = getAddPlaceModalPhotoLabel(trimmedName);
  const mapLoc = getPlaceFormFieldLabel(trimmedName, 'mapLocationFieldLabel');
  const descLab = getPlaceFormFieldLabel(trimmedName, 'descriptionFieldLabel');
  const phoneFallback = getPlaceFormFieldLabel(trimmedName, 'phoneFieldFallbackLabel');

  const base: PlaceAttrDef[] = [
    {
      id: uid('place_location'),
      key: 'place_location',
      label: mapLoc,
      value_type: 'json',
      is_required: true,
      options: { uiRole: 'place_location', sortOrder: 5 },
    },
    {
      id: uid('place_name'),
      key: 'place_name',
      label: nameLabel || singular,
      value_type: 'string',
      is_required: true,
      options: { uiRole: 'place_name', sortOrder: 10 },
    },
    {
      id: uid('place_description'),
      key: 'place_description',
      label: descLab,
      value_type: 'string',
      is_required: false,
      options: { uiRole: 'place_description', sortOrder: 20 },
    },
  ];
  if (!usesPlacePhoneAsStoreNumberField(trimmedName)) {
    base.push({
      id: uid('place_phone'),
      key: 'place_phone',
      label: phoneFallback,
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
