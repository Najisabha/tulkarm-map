/**
 * منطق إرسال نماذج «إضافة مكان» من شاشة الخريطة (بدون React).
 * يُفصل هنا ليبقى المكوّن أخف وأسهل للقراءة.
 */

import { api } from '../../api/client';
import { placeService } from '../../services/placeService';
import { isValidPlaceTypeId, uriToBase64 } from './storeModel';
import { normalizePlaceTypeKind } from '../placeTypeLabels';

/** نفس شكل البيانات الذي يمرره AddPlaceModal إلى onSubmit */
export type MapAddPlaceSubmitData = {
  name: string;
  description: string;
  type_id: string;
  type_name: string;
  latitude: number;
  longitude: number;
  photos?: string[];
  videos?: string[];
  dynamicAttributes?: { key: string; value: string; value_type?: string }[];
  phoneNumber?: string;
};

/** إنشاء مكان جديد بعد النقر على الخريطة (مع رفع الصور عند الحاجة). */
export async function submitMapTapNewPlace(
  data: MapAddPlaceSubmitData,
  refresh: () => Promise<void>,
): Promise<void> {
  if (!isValidPlaceTypeId(data.type_id)) {
    throw new Error(
      'معرّف نوع المكان غير صالح. أغلق النافذة وافتح «إدارة الفئات» من لوحة الإدارة للتأكد من وجود الأنواع ثم أعد المحاولة.',
    );
  }

  const attributes = data.dynamicAttributes || [];

  let imageUrls: string[] = [];
  const uploadErrors: string[] = [];
  if (data.photos?.length) {
    for (const photoUri of data.photos) {
      try {
        const base64 = await uriToBase64(photoUri);
        const uploadRes = await api.uploadBase64(base64);
        const url = uploadRes?.data?.url;
        if (url && /^https?:\/\//i.test(url)) imageUrls.push(url);
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        uploadErrors.push(msg || 'فشل رفع صورة');
      }
    }
    if (imageUrls.length === 0) {
      throw new Error(
        uploadErrors[0] ||
          'فشل رفع الصور. تحقق من Cloudinary على السيرفر أو أزل الصور وأعد المحاولة.',
      );
    }
  }

  await api.createPlace({
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    type_id: data.type_id.trim(),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    phone_number: data.phoneNumber?.trim() || undefined,
    attributes: attributes.length ? attributes : undefined,
    image_urls: imageUrls.length ? imageUrls : undefined,
  });

  await refresh();
}

/** حالة نافذة «إضافة وحدة» داخل مجمّع (إحداثيات من الأب). */
export type MapAddUnitContext = {
  complexPlaceId: string;
  complexType: 'residential' | 'commercial';
  unitRowId: string;
  floorNumber: number;
  unitNumber: string;
  latitude: number;
  longitude: number;
};

/** إنشاء مكان وحدة داخل مجمّع وربطه بصف الوحدة في الخادم. */
export async function submitMapComplexUnit(
  data: MapAddPlaceSubmitData,
  ctx: MapAddUnitContext,
  refresh: () => Promise<void>,
): Promise<void> {
  if (!isValidPlaceTypeId(data.type_id)) {
    throw new Error('معرّف نوع المكان غير صالح.');
  }

  const unitLabel = `${ctx.floorNumber}-${ctx.unitNumber}`;
  const isHouse = normalizePlaceTypeKind(data.type_name) === 'house';
  const unitKey = isHouse ? 'house_number' : 'unit_number';
  const attrs = [...(data.dynamicAttributes || [])];
  const idx = attrs.findIndex((a) => a.key === unitKey);
  const def = attrs[idx];
  const merged = {
    key: unitKey,
    value: unitLabel,
    value_type: def?.value_type || (isHouse ? 'string' : 'text'),
  };
  if (idx >= 0) attrs[idx] = merged;
  else attrs.push(merged);

  let imageUrls: string[] = [];
  if (data.photos?.length) {
    for (const photoUri of data.photos) {
      try {
        const base64 = await uriToBase64(photoUri);
        const uploadRes = await api.uploadBase64(base64);
        const url = uploadRes?.data?.url;
        if (url && /^https?:\/\//i.test(url)) imageUrls.push(url);
      } catch {
        /* كما في الشاشة الأصلية: تخطي فشل صورة واحدة */
      }
    }
  }

  const createRes = await api.createPlace({
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    type_id: data.type_id.trim(),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    phone_number: data.phoneNumber?.trim() || undefined,
    attributes: attrs.length ? attrs : undefined,
    image_urls: imageUrls.length ? imageUrls : undefined,
  });

  const newPlaceId = createRes?.data?.id;
  if (newPlaceId) {
    try {
      await placeService.linkUnitPlace(ctx.unitRowId, newPlaceId);
    } catch {
      /* المكان أُنشئ لكن الربط فشل؛ يمكن إعادة المحاولة من الإدارة */
    }
  }

  await refresh();
}
