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
