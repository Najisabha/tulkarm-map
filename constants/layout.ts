import { Platform } from 'react-native';

/**
 * قيم التخطيط الموحدة للموبايل والويب.
 * الأساس: الموبايل — والويب يستخدم نفس القيم (Android) لضمان تجربة متطابقة.
 */
export const LAYOUT = {
  /** المسافة من أعلى الشاشة للـ header (safe area) */
  headerTop: Platform.OS === 'ios' ? 54 : 40,

  /** المسافة السفلية لشريط الفئات */
  categoryBarPaddingBottom: Platform.OS === 'ios' ? 28 : 14,

  /** المسافة العلوية لـ sidebar header */
  sidebarHeaderTop: Platform.OS === 'ios' ? 54 : 40,

  /** المسافة العلوية لـ modal header */
  modalHeaderTop: Platform.OS === 'ios' ? 54 : 24,

  /** سلوك KeyboardAvoidingView */
  keyboardBehavior: Platform.OS === 'ios' ? ('padding' as const) : undefined,
} as const;
