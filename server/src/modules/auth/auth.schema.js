import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(100),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة').max(255),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(128),
});

export const loginSchema = z.object({
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'رمز التحديث مطلوب'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(100),
  phone_number: z
    .string()
    .trim()
    .max(30, 'رقم الهاتف طويل جداً')
    .regex(/^[0-9+\-\s()]*$/, 'صيغة رقم الهاتف غير صحيحة')
    .nullable()
    .optional(),
  date_of_birth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ الميلاد يجب أن تكون YYYY-MM-DD')
    .nullable()
    .optional(),
  profile_image_url: z.string().trim().url('رابط صورة الملف الشخصي غير صحيح').nullable().optional(),
  id_card_image_url: z.string().trim().url('رابط صورة الهوية غير صحيح').nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل').max(128),
});
