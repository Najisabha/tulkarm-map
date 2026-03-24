import { z } from 'zod';

export const createPlaceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(32).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
});

export const updatePlaceTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    emoji: z.string().max(32).optional().nullable(),
    color: z.string().max(32).optional().nullable(),
  })
  .refine((d) => d.name !== undefined || d.emoji !== undefined || d.color !== undefined, {
    message: 'أدخل حقلًا واحدًا على الأقل للتحديث',
  });

export const createAttributeDefSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  value_type: z.enum(['string', 'number', 'boolean', 'json', 'date']).default('string'),
  is_required: z.boolean().default(false),
  options: z.any().optional(),
});
