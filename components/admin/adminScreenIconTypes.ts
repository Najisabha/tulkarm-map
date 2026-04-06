/** أسماء الأيقونات المستخدمة في لوحة الإدارة فقط — بدون استيراد vector-icons للأنواع على الويب. */
export type AdminDashboardIconName =
  | 'home'
  | 'storefront'
  | 'apartment'
  | 'business'
  | 'place'
  | 'map'
  | 'category'
  | 'people'
  | 'playlist-add'
  | 'flag'
  | 'arrow-forward'
  | 'verified-user'
  | 'history'
  | 'label'
  | 'settings'
  | 'cloud-download'
  | 'logout';

export type AdminScreenIconProps = {
  name: AdminDashboardIconName;
  size: number;
  color: string;
  webGlyph: string;
};
