import { z } from 'zod';

export const createPlaceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(32).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  sort_order: z.coerce.number().int().optional().nullable(),
});

export const updatePlaceTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    emoji: z.string().max(32).optional().nullable(),
    color: z.string().max(32).optional().nullable(),
    sort_order: z.coerce.number().int().optional().nullable(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.emoji !== undefined ||
      d.color !== undefined ||
      d.sort_order !== undefined,
    { message: 'أدخل حقلًا واحدًا على الأقل للتحديث' }
  );

const attributeValueTypeEnum = z.enum(['string', 'number', 'boolean', 'json', 'date', 'phone']);

export const createAttributeDefSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  value_type: attributeValueTypeEnum.default('string'),
  is_required: z.boolean().default(false),
  options: z.any().optional(),
});

export const updateAttributeDefSchema = z
  .object({
    key: z.string().min(1).max(100).optional(),
    label: z.string().min(1).max(255).optional(),
    value_type: attributeValueTypeEnum.optional(),
    is_required: z.boolean().optional(),
    options: z.any().optional().nullable(),
  })
  .refine(
    (d) =>
      d.key !== undefined ||
      d.label !== undefined ||
      d.value_type !== undefined ||
      d.is_required !== undefined ||
      Object.prototype.hasOwnProperty.call(d, 'options'),
    { message: 'أدخل حقلًا واحدًا على الأقل للتحديث' }
  );
