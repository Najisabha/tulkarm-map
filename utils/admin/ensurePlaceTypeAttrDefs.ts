import { api } from '../../api/client';
import type { AttrDef } from './categoryAdminHelpers';
import { parseAttrUiOptions } from './categoryAdminHelpers';
import { getAllPlaceAttrDefsForType } from '../placeFormAttrDefs';

function mapFixedValueTypeToApi(vt: string): string {
  return vt === 'phone' ? 'phone' : vt;
}

/**
 * يضمن وجود الخصائص الافتراضية في الـ API ثم يعيد القائمة الكاملة من الخادم.
 */
export async function ensureAndFetchAttributeDefinitions(typeId: string, typeName: string): Promise<AttrDef[]> {
  const fixed = getAllPlaceAttrDefsForType(typeName);
  const res = await api.getAttributeDefinitions(typeId);
  let list: AttrDef[] = Array.isArray(res.data) ? (res.data as AttrDef[]) : [];
  for (const f of fixed) {
    const exists = list.some((d) => d.key === f.key);
    if (!exists) {
      try {
        const created = await api.createAttributeDefinition(typeId, {
          key: f.key,
          label: f.label,
          value_type: mapFixedValueTypeToApi(f.value_type),
          is_required: f.is_required,
          options: f.options,
        });
        if (created?.data) {
          list = [...list, created.data as AttrDef];
        }
      } catch {
        const again = await api.getAttributeDefinitions(typeId);
        list = Array.isArray(again.data) ? (again.data as AttrDef[]) : list;
      }
    }
  }
  const finalRes = await api.getAttributeDefinitions(typeId);
  const finalList = Array.isArray(finalRes.data) ? (finalRes.data as AttrDef[]) : list;
  return finalList.sort((a, b) => {
    const ao = parseAttrUiOptions(a.options);
    const bo = parseAttrUiOptions(b.options);
    const ad = ao.sortOrder ?? 9999;
    const bd = bo.sortOrder ?? 9999;
    if (ad !== bd) return ad - bd;
    return a.key.localeCompare(b.key);
  });
}
