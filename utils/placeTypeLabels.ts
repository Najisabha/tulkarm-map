export type PlaceTypeKind = 'house' | 'store' | 'residentialComplex' | 'commercialComplex' | 'other';

export function normalizePlaceTypeKind(name?: string | null): PlaceTypeKind {
  let n = String(name ?? '').trim();
  if (!n) return 'other';

  // دعم أسماء إنجليزية شائعة (لتفادي اختلافات عند وجود fallback/بيانات قديمة)
  const english = n.toLowerCase();

  // توحيد بسيط: إزالة تشكيل/تنوين/مدّ/مسافات زائدة لتقليل مشاكل اختلافات الكتابة.
  // لا نستخدم transliteration؛ فقط تنظيف العربية.
  n = n
    .replace(/[\u064B-\u065F]/g, '') // diacritics
    .replace(/ـ/g, '') // tatweel
    .replace(/\s+/g, ' ');

  // "أخرى" كحالة صريحة
  if (/^(أخرى|اخرى)$/i.test(n) || n.includes('أخرى') || n.includes('اخرى')) return 'other';
  if (english === 'other' || english.includes(' other') || english.includes('other ')) return 'other';

  const hasMajma3 = /مجمع/.test(n);

  // الإنجليزية: مجمعات سكنية/تجارية
  if (english.includes('residential') && english.includes('complex')) return 'residentialComplex';
  if (english.includes('commercial') && english.includes('complex')) return 'commercialComplex';

  const isResidentialComplex =
    hasMajma3 && /(سكني|سكنية|سكن|إسكان)/.test(n);

  const isCommercialComplex =
    hasMajma3 && /(تجاري|تجارية|تجار|محلات|محل تجاري|متجر|متاجر)/.test(n);

  if (isResidentialComplex) return 'residentialComplex';
  if (isCommercialComplex) return 'commercialComplex';

  // المتاجر/المحلات: أي شيء فيه "متجر" أو "متاجر" أو "محل" بدون "مجمع"
  if (!hasMajma3 && /(متجر|متاجر|محل|محلات)/.test(n)) return 'store';
  if (!hasMajma3 && (english.includes('store') || english.includes('shop') || english.includes('mall'))) return 'store';

  // المنازل/البيوت/المساكن: أي شيء فيه "منزل" أو "منازل" أو "بيت" أو "بيوت"
  if (!hasMajma3 && /(منزل|منازل|بيت|بيوت|مسكن|مساكن)/.test(n)) return 'house';
  if (!hasMajma3 && (english.includes('house') || english.includes('home') || english.includes('villa') || english.includes('apartment'))) return 'house';

  return 'other';
}

/**
 * توحيد عرض أنواع الأماكن ليتطابق مع الطلب (مفرد).
 * يترك معرفات `type_id` كما هي، ويغير فقط نص العرض.
 */
export function getPlaceTypeDisplayName(name?: string | null): string {
  switch (normalizePlaceTypeKind(name)) {
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
 * توحيد عرض أنواع الأماكن داخل قائمة الاختيار (جمع).
 */
export function getPlaceTypePluralLabel(name?: string | null): string {
  switch (normalizePlaceTypeKind(name)) {
    case 'house':
      return 'المنازل';
    case 'store':
      return 'المتاجر';
    case 'residentialComplex':
      return 'المجمعات السكنية';
    case 'commercialComplex':
      return 'المجمعات التجارية';
    case 'other':
    default:
      return 'أخرى';
  }
}

