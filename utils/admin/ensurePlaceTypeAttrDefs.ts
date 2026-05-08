import { api } from '../../api/client';
import type { AttrDef } from './categoryAdminHelpers';
import { sortAttributeDefinitions } from './categoryAdminHelpers';

/**
 * جلب تعريفات الخصائص من الخادم فقط (إدارة الفئات → الخصائص)، بدون حقول ثابتة من التطبيق.
 */
export async function fetchPlaceTypeAttributeDefinitions(typeId: string): Promise<AttrDef[]> {
  const res = await api.getAttributeDefinitions(typeId);
  const list = Array.isArray(res.data) ? (res.data as AttrDef[]) : [];
  return sortAttributeDefinitions(list);
}
