/**
 * placeFormValidation — validation خفيف لنموذج إضافة المكان على الواجهة.
 * يتوافق مع schema السيرفر في places.schema.js.
 */

export interface PlaceFormValidationInput {
  name: string;
  typeId?: string;
  latitude?: number;
  longitude?: number;
  dynamicValues?: Record<string, string>;
  requiredAttrKeys?: { key: string; label: string }[];
  phoneNumber?: string;
  floorsCount?: string;
  unitsPerFloor?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** رسالة الخطأ الأولى إذا وُجدت */
  error: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePlaceForm(input: PlaceFormValidationInput): ValidationResult {
  const fail = (error: string): ValidationResult => ({ valid: false, error });

  if (!input.name?.trim()) return fail('يرجى إدخال اسم المكان');
  if (input.name.trim().length > 255) return fail('اسم المكان طويل جداً (الحد 255 حرف)');

  if (input.typeId !== undefined) {
    if (!input.typeId || !UUID_RE.test(input.typeId.trim())) {
      return fail('معرّف نوع المكان غير صالح. يرجى إغلاق النموذج وإعادة فتحه.');
    }
  }

  if (input.phoneNumber && !/^[0-9+\-\s()]{0,30}$/.test(input.phoneNumber)) {
    return fail('رقم الهاتف غير صالح (أرقام، +، -، مسافات فقط، حد 30 رمز)');
  }

  if (input.requiredAttrKeys?.length && input.dynamicValues) {
    const missing = input.requiredAttrKeys.filter(
      ({ key }) => !input.dynamicValues![key]?.trim()
    );
    if (missing.length > 0) {
      return fail(`يرجى تعبئة: ${missing.map((m) => m.label).join('، ')}`);
    }
  }

  if (input.floorsCount !== undefined && input.floorsCount !== '') {
    const n = parseInt(input.floorsCount);
    if (isNaN(n) || n < 1 || n > 200) return fail('عدد الطوابق يجب أن يكون بين 1 و 200');
  }

  if (input.unitsPerFloor !== undefined && input.unitsPerFloor !== '') {
    const n = parseInt(input.unitsPerFloor);
    if (isNaN(n) || n < 1 || n > 500) return fail('عدد الوحدات يجب أن يكون بين 1 و 500');
  }

  return { valid: true, error: null };
}

export function validateProductForm(input: {
  name: string;
  price: string;
}): ValidationResult {
  const fail = (error: string): ValidationResult => ({ valid: false, error });
  if (!input.name?.trim()) return fail('اسم المنتج مطلوب');
  const price = parseFloat(input.price);
  if (isNaN(price) || price < 0) return fail('السعر يجب أن يكون رقماً موجباً');
  return { valid: true, error: null };
}
