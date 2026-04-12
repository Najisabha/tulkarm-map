export type PlaceTypeKind = 'house' | 'store' | 'residentialComplex' | 'commercialComplex' | 'other';

/**
 * الأسماء الـ15 الكنسية — يجب أن تطابق بذرة `place_types` في `server/scripts/migrate-v1.js`.
 * مصدر واحد للتحقق من «اكتمال الخريطة» في الواجهة.
 */
export const CANONICAL_PLACE_TYPE_NAMES = [
  'منزل',
  'متجر تجاري',
  'مجمّع تجاري',
  'مجمّع سكني',
  'مطعم',
  'مسجد',
  'كنيسة',
  'موقف سيارات',
  'مكتب',
  'مستشفى',
  'عيادة',
  'صالون',
  'مؤسسة تعليمية',
  'مؤسسة حكومية',
  'أخرى',
] as const;

export type CanonicalPlaceTypeName = (typeof CANONICAL_PLACE_TYPE_NAMES)[number];

/** لا يُسمح بربط وحدة داخل مجمّع بمكان من هذين النوعين */
export const PLACE_TYPES_DISALLOWED_AS_COMPLEX_UNIT_CHILD: readonly CanonicalPlaceTypeName[] = [
  'مجمّع تجاري',
  'مجمّع سكني',
] as const;

/**
 * أنواع تُعرض لها حقول تصنيف المنتجات (رئيسي/فرعي) + رقم + صور في مودال الإضافة —
 * بدون تصنيف رئيسي/فرعي: مسجد، كنيسة، موقف سيارات، مؤسسة حكومية، أخرى (نموذج بسيط + صور حيث ينطبق).
 */
export const PLACE_TYPES_WITH_PRODUCT_CATEGORY_FORM_FIELDS: readonly CanonicalPlaceTypeName[] = [
  'مطعم',
  'مكتب',
  'مستشفى',
  'عيادة',
  'صالون',
  'مؤسسة تعليمية',
] as const;

/** بادئة «لـ…» لعناوين التصنيف (تلاصق مع «التصنيف الرئيسي») */
const LI_PREFIX_FOR_CATEGORY_LABELS: Partial<Record<CanonicalPlaceTypeName, string>> = {
  مطعم: 'للمطعم',
  مكتب: 'للمكتب',
  مستشفى: 'للمستشفى',
  عيادة: 'للعيادة',
  صالون: 'للصالون',
  'مؤسسة تعليمية': 'للمؤسسة التعليمية',
};

const RAQM_LABEL_BY_TYPE: Partial<Record<CanonicalPlaceTypeName, string>> = {
  مطعم: 'رقم هاتف المطعم',
  مكتب: 'رقم هاتف المكتب',
  مستشفى: 'رقم هاتف المستشفى',
  عيادة: 'رقم هاتف العيادة',
  صالون: 'رقم هاتف الصالون',
  'مؤسسة تعليمية': 'رقم هاتف المؤسسة التعليمية',
};

/** صور مودال الإضافة للأنواع التي لها حقول تصنيف منتجات */
const PHOTOS_LABEL_BY_TYPE: Partial<Record<CanonicalPlaceTypeName, string>> = {
  مطعم: 'صور المطعم',
  مكتب: 'صور المكتب',
  مستشفى: 'صور المستشفى',
  عيادة: 'صور العيادة',
  صالون: 'صور الصالون',
  'مؤسسة تعليمية': 'صور المؤسسة التعليمية',
};

/** صور مودال الإضافة للأنواع البسيطة (بدون تصنيف رئيسي/فرعي) */
const PHOTOS_LABEL_SIMPLE_PLACE_TYPES: Partial<Record<CanonicalPlaceTypeName, string>> = {
  مسجد: 'صور المسجد',
  كنيسة: 'صور الكنيسة',
  'موقف سيارات': 'صور موقف السيارات',
  'مؤسسة حكومية': 'صور المؤسسة الحكومية',
};

export function usesProductCategoryFieldsForPlaceType(name?: string | null): boolean {
  const key = resolveCanonicalPlaceTypeKey(name);
  if (!key) return false;
  return (PLACE_TYPES_WITH_PRODUCT_CATEGORY_FORM_FIELDS as readonly string[]).includes(key);
}

/**
 * متجر + مطعم + مكتب + مستشفى + عيادة + صالون + مؤسسة تعليمية + مؤسسة حكومية:
 * لا يُعرض حقل «رقم الهاتف» المنفصل؛ حقل «رقم …» الديناميكي (store_number) يمثّل رقم الهاتف ويُرسل كـ phone_number.
 */
const PLACE_TYPES_WITH_PLACE_PHONE_AS_STORE_NUMBER: readonly CanonicalPlaceTypeName[] = [
  'متجر تجاري',
  'مطعم',
  'مكتب',
  'مستشفى',
  'عيادة',
  'صالون',
  'مؤسسة تعليمية',
  'مؤسسة حكومية',
] as const;

export function usesPlacePhoneAsStoreNumberField(name?: string | null): boolean {
  const key = resolveCanonicalPlaceTypeKey(name);
  if (!key) return false;
  return (PLACE_TYPES_WITH_PLACE_PHONE_AS_STORE_NUMBER as readonly string[]).includes(key);
}

/** عناوين حقول التصنيف/الرقم/الصور لمودال الإضافة لهذه الأنواع فقط */
export function getPlaceTypeProductCategoryFieldLabels(name?: string | null): {
  main: string;
  sub: string;
  number: string;
  photos: string;
} | null {
  const key = resolveCanonicalPlaceTypeKey(name);
  if (!key || !(PLACE_TYPES_WITH_PRODUCT_CATEGORY_FORM_FIELDS as readonly string[]).includes(key)) return null;
  const li = LI_PREFIX_FOR_CATEGORY_LABELS[key];
  const rq = RAQM_LABEL_BY_TYPE[key];
  const ph = PHOTOS_LABEL_BY_TYPE[key];
  if (!li || !rq || !ph) return null;
  // مسافة بين «الرئيسي/الفرعي» و«للمطعم» تمنع التلاصق (الرئيسيللمطعم) على أندرويد/آي أو إس
  return {
    main: `التصنيف الرئيسي ${li}`,
    sub: `التصنيف الفرعي ${li}`,
    number: rq,
    photos: ph,
  };
}

/** عنوان قسم الصور في مودال إضافة المكان (أو null = لا يُعرض القسم) */
export function getAddPlaceModalPhotoLabel(name?: string | null): string | null {
  const key = resolveCanonicalPlaceTypeKey(name);
  if (!key) return null;
  if (usesProductCategoryFieldsForPlaceType(name)) {
    return getPlaceTypeProductCategoryFieldLabels(name)?.photos ?? null;
  }
  if (key === 'منزل') return 'صور المنزل';
  if (key === 'متجر تجاري') return 'صور المتجر';
  return PHOTOS_LABEL_SIMPLE_PLACE_TYPES[key] ?? null;
}

/** جمع عناوين الاختيار في المودال — مفاتيحها = CANONICAL_PLACE_TYPE_NAMES */
const PLURAL_LABELS: Record<CanonicalPlaceTypeName, string> = {
  منزل: 'المنازل',
  'متجر تجاري': 'المتاجر',
  'مجمّع تجاري': 'المجمعات التجارية',
  'مجمّع سكني': 'المجمعات السكنية',
  مطعم: 'المطاعم',
  مسجد: 'المساجد',
  كنيسة: 'الكنائس',
  'موقف سيارات': 'مواقف السيارات',
  مكتب: 'المكاتب',
  مستشفى: 'المستشفيات',
  عيادة: 'العيادات',
  صالون: 'الصالونات',
  'مؤسسة تعليمية': 'المؤسسات التعليمية',
  'مؤسسة حكومية': 'المؤسسات الحكومية',
  أخرى: 'أخرى',
};

const PLURAL_KEYS = CANONICAL_PLACE_TYPE_NAMES as readonly string[];

function stripArabicForCompare(s: string): string {
  return s
    .replace(/[\u064B-\u065F]/g, '') // تشكيل وتنوين وشدة
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** أسماء قديمة/مختصرة → المفتاح الكنسي في PLURAL_LABELS */
const ALIAS_TO_CANONICAL: Record<string, CanonicalPlaceTypeName> = {
  متجر: 'متجر تجاري',
  'مجمع تجاري': 'مجمّع تجاري',
  'مجمع سكني': 'مجمّع سكني',
  'موقف سيارات بالأجرة': 'موقف سيارات',
};

const CANONICAL_TO_KIND: Partial<Record<CanonicalPlaceTypeName, PlaceTypeKind>> = {
  منزل: 'house',
  'متجر تجاري': 'store',
  'مجمّع تجاري': 'commercialComplex',
  'مجمّع سكني': 'residentialComplex',
  أخرى: 'other',
};

/**
 * يطابق اسم النوع القادم من الـ API إلى أحد الأسماء الـ15 الكنسية
 * (تجاهل التشكيل، و«مجمع» بدون شدة، و«متجر» بدون «تجاري»).
 */
export function resolveCanonicalPlaceTypeKey(name?: string | null): CanonicalPlaceTypeName | null {
  if (!name) return null;
  const trimmed = name.trim();
  const en = trimmed.toLowerCase();
  if (en === 'parking' || /\bcar\s*park\b/.test(en) || en === 'carpark') {
    return 'موقف سيارات';
  }
  const normalized = stripArabicForCompare(trimmed);
  if (!normalized) return null;

  for (const key of PLURAL_KEYS) {
    if (stripArabicForCompare(key) === normalized) {
      return key as CanonicalPlaceTypeName;
    }
  }

  const viaAlias = ALIAS_TO_CANONICAL[normalized];
  if (viaAlias) return viaAlias;

  return null;
}

export function isDisallowedComplexUnitChildTypeName(name?: string | null): boolean {
  const key = resolveCanonicalPlaceTypeKey(name);
  if (!key) return false;
  return (PLACE_TYPES_DISALLOWED_AS_COMPLEX_UNIT_CHILD as readonly string[]).includes(key);
}

export function normalizePlaceTypeKind(name?: string | null): PlaceTypeKind {
  let n = String(name ?? '').trim();
  if (!n) return 'other';

  const canonical = resolveCanonicalPlaceTypeKey(n);
  if (canonical) {
    return CANONICAL_TO_KIND[canonical] ?? 'other';
  }

  const english = n.toLowerCase();

  n = n
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ');

  if (/^(أخرى|اخرى)$/i.test(n) || n.includes('أخرى') || n.includes('اخرى')) return 'other';
  if (english === 'other' || english.includes(' other') || english.includes('other ')) return 'other';

  const hasMajma3 = /مجمع/.test(n);

  if (english.includes('residential') && english.includes('complex')) return 'residentialComplex';
  if (english.includes('commercial') && english.includes('complex')) return 'commercialComplex';

  const isResidentialComplex = hasMajma3 && /(سكني|سكنية|سكن|إسكان)/.test(n);
  const isCommercialComplex = hasMajma3 && /(تجاري|تجارية|تجار|محلات|محل تجاري|متجر|متاجر)/.test(n);

  if (isResidentialComplex) return 'residentialComplex';
  if (isCommercialComplex) return 'commercialComplex';

  if (!hasMajma3 && /(متجر|متاجر|محل|محلات)/.test(n)) return 'store';
  if (!hasMajma3 && (english.includes('store') || english.includes('shop') || english.includes('mall'))) return 'store';

  if (!hasMajma3 && /(منزل|منازل|بيت|بيوت|مسكن|مساكن)/.test(n)) return 'house';
  if (!hasMajma3 && (english.includes('house') || english.includes('home') || english.includes('villa') || english.includes('apartment'))) {
    return 'house';
  }

  return 'other';
}

/**
 * متجر تجاري + أنواع لها حقول تصنيف منتجات في النماذج + مؤسسة حكومية (شجرة التصنيفات في الإدارة والخريطة).
 */
export function needsPlaceCategoryTree(typeName: string): boolean {
  const key = resolveCanonicalPlaceTypeKey(typeName);
  if (key === 'مؤسسة حكومية') return true;
  return normalizePlaceTypeKind(typeName) === 'store' || usesProductCategoryFieldsForPlaceType(typeName);
}

/**
 * توحيد عرض نوع المكان (مفرد) للواجهة.
 */
export function getPlaceTypeDisplayName(name?: string | null): string {
  if (!name) return 'أخرى';
  const trimmed = name.trim();
  const canonical = resolveCanonicalPlaceTypeKey(trimmed);
  if (canonical) return canonical;

  switch (normalizePlaceTypeKind(trimmed)) {
    case 'house':
      return 'منزل';
    case 'store':
      return 'متجر تجاري';
    case 'residentialComplex':
      return 'مجمّع سكني';
    case 'commercialComplex':
      return 'مجمّع تجاري';
    case 'other':
    default:
      return 'أخرى';
  }
}

/**
 * جمع عناوين البطاقات في «اختر نوع المكان».
 */
export function getPlaceTypePluralLabel(name?: string | null): string {
  if (!name) return 'أخرى';
  const canonical = resolveCanonicalPlaceTypeKey(name);
  if (canonical) return PLURAL_LABELS[canonical];
  return name.trim();
}
