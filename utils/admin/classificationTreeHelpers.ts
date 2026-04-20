import type { PlaceType } from '../../api/client';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';

export const COLOR_PRESETS = ['#2E86AB', '#16A34A', '#DC2626', '#7C3AED', '#F59E0B', '#EC4899', '#0B2A3A'];

/**
 * عنصر اختيار في شاشة شجرة التصنيفات بعد التحويل لبيانات ديناميكية من DB.
 * - id = place_type_id
 * - name/emoji/color تأتي مباشرة من قاعدة البيانات
 */
export interface ClassificationPickerItem {
  id: string;
  name: string;
  emoji: string;
  color: string | null;
  pluralLabel: string;
}

/** نموذج قطاع قديم — يُحتفظ به فقط لتوافق preselect القادم بمعرف ثابت قديم. */
export interface ClassificationSector {
  id: string;
  pluralLabel: string;
  typeName: string;
  webGlyph: string;
}

/**
 * قائمة قديمة تستخدم فقط لمطابقة معرف قديم (مثل `store`) إلى اسم نوع المكان
 * لاسترجاع `place_type_id` الفعلي من DB. لم تعد مصدراً لعرض القطاعات.
 */
export const CLASSIFICATION_SECTORS: ClassificationSector[] = [
  { id: 'store', pluralLabel: 'المتاجر', typeName: 'متجر تجاري', webGlyph: '🏪' },
  { id: 'restaurant', pluralLabel: 'المطاعم', typeName: 'مطعم', webGlyph: '🍽️' },
  { id: 'office', pluralLabel: 'المكاتب', typeName: 'مكتب', webGlyph: '🏢' },
  { id: 'hospital', pluralLabel: 'المستشفيات', typeName: 'مستشفى', webGlyph: '🏥' },
  { id: 'clinic', pluralLabel: 'العيادات', typeName: 'عيادة', webGlyph: '⚕️' },
  { id: 'salon', pluralLabel: 'الصالونات', typeName: 'صالون', webGlyph: '💇' },
  { id: 'edu', pluralLabel: 'المؤسسات التعليمية', typeName: 'مؤسسة تعليمية', webGlyph: '🏫' },
  { id: 'gov', pluralLabel: 'المؤسسات الحكومية', typeName: 'مؤسسة حكومية', webGlyph: '🏛️' },
];

/** تحويل معرف قطاع قديم (مثل `store`) إلى اسم النوع المطابق في DB. */
export function legacySectorIdToTypeName(sectorId: string): string | null {
  return CLASSIFICATION_SECTORS.find((s) => s.id === sectorId)?.typeName ?? null;
}

export interface PlaceCategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  sort_order: number;
  parent_id: string | null;
  place_type_id: string;
}

export function resolvePlaceTypeId(
  sectorId: string | null,
  placeTypes: PlaceType[],
): string | null {
  if (!sectorId) return null;
  const selected = CLASSIFICATION_SECTORS.find((s) => s.id === sectorId);
  if (!selected) return null;
  const match = placeTypes.find((t) => t.name === selected.typeName);
  return match?.id ?? null;
}

/** يطابق اسم نوع المكان (مثل «مطعم») مع قطاع شجرة التصنيفات إن وُجد. */
export function classificationSectorIdForPlaceTypeName(typeName: string): string | null {
  const t = typeName?.trim() ?? '';
  if (!t) return null;
  return CLASSIFICATION_SECTORS.find((s) => s.typeName === t)?.id ?? null;
}

export function flattenTree(
  tree: PlaceCategoryTreeItem[],
  placeTypeId: string | null,
): PlaceCategoryRow[] {
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
}
