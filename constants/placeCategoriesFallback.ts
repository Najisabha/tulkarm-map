import type { PlaceCategoryTreeItem } from '../types/placeCategories';

/**
 * Fallback global place categories (place_categories) used when API is unavailable.
 * Keep it small, generic, and stable.
 */
export const STATIC_PLACE_CATEGORIES_FALLBACK: PlaceCategoryTreeItem[] = [
  {
    main: { id: 'fallback-clothes', name: 'ملابس', emoji: '👕', color: '#2563EB' },
    sub_categories: [
      { id: 'fallback-clothes-men', name: 'رجالي', emoji: '👔', color: null },
      { id: 'fallback-clothes-women', name: 'نسائي', emoji: '👗', color: null },
      { id: 'fallback-clothes-kids', name: 'أطفال', emoji: '🧒', color: null },
    ],
  },
  {
    main: { id: 'fallback-food', name: 'طعام', emoji: '🍽️', color: '#DC2626' },
    sub_categories: [
      { id: 'fallback-food-restaurants', name: 'مطاعم', emoji: '🍔', color: null },
      { id: 'fallback-food-bakeries', name: 'مخابز', emoji: '🥐', color: null },
      { id: 'fallback-food-sweets', name: 'حلويات', emoji: '🍰', color: null },
    ],
  },
  {
    main: { id: 'fallback-services', name: 'خدمات', emoji: '🧰', color: '#16A34A' },
    sub_categories: [
      { id: 'fallback-services-salons', name: 'صالونات', emoji: '💇', color: null },
      { id: 'fallback-services-repair', name: 'صيانة', emoji: '🛠️', color: null },
      { id: 'fallback-services-education', name: 'تعليم', emoji: '🎓', color: null },
    ],
  },
];

